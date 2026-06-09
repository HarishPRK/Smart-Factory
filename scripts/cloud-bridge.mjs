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
 *                         default "plc/#,lorawan/#"
 *   AWS_ACCESS_KEY_ID / AWS_SECRET_ACCESS_KEY [/ AWS_SESSION_TOKEN]  required
 *                         (PREFER an EC2 instance role — then leave these unset)
 *   AWS_IOT_ENDPOINT (or IOT_ENDPOINT)   default alht1i2bx8tzt-ats.iot.us-east-1.amazonaws.com
 *   AWS_REGION (or IOT_REGION)           default us-east-1
 *
 * Authorization (IAM policy on the instance role or access key):
 *   iot:Connect    on  client/cloud-bridge-*
 *   iot:Subscribe  on  topicfilter/plc/#   (and other subscribed filters)
 *   iot:Receive    on  topic/plc/data      (and other subscribed topics)
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { WebSocketServer } from "ws";
import { mqtt as iotMqtt, iot, auth } from "aws-iot-device-sdk-v2";

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
const CLOUD_TOPICS = (process.env.CLOUD_TOPICS ?? "plc/#,lorawan/#")
  .split(",")
  .map((t) => t.trim())
  .filter(Boolean);
const ENDPOINT = process.env.AWS_IOT_ENDPOINT ?? process.env.IOT_ENDPOINT ??
  "alht1i2bx8tzt-ats.iot.us-east-1.amazonaws.com";
const REGION = process.env.AWS_REGION ?? process.env.IOT_REGION ?? "us-east-1";
const CLIENT_ID = `cloud-bridge-${Date.now()}`;

console.log("──────────────────────────────────────────────────────────");
console.log(" Cloud bridge: AWS IoT Core (SigV4) → WebSocket → browsers");
console.log("──────────────────────────────────────────────────────────");
console.log(` IoT endpoint : wss://${ENDPOINT}/mqtt  (${REGION})`);
console.log(` Subscribing  : ${CLOUD_TOPICS.join(", ")}`);
console.log(` WS server    : ws://0.0.0.0:${WS_PORT}  (nginx proxies wss→here)`);
console.log("──────────────────────────────────────────────────────────");

// --- WebSocket server (browsers connect here, via nginx) ---
const wss = new WebSocketServer({ port: WS_PORT });
const clients = new Set();
let received = 0;

wss.on("listening", () => console.log(`[cloud] WebSocket listening on :${WS_PORT}`));
wss.on("error", (err) => {
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
wss.on("connection", (ws) => {
  clients.add(ws);
  console.log(`[cloud] Browser connected (${clients.size} total)`);
  // Browser → IoT Core command relay (plc/cmd etc). The edge subscribes to the
  // command topic on IoT Core and applies it to the local broker. Read-only
  // dashboards never send these; included so control still works end-to-end.
  ws.on("message", (data) => {
    if (!awsReady || !awsConnection) return;
    try {
      const msg = JSON.parse(data.toString());
      const topic = msg.topic ?? "plc/cmd";
      const payload = JSON.stringify(msg.payload ?? msg);
      awsConnection.publish(topic, payload, iotMqtt.QoS.AtMostOnce).catch((err) =>
        console.error("[cloud] Command publish error:", err?.message ?? err),
      );
    } catch {
      console.error("[cloud] Bad command message from browser");
    }
  });
  ws.on("close", () => {
    clients.delete(ws);
    console.log(`[cloud] Browser disconnected (${clients.size} total)`);
  });
});

function broadcast(topic, payloadBuf) {
  received++;
  let payload;
  let bridgeTs;
  try {
    payload = JSON.parse(payloadBuf.toString());
    if (payload && typeof payload === "object" && typeof payload._bridgeTs === "number") {
      bridgeTs = payload._bridgeTs;
    }
  } catch {
    payload = payloadBuf.toString(); // tolerate non-JSON
  }
  // Preserve the edge's stamp as publishedAt so the browser measures the full
  // factory→browser path; fall back to now() if the edge didn't stamp it.
  const msg = JSON.stringify({ topic, payload, publishedAt: bridgeTs ?? Date.now() });
  for (const ws of clients) {
    if (ws.readyState === 1) ws.send(msg);
  }
}

// --- AWS IoT Core (SigV4 WebSocket) subscriber ---
let awsReady = false;
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
    console.warn("[cloud] IoT connection interrupted:", err?.error ?? String(err));
  });
  awsConnection.on("resume", async () => {
    awsReady = true;
    console.log("[cloud] IoT connection resumed — re-subscribing");
    await subscribeAll();
  });
  awsConnection.on("error", (err) => console.error("[cloud] IoT error:", err));

  await awsConnection.connect();
  awsReady = true;
  console.log("[cloud] Connected to AWS IoT Core");
  await subscribeAll();
}

async function subscribeAll() {
  for (const filter of CLOUD_TOPICS) {
    try {
      await awsConnection.subscribe(filter, iotMqtt.QoS.AtMostOnce, (topic, payload) =>
        broadcast(topic, Buffer.from(payload)),
      );
      console.log(`[cloud] Subscribed to ${filter}`);
    } catch (err) {
      console.error(`[cloud] Subscribe failed for ${filter}:`, err?.message ?? err);
    }
  }
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
  try { if (awsConnection) await awsConnection.disconnect(); } catch { /* ignore */ }
  process.exit(0);
});
