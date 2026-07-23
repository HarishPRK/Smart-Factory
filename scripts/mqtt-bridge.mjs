/**
 * Local MQTT-to-WebSocket bridge.
 *
 * Connects to the local Mosquitto broker via TCP (mqtt://) and OPTIONALLY also
 * connects to AWS IoT Core via mTLS (mqtts://) using X.509 client certs. Both
 * flows are forwarded to the browser dashboard over a single WebSocket so the
 * frontend only has to maintain one connection.
 *
 * Usage:  node scripts/mqtt-bridge.mjs
 *
 * Local-broker env:
 *   MQTT_HOST              default 192.168.10.254
 *   MQTT_PORT              default 1883
 *   WS_PORT                default 9001
 *
 * AWS IoT Core env (all four required to enable; otherwise AWS leg is skipped):
 *   AWS_IOT_ENDPOINT       e.g. a1b2c3d4-ats.iot.us-east-1.amazonaws.com
 *   AWS_IOT_CA_PATH        path to AmazonRootCA1.pem
 *   AWS_IOT_CERT_PATH      path to <thing>.cert.pem
 *   AWS_IOT_KEY_PATH       path to <thing>.private.key
 *   AWS_IOT_TOPIC_FILTER   default "kos/#"
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import mqtt from "mqtt";
import { WebSocketServer } from "ws";

// Load `.env` from the project root if present. Vite reads .env for the
// browser bundle, but Node scripts need to load it themselves. We do this
// before reading any process.env values so the bridge picks up AWS_IOT_*
// without requiring users to export them in their shell.
loadDotenv();

function loadDotenv() {
  try {
    const here = path.dirname(fileURLToPath(import.meta.url));
    const envPath = path.resolve(here, "..", ".env");
    if (!fs.existsSync(envPath)) return;
    const raw = fs.readFileSync(envPath, "utf8");
    let loaded = 0;
    for (const line of raw.split(/\r?\n/)) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;
      const eq = trimmed.indexOf("=");
      if (eq < 0) continue;
      const key = trimmed.slice(0, eq).trim();
      let value = trimmed.slice(eq + 1).trim();
      // Strip optional surrounding quotes
      if ((value.startsWith('"') && value.endsWith('"')) ||
          (value.startsWith("'") && value.endsWith("'"))) {
        value = value.slice(1, -1);
      }
      // Don't overwrite real shell env vars — the shell wins
      if (process.env[key] === undefined) {
        process.env[key] = value;
        loaded++;
      }
    }
    if (loaded > 0) console.log(`[bridge] Loaded ${loaded} vars from .env`);
  } catch (err) {
    console.warn("[bridge] .env load failed:", err.message);
  }
}

const MQTT_HOST = process.env.MQTT_HOST ?? "192.168.10.254";
const MQTT_PORT = Number(process.env.MQTT_PORT ?? 1883);
const WS_PORT = Number(process.env.WS_PORT ?? 9001);

// --- Local MQTT client (TCP) ---
const mqttUrl = `mqtt://${MQTT_HOST}:${MQTT_PORT}`;
const localClient = mqtt.connect(mqttUrl, {
  clientId: `bridge-local-${Date.now()}`,
  clean: true,
  reconnectPeriod: 5000,
});

// PLC telemetry now publishes on the UNS per-source subtopics; each carries
// only that source's keys (the frontend merges them back into one frame).
// The legacy plc/# filter is kept for plc/cmd echoes and the transition period.
const PLC_TOPICS = [
  "prplHome/McKinney/lineA/plc1/data/boardA",
  "prplHome/McKinney/lineA/plc1/data/boardB",
  "prplHome/McKinney/lineA/plc1/data/esp32",
  "prplHome/McKinney/lineA/plc1/data/system_metrics",
  "plc/#",
];

localClient.on("connect", () => {
  console.log(`[bridge] Connected to local MQTT broker at ${mqttUrl}`);
  for (const filter of PLC_TOPICS) {
    localClient.subscribe(filter, { qos: 0 }, (err) => {
      if (err) console.error(`[bridge] Local subscribe error (${filter}):`, err);
      else console.log(`[bridge] Subscribed to ${filter} on local broker`);
    });
  }
  // LoRaWAN soil/irrigation telemetry — published on `lorawan/data` (single
  // shared topic). Wildcard tolerates per-device subtopics if the gateway
  // ever splits them out.
  localClient.subscribe("lorawan/#", { qos: 0 }, (err) => {
    if (err) console.error("[bridge] LoRaWAN subscribe error:", err);
    else console.log("[bridge] Subscribed to lorawan/# on local broker");
  });
});

localClient.on("error", (err) => {
  console.error("[bridge] Local MQTT error:", err.message);
});

// --- AWS IoT Core client (mTLS, optional) ---
// Browsers can't do client-cert mTLS to AWS IoT, so the bridge does it on
// the device side and forwards to the browser over the existing WS.
let awsClient = null;
const AWS_IOT_ENDPOINT = process.env.AWS_IOT_ENDPOINT;
const AWS_IOT_CA_PATH = process.env.AWS_IOT_CA_PATH;
const AWS_IOT_CERT_PATH = process.env.AWS_IOT_CERT_PATH;
const AWS_IOT_KEY_PATH = process.env.AWS_IOT_KEY_PATH;
const AWS_IOT_TOPIC_FILTER = process.env.AWS_IOT_TOPIC_FILTER ?? "kos/#";

if (AWS_IOT_ENDPOINT && AWS_IOT_CA_PATH && AWS_IOT_CERT_PATH && AWS_IOT_KEY_PATH) {
  try {
    const ca = fs.readFileSync(AWS_IOT_CA_PATH);
    const cert = fs.readFileSync(AWS_IOT_CERT_PATH);
    const key = fs.readFileSync(AWS_IOT_KEY_PATH);
    console.log(
      `[bridge] AWS IoT certs loaded: CA=${ca.length}B cert=${cert.length}B key=${key.length}B`,
    );

    const awsUrl = `mqtts://${AWS_IOT_ENDPOINT}:8883`;
    const awsClientId = `bridge-aws-${Date.now()}`;
    console.log(`[bridge] Connecting to AWS IoT as clientId="${awsClientId}"`);

    awsClient = mqtt.connect(awsUrl, {
      clientId: awsClientId,
      clean: true,
      reconnectPeriod: 5000,
      protocol: "mqtts",
      protocolVersion: 4,
      ca,
      cert,
      key,
      rejectUnauthorized: true,
    });

    // Log every lifecycle event — AWS IoT often refuses connections silently
    // by closing the TCP/TLS socket immediately after the auth check, which
    // shows up as a `close` event rather than `error`.
    awsClient.on("connect", () => {
      console.log(`[bridge] Connected to AWS IoT at ${awsUrl}`);
      awsClient.subscribe(AWS_IOT_TOPIC_FILTER, { qos: 0 }, (err, granted) => {
        if (err) {
          console.error("[bridge] AWS subscribe error:", err.message ?? err);
        } else if (!granted || granted.length === 0 || granted[0].qos === 128) {
          console.error(
            `[bridge] AWS subscribe rejected for ${AWS_IOT_TOPIC_FILTER}` +
              " — IoT Policy likely missing iot:Subscribe / iot:Receive on this topic filter.",
          );
        } else {
          console.log(`[bridge] Subscribed to ${AWS_IOT_TOPIC_FILTER} on AWS IoT`);
        }
      });
    });

    awsClient.on("error", (err) => {
      console.error("[bridge] AWS IoT error:", err.message ?? err);
    });
    awsClient.on("close", () => {
      console.warn("[bridge] AWS IoT connection closed (will retry in ~5s)");
    });
    awsClient.on("offline", () => {
      console.warn("[bridge] AWS IoT client offline");
    });
    awsClient.on("reconnect", () => {
      console.log("[bridge] AWS IoT reconnecting…");
    });
    awsClient.on("disconnect", (packet) => {
      console.warn(
        "[bridge] AWS IoT broker sent DISCONNECT:",
        packet?.reasonCode ?? "(no reason code)",
      );
    });
  } catch (err) {
    console.error("[bridge] Failed to read AWS IoT certs:", err.message);
    awsClient = null;
  }
} else {
  console.log("[bridge] AWS IoT vars not set — kos/# forwarding disabled.");
}

// --- WebSocket server ---
const wss = new WebSocketServer({ port: WS_PORT });
const clients = new Set();

wss.on("listening", () => {
  console.log(`[bridge] WebSocket server listening on ws://localhost:${WS_PORT}`);
});

wss.on("connection", (ws) => {
  console.log("[bridge] Browser connected");
  clients.add(ws);

  // Browser → local MQTT (for command publishes only — never proxied to AWS)
  ws.on("message", (data) => {
    try {
      const msg = JSON.parse(data.toString());
      const topic = msg.topic ?? "plc/cmd";
      const payload = JSON.stringify(msg.payload ?? msg);
      localClient.publish(topic, payload);
    } catch {
      console.error("[bridge] Bad message from browser");
    }
  });

  ws.on("close", () => {
    clients.delete(ws);
    console.log("[bridge] Browser disconnected");
  });
});

// Forward MQTT (either source) → all connected browsers. Each WS frame is
// shaped { topic, payload } so the frontend can route on topic prefix.
function forward(topic, payloadBuf) {
  let payload;
  try {
    payload = JSON.parse(payloadBuf.toString());
  } catch {
    payload = payloadBuf.toString(); // tolerate non-JSON publishes
  }
  // `publishedAt` (epoch ms) lets the browser measure bridge → WS → browser
  // transport latency (the local baseline) via latencyMonitor.
  const msg = JSON.stringify({ topic, payload, publishedAt: Date.now() });
  for (const ws of clients) {
    if (ws.readyState === 1) ws.send(msg);
  }
}

localClient.on("message", forward);
if (awsClient) awsClient.on("message", forward);

console.log(`[bridge] Starting — local MQTT ${mqttUrl}` +
  (awsClient ? ` + AWS IoT ${AWS_IOT_ENDPOINT}` : "") +
  ` ↔ WS ws://localhost:${WS_PORT}`);
