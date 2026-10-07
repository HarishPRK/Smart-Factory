/**
 * Cloud bridge — EC2 side of the EC2 architecture.
 *
 * Runs on the EC2 instance (in the same region as the IoT Core endpoint, so
 * the IoT Core → EC2 hop is intra-region / ~1-5 ms). Subscribes to AWS IoT
 * Core over MQTT-WebSocket with SigV4 (no certs) and fans every message out to
 * connected browsers over a local WebSocket — the same `{ topic, payload,
 * publishedAt }` envelope the local mqtt-bridge uses, so the frontend's
 * MosquittoPLCService works against it UNCHANGED (just point VITE_MQTT_BRIDGE_URL
 * at this server, proxied as wss:// by nginx).
 *
 *   factory → IoT Core → [this on EC2] → WebSocket → remote browser
 *
 * `publishedAt` is taken from the edge's `_bridgeTs` when present, so the
 * browser's latencyMonitor reports true end-to-end factory→browser latency.
 *
 * Usage:  node scripts/cloud-bridge.mjs    (or: npm run cloud-bridge)
 *
 * Env (from .env on the EC2 box):
 *   WS_PORT               local WebSocket port nginx proxies to, default 9001
 *   CLOUD_TOPICS          comma-separated IoT topic filters to subscribe,
 *                         default "prplHome/McKinney/lineA/plc1/#,plc/#,lorawan/#"
 *   AWS_ACCESS_KEY_ID / AWS_SECRET_ACCESS_KEY [/ AWS_SESSION_TOKEN]  required
 *                         (PREFER an EC2 instance role — then leave these unset)
 *   AWS_IOT_ENDPOINT (or IOT_ENDPOINT)   default alht1i2bx8tzt-ats.iot.us-east-1.amazonaws.com
 *   AWS_REGION (or IOT_REGION)           default us-east-1
 *
 * Authorization (IAM policy on the instance role or access key):
 *   iot:Connect    on  client/cloud-bridge-*
 *   iot:Subscribe  on  topicfilter/prplHome/McKinney/lineA/plc1/#   (and other subscribed filters)
 *   iot:Receive    on  topic/prplHome/McKinney/lineA/plc1/data      (and other subscribed topics)
 *   iot:Publish    on  topic/plc/control
 */

import fs from "node:fs";
import http from "node:http";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { WebSocketServer } from "ws";
import { mqtt as iotMqtt, iot, auth } from "aws-iot-device-sdk-v2";
import { createMeterFrame } from "./meter-wire.mjs";
import { MeterEnergyCounter } from "./meter-energy.mjs";
import {
  commandRequiresAuthorization,
  commandRequiresSafetyCheck,
  createPublishAck,
  createRfidAuthorizationGate,
  isAllowedCommandOrigin,
  parseBrowserPublish,
} from "./bridge-command.mjs";

loadDotenv();

function loadDotenv() {
  try {
    const here = path.dirname(fileURLToPath(import.meta.url));
    const envPath = path.resolve(here, "..", ".env");
    if (!fs.existsSync(envPath)) return;
    const raw = fs.readFileSync(envPath, "utf8");
    for (const line of raw.split(/\r?\n/)) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;
      const eq = trimmed.indexOf("=");
      if (eq < 0) continue;
      const key = trimmed.slice(0, eq).trim();
      let value = trimmed.slice(eq + 1).trim();
      if ((value.startsWith('"') && value.endsWith('"')) ||
          (value.startsWith("'") && value.endsWith("'"))) {
        value = value.slice(1, -1);
      }
      if (process.env[key] === undefined) process.env[key] = value;
    }
  } catch (err) {
    console.warn("[cloud] .env load failed:", err.message);
  }
}

const WS_PORT = Number(process.env.WS_PORT ?? 9001);
const CLOUD_TOPICS = (process.env.CLOUD_TOPICS ?? "prplHome/McKinney/lineA/plc1/#,plc/#,lorawan/#")
  .split(",")
  .map((t) => t.trim())
  .filter(Boolean);
// Meter telemetry is read-only and independent of PLC command readiness.
const METER_TOPIC = process.env.IOT_METER_TOPIC ?? "meter/data";
const meterEnergy = new MeterEnergyCounter({
  topic: METER_TOPIC,
  file: process.env.METER_ENERGY_STATE_PATH || path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../.local-data/meter-energy.json'),
});
const ENDPOINT = process.env.AWS_IOT_ENDPOINT ?? process.env.IOT_ENDPOINT ??
  "alht1i2bx8tzt-ats.iot.us-east-1.amazonaws.com";
const REGION = process.env.AWS_REGION ?? process.env.IOT_REGION ?? "us-east-1";
const CLIENT_ID = `cloud-bridge-${Date.now()}`;
const CONTROL_AUTHORIZATION_WINDOW_MS = Number(
  process.env.CONTROL_AUTHORIZATION_WINDOW_MS ?? 60_000,
);
const CONTROL_ALLOWED_ORIGINS = (process.env.CONTROL_ALLOWED_ORIGINS ?? "")
  .split(",")
  .map((origin) => origin.trim())
  .filter(Boolean);
