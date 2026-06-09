/**
 * Edge republisher — factory side of the EC2 architecture.
 *
 * Runs on the factory LAN. Subscribes to the local Mosquitto broker and
 * republishes the telemetry up to AWS IoT Core over MQTT-WebSocket with SigV4
 * auth (the same mechanism as server/ipsecSource.ts and the latency probe — no
 * X.509 certs). From IoT Core, the EC2 cloud-bridge fans it out to remote
 * browsers.
 *
 *   PLC → Mosquitto → [this] → IoT Core → cloud-bridge (EC2) → browser
 *
 * Each republished message gets an injected `_bridgeTs` (epoch ms) so the
 * browser can measure true end-to-end factory→IoT Core→EC2→browser latency.
 *
 * Usage:  node scripts/edge-republish.mjs    (or: npm run edge-republish)
 *
 * Env (from .env):
 *   MQTT_HOST              local broker, default 192.168.10.254
 *   MQTT_PORT             default 1883
 *   EDGE_TOPICS           comma-separated local topic filters to mirror,
 *                         default "plc/#,lorawan/#"
 *   AWS_ACCESS_KEY_ID / AWS_SECRET_ACCESS_KEY [/ AWS_SESSION_TOKEN]  required
 *   AWS_IOT_ENDPOINT (or IOT_ENDPOINT)   default alht1i2bx8tzt-ats.iot.us-east-1.amazonaws.com
 *   AWS_REGION (or IOT_REGION)           default us-east-1
 *
 * Authorization (IAM policy on the access key — NOT an IoT cert policy):
 *   iot:Connect   on  client/edge-republish-*
 *   iot:Publish   on  topic/plc/data        (and any other mirrored topics)
 * The latency probe already proved Publish works on plc/*; if a mirrored topic
 * is denied, add iot:Publish for it to the IAM identity.
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import mqtt from "mqtt";
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
    console.warn("[edge] .env load failed:", err.message);
  }
}

const MQTT_HOST = process.env.MQTT_HOST ?? "192.168.10.254";
const MQTT_PORT = Number(process.env.MQTT_PORT ?? 1883);
const EDGE_TOPICS = (process.env.EDGE_TOPICS ?? "plc/#,lorawan/#")
  .split(",")
  .map((t) => t.trim())
  .filter(Boolean);
const ENDPOINT = process.env.AWS_IOT_ENDPOINT ?? process.env.IOT_ENDPOINT ??
  "alht1i2bx8tzt-ats.iot.us-east-1.amazonaws.com";
const REGION = process.env.AWS_REGION ?? process.env.IOT_REGION ?? "us-east-1";
const CLIENT_ID = `edge-republish-${Date.now()}`;

if (!process.env.AWS_ACCESS_KEY_ID && !process.env.AWS_PROFILE) {
  console.error("[edge] No AWS credentials in env (AWS_ACCESS_KEY_ID / AWS_PROFILE).");
  process.exit(1);
}

console.log("──────────────────────────────────────────────────────────");
console.log(" Edge republisher: local Mosquitto → AWS IoT Core (SigV4)");
console.log("──────────────────────────────────────────────────────────");
console.log(` Local broker : mqtt://${MQTT_HOST}:${MQTT_PORT}`);
console.log(` Mirroring    : ${EDGE_TOPICS.join(", ")}`);
console.log(` IoT endpoint : wss://${ENDPOINT}/mqtt  (${REGION})`);
console.log("──────────────────────────────────────────────────────────");

let awsReady = false;
let awsConnection = null;
let received = 0;
let dropped = 0;
let forwarded = 0;
let loggedFirst = false;

// --- AWS IoT Core (SigV4 WebSocket) publisher ---
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
    console.warn("[edge] IoT connection interrupted:", err?.error ?? String(err));
  });
  awsConnection.on("resume", () => {
    awsReady = true;
    console.log("[edge] IoT connection resumed");
  });
  awsConnection.on("error", (err) => console.error("[edge] IoT error:", err));

  await awsConnection.connect();
  awsReady = true;
  console.log("[edge] Connected to AWS IoT Core — ready to republish");
}

// --- Local Mosquitto subscriber ---
const localClient = mqtt.connect(`mqtt://${MQTT_HOST}:${MQTT_PORT}`, {
  clientId: `edge-local-${Date.now()}`,
  clean: true,
  reconnectPeriod: 5000,
});

localClient.on("connect", () => {
  console.log(`[edge] Connected to local broker at mqtt://${MQTT_HOST}:${MQTT_PORT}`);
  for (const filter of EDGE_TOPICS) {
    localClient.subscribe(filter, { qos: 0 }, (err) => {
      if (err) console.error(`[edge] Local subscribe error for ${filter}:`, err.message);
      else console.log(`[edge] Subscribed to ${filter} on local broker`);
    });
  }
});

localClient.on("error", (err) => console.error("[edge] Local MQTT error:", err.message));

localClient.on("message", (topic, payloadBuf) => {
  received++;
  if (!loggedFirst) {
    loggedFirst = true;
    console.log(`[edge] First local message seen on "${topic}" — telemetry is flowing`);
  }
  if (!awsReady || !awsConnection) {
    dropped++;
    return;
  }
  // Inject _bridgeTs into JSON payloads so the browser can measure end-to-end
  // latency. Non-JSON payloads are forwarded verbatim.
  let outPayload;
  try {
    const obj = JSON.parse(payloadBuf.toString());
    if (obj && typeof obj === "object" && !Array.isArray(obj)) {
      obj._bridgeTs = Date.now();
      outPayload = JSON.stringify(obj);
    } else {
      outPayload = payloadBuf.toString();
    }
  } catch {
    outPayload = payloadBuf.toString();
  }

  awsConnection
    .publish(topic, outPayload, iotMqtt.QoS.AtMostOnce)
    .then(() => { forwarded++; })
    .catch((err) => {
      dropped++;
      console.error("[edge] Publish error:", err?.message ?? err);
    });
});

// Heartbeat every 10s — prints even during silence, so `received=0` clearly
// means the PLC isn't publishing to the mirrored topics (vs. an AWS problem).
setInterval(() => {
  console.log(`[edge] heartbeat — received=${received} forwarded=${forwarded} dropped=${dropped} (last 10s)`);
  received = 0;
  forwarded = 0;
  dropped = 0;
}, 10000);

connectAws().catch((err) => {
  console.error("[edge] Fatal — could not connect to AWS IoT:", err?.message ?? err);
  if (/forbidden|auth|denied|403/i.test(String(err?.message ?? err))) {
    console.error("        Authorization failure — add iot:Connect/iot:Publish for the mirrored topics to the IAM identity.");
  }
  process.exit(1);
});

process.on("SIGINT", async () => {
  console.log("\n[edge] Shutting down…");
  try { localClient.end(true); } catch { /* ignore */ }
  try { if (awsConnection) await awsConnection.disconnect(); } catch { /* ignore */ }
  process.exit(0);
});