const controlAuthorization = createRfidAuthorizationGate({
  windowMs: CONTROL_AUTHORIZATION_WINDOW_MS,
});

console.log("──────────────────────────────────────────────────────────");
console.log(" Cloud bridge: AWS IoT Core (SigV4) → WebSocket → browsers");
console.log("──────────────────────────────────────────────────────────");
console.log(` IoT endpoint : wss://${ENDPOINT}/mqtt  (${REGION})`);
console.log(` Subscribing  : ${CLOUD_TOPICS.join(", ")}`);
console.log(` WS server    : ws://0.0.0.0:${WS_PORT}  (nginx proxies wss→here)`);
console.log("──────────────────────────────────────────────────────────");

// --- WebSocket server (browsers connect here, via nginx) ---
const bridgeServer = http.createServer((request, response) => {
  if (request.url !== "/readyz") {
    response.writeHead(404).end();
    return;
  }

  const ready = awsReady && subscriptionsReady;
  response.writeHead(ready ? 200 : 503, {
    "Content-Type": "application/json",
    "Cache-Control": "no-store",
  });
  response.end(JSON.stringify({ ready, awsReady, subscriptionsReady, meterSubscribed, meterEnergyError: meterEnergy.error }));
});
const wss = new WebSocketServer({ server: bridgeServer });
const clients = new Set();
let received = 0;

bridgeServer.listen(WS_PORT, () =>
  console.log(`[cloud] WebSocket listening on :${WS_PORT}`),
);
bridgeServer.on("error", (err) => {
  if (err?.code === "EADDRINUSE") {
    console.error(
      `[cloud] Port ${WS_PORT} is already in use (your local mqtt-bridge?). ` +
        `Run with a different port:  $env:WS_PORT=9002; npm run cloud-bridge`,
    );
  } else {
    console.error("[cloud] WebSocket server error:", err?.message ?? err);
  }
  process.exit(1);
});
wss.on("connection", (ws, request) => {
  clients.add(ws);
  console.log(`[cloud] Browser connected (${clients.size} total)`);
  const commandOriginAllowed = isAllowedCommandOrigin(
    request.headers,
    CONTROL_ALLOWED_ORIGINS,
  );
  // Browser → IoT Core command relay. Only the known PLC command contracts are
  // accepted, and every modern request receives a broker publish acknowledgement.
  ws.on("message", async (data) => {
    const parsed = parseBrowserPublish(data);
    if (!parsed.ok) {
      const ack = createPublishAck(parsed.requestId, false, parsed.error);
      if (ack && ws.readyState === 1) ws.send(ack);
      console.error(`[cloud] Rejected browser command: ${parsed.error}`);
      return;
    }

    const { requestId, topic, payload } = parsed.command;
    if (!commandOriginAllowed) {
      const ack = createPublishAck(requestId, false, "Command origin is not allowed");
      if (ack && ws.readyState === 1) ws.send(ack);
      return;
    }
    if (
      commandRequiresSafetyCheck(parsed.command) &&
      !controlAuthorization.isSafeToEnergize()
    ) {
      const ack = createPublishAck(
        requestId,
        false,
        "Fresh PLC telemetry showing E-stop clear is required",
      );
      if (ack && ws.readyState === 1) ws.send(ack);
      return;
    }
    if (
      commandRequiresAuthorization(parsed.command) &&
      !controlAuthorization.isAuthorized()
    ) {
      const ack = createPublishAck(requestId, false, "Fresh RFID authorization is required");
      if (ack && ws.readyState === 1) ws.send(ack);
      return;
    }
    if (!awsReady || !subscriptionsReady || !awsConnection) {
      const ack = createPublishAck(requestId, false, "AWS IoT is not connected");
      if (ack && ws.readyState === 1) ws.send(ack);
      return;
    }

    try {
      await awsConnection.publish(topic, payload, iotMqtt.QoS.AtLeastOnce);
      const ack = createPublishAck(requestId, true);
      if (ack && ws.readyState === 1) ws.send(ack);
    } catch (err) {
      const ack = createPublishAck(requestId, false, "AWS IoT publish failed");
      if (ack && ws.readyState === 1) ws.send(ack);
      console.error("[cloud] Command publish error:", err?.message ?? err);
    }
  });
  ws.on("close", () => {
    clients.delete(ws);
    console.log(`[cloud] Browser disconnected (${clients.size} total)`);
  });
});

function broadcast(topic, payloadBuf, retained = false) {
  received++;
  if (topic === METER_TOPIC) {
    try {
      const frame = JSON.parse(createMeterFrame(topic, payloadBuf, Date.now(), retained));
      frame.energy = meterEnergy.accept(frame);
      frame.energyError = meterEnergy.error;
      const message = JSON.stringify(frame);
      for (const ws of clients) if (ws.readyState === 1) ws.send(message);
    } catch (error) {
      console.warn('[cloud] Rejected meter payload:', error.message);
    }
    return;
  }
  let payload;
  let bridgeTs;
  try {
    payload = JSON.parse(payloadBuf.toString());
    controlAuthorization.observe(topic, payload);
    if (payload && typeof payload === "object" && typeof payload._bridgeTs === "number") {
      bridgeTs = payload._bridgeTs;
    }
  } catch {
    payload = payloadBuf.toString(); // tolerate non-JSON
  }
  // Preserve the edge's stamp as publishedAt so the browser measures the full
  // factory→browser path; fall back to now() if the edge didn't stamp it.
  const msg = JSON.stringify({ topic, payload, publishedAt: bridgeTs ?? Date.now(), ...(retained ? { retained: true } : {}) });
  for (const ws of clients) {
    if (ws.readyState === 1) ws.send(msg);
  }
}

// --- AWS IoT Core (SigV4 WebSocket) subscriber ---
let awsReady = false;
let subscriptionsReady = false;
let meterSubscribed = false;
let awsConnection = null;

async function connectAws() {
  const credentialsProvider = auth.AwsCredentialsProvider.newDefault();
  const builder = iot.AwsIotMqttConnectionConfigBuilder.new_with_websockets({
    region: REGION,
    credentials_provider: credentialsProvider,
  });
  builder.with_endpoint(ENDPOINT);
  builder.with_client_id(CLIENT_ID);
  builder.with_clean_session(true);
  builder.with_keep_alive_seconds(60);

  const client = new iotMqtt.MqttClient();
  awsConnection = client.new_connection(builder.build());

  awsConnection.on("interrupt", (err) => {
    awsReady = false;
    subscriptionsReady = false;
    meterSubscribed = false;
    meterEnergy.disconnect();
    controlAuthorization.invalidate();
    console.warn("[cloud] IoT connection interrupted:", err?.error ?? String(err));
  });
  awsConnection.on("resume", async () => {
    awsReady = true;
    controlAuthorization.invalidate();
    console.log("[cloud] IoT connection resumed — re-subscribing");
    try {
      await subscribeAll();
    } catch (err) {
      console.error("[cloud] Re-subscribe failed:", err?.message ?? err);
      process.exit(1);
    }
  });
  awsConnection.on("error", (err) => console.error("[cloud] IoT error:", err));

  await awsConnection.connect();
  awsReady = true;
  console.log("[cloud] Connected to AWS IoT Core");
  await subscribeAll();
}

async function subscribeAll() {
  subscriptionsReady = false;
  meterSubscribed = false;
  controlAuthorization.invalidate();
  const failures = [];
  for (const filter of new Set([...CLOUD_TOPICS, METER_TOPIC])) {
    try {
      const subscription = await awsConnection.subscribe(filter, iotMqtt.QoS.AtMostOnce, (topic, payload, _dup, _qos, retain) =>
        broadcast(topic, Buffer.from(payload), retain),
      );
      if (subscription.qos > 2) throw new Error('MQTT subscription was rejected.');
      console.log(`[cloud] Subscribed to ${filter}`);
      if (filter === METER_TOPIC) meterSubscribed = true;
    } catch (err) {
      console.error(`[cloud] Subscribe failed for ${filter}:`, err?.message ?? err);
      if (filter === METER_TOPIC) {
        console.error(`[cloud] Meter is unavailable. Allow iot:Subscribe on topicfilter/${METER_TOPIC} and iot:Receive on topic/${METER_TOPIC}, then restart the bridge.`);
      } else {
        failures.push(filter);
      }
    }
  }
  if (failures.length > 0) {
    throw new Error(`AWS IoT subscriptions failed: ${failures.join(", ")}`);
  }
  subscriptionsReady = true;
}

// Heartbeat — shows messages arriving from IoT Core and how many browsers are
// attached, so silence vs. data-flow is obvious (in journalctl on EC2 too).
setInterval(() => {
  console.log(`[cloud] heartbeat — received=${received} clients=${clients.size} (last 10s)`);
  received = 0;
}, 10000);

connectAws().catch((err) => {
  console.error("[cloud] Fatal — could not connect to AWS IoT:", err?.message ?? err);
  if (/forbidden|auth|denied|403/i.test(String(err?.message ?? err))) {
    console.error("        Authorization failure — add iot:Connect/Subscribe/Receive for the subscribed topics to the IAM identity / instance role.");
  }
  process.exit(1);
});

process.on("SIGINT", async () => {
  console.log("\n[cloud] Shutting down…");
  try { wss.close(); } catch { /* ignore */ }
  try { bridgeServer.close(); } catch { /* ignore */ }
  try { if (awsConnection) await awsConnection.disconnect(); } catch { /* ignore */ }
  process.exit(0);
});
