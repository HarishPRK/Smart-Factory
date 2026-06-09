/**
 * AWS IoT Core round-trip latency probe (SigV4 / MQTT-over-WebSocket).
 *
 * Measures the dominant cost of running the dashboard's `iotcore` mode: the
 * LAN → AWS region → LAN round trip. Because the browser sits on the same LAN
 * as this probe, the browser-visible latency of a direct IoT Core MQTT
 * subscription is ~this round trip (the AWS→browser leg ≈ the AWS→probe leg).
 * So this number is a faithful proxy for "how much does AWS add vs local"
 * WITHOUT needing the Cognito Identity Pool / browser auth stood up first.
 *
 * Auth: SigV4 over MQTT-WebSocket using the IAM keys in .env
 * (AWS_ACCESS_KEY_ID / AWS_SECRET_ACCESS_KEY / AWS_SESSION_TOKEN) — exactly the
 * same mechanism as server/ipsecSource.ts, which already connects successfully.
 * No X.509 certs required. This is also the same transport (MQTT-over-WSS) the
 * browser's iotcore mode uses, so the timing closely matches the real path.
 *
 * How it works:
 *   1. Connects to AWS IoT Core over MQTT-WebSocket with SigV4.
 *   2. Subscribes to a dedicated probe topic.
 *   3. Publishes a timestamped ping every PROBE_INTERVAL_MS.
 *   4. IoT Core echoes the message back to this same client (MQTT brokers
 *      deliver to all subscribers of a topic, including the publisher).
 *   5. On echo, round-trip = Date.now() - ping.ts. Rolling stats are printed.
 *
 * Usage:  node scripts/aws-latency-probe.mjs    (or: npm run aws-latency-probe)
 *
 * Env (reuses the existing AWS plumbing in .env):
 *   AWS_ACCESS_KEY_ID / AWS_SECRET_ACCESS_KEY [/ AWS_SESSION_TOKEN]  required
 *   AWS_IOT_ENDPOINT (or IOT_ENDPOINT)   default alht1i2bx8tzt-ats.iot.us-east-1.amazonaws.com
 *   AWS_REGION (or IOT_REGION)           default us-east-1
 *   AWS_LATENCY_TOPIC                     default "plc/latency-probe"
 *   PROBE_INTERVAL_MS                     default 500
 *   PROBE_DURATION_S                      default 0 (run until Ctrl-C; >0 auto-stops)
 *
 * Authorization: with SigV4, IoT Core authorizes against the IAM policy on the
 * access key above — NOT an IoT cert policy. The IAM user/role needs, for the
 * probe topic:  iot:Connect (client/latency-probe-*), iot:Publish + iot:Receive
 * (topic/plc/latency-probe), iot:Subscribe (topicfilter/plc/latency-probe).
 * Your ipsec connection already proves Connect/Subscribe/Receive work; if the
 * probe hits an authorization error, add those statements to the IAM identity
 * (IAM policy, not IoT policy), or point AWS_LATENCY_TOPIC at a topic the
 * identity is already allowed to publish + subscribe on.
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { mqtt, iot, auth } from "aws-iot-device-sdk-v2";

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
    console.warn("[probe] .env load failed:", err.message);
  }
}

const ENDPOINT = process.env.AWS_IOT_ENDPOINT ?? process.env.IOT_ENDPOINT ??
  "alht1i2bx8tzt-ats.iot.us-east-1.amazonaws.com";
const REGION = process.env.AWS_REGION ?? process.env.IOT_REGION ?? "us-east-1";
const TOPIC = process.env.AWS_LATENCY_TOPIC ?? "plc/latency-probe";
const INTERVAL_MS = Number(process.env.PROBE_INTERVAL_MS ?? 500);
const DURATION_S = Number(process.env.PROBE_DURATION_S ?? 0);
const CLIENT_ID = `latency-probe-${Date.now()}`;

if (!process.env.AWS_ACCESS_KEY_ID && !process.env.AWS_PROFILE) {
  console.error(
    "[probe] No AWS credentials found. Set AWS_ACCESS_KEY_ID / " +
      "AWS_SECRET_ACCESS_KEY in .env (same keys ipsecSource.ts uses).",
  );
  process.exit(1);
}

console.log("──────────────────────────────────────────────────────────");
console.log(" AWS IoT Core round-trip latency probe (SigV4 / WebSocket)");
console.log("──────────────────────────────────────────────────────────");
console.log(` Endpoint : wss://${ENDPOINT}/mqtt`);
console.log(` Region   : ${REGION}`);
console.log(` Topic    : ${TOPIC}`);
console.log(` ClientId : ${CLIENT_ID}`);
console.log(` Interval : ${INTERVAL_MS} ms` + (DURATION_S > 0 ? `   Duration: ${DURATION_S}s` : "   (Ctrl-C to stop)"));
console.log("──────────────────────────────────────────────────────────");

// Rolling sample store: raw round-trip samples since the last summary print,
// plus lifetime counters for a running total.
let samples = [];
let lifetimeCount = 0;
let lifetimeSum = 0;
let lifetimeMin = Infinity;
let lifetimeMax = 0;
let inFlight = 0;
let seq = 0;
let publishTimer = null;
let summaryTimer = null;
let connection = null;

function percentile(sorted, p) {
  if (sorted.length === 0) return 0;
  const idx = Math.min(sorted.length - 1, Math.floor((p / 100) * sorted.length));
  return sorted[idx];
}

function printSummary() {
  if (samples.length === 0) {
    console.log(`[probe] (no echoes in last window — in-flight: ${inFlight})`);
    return;
  }
  const sorted = [...samples].sort((a, b) => a - b);
  const n = sorted.length;
  const avg = sorted.reduce((a, b) => a + b, 0) / n;
  const lifetimeAvg = lifetimeSum / lifetimeCount;
  console.log(
    `[probe] window n=${n}  ` +
      `avg=${avg.toFixed(0)}ms  min=${sorted[0]}ms  ` +
      `p50=${percentile(sorted, 50)}ms  p95=${percentile(sorted, 95)}ms  ` +
      `max=${sorted[n - 1]}ms   ` +
      `│ lifetime n=${lifetimeCount} avg=${lifetimeAvg.toFixed(0)}ms ` +
      `min=${lifetimeMin}ms max=${lifetimeMax}ms`,
  );
  samples = [];
}

function onEcho(payloadBuf) {
  const recvTs = Date.now();
  let msg;
  try {
    msg = JSON.parse(Buffer.from(payloadBuf).toString());
  } catch {
    return; // ignore non-probe traffic on the topic
  }
  if (typeof msg?.ts !== "number") return;
  const rtt = recvTs - msg.ts;
  inFlight = Math.max(0, inFlight - 1);

  samples.push(rtt);
  lifetimeCount++;
  lifetimeSum += rtt;
  if (rtt < lifetimeMin) lifetimeMin = rtt;
  if (rtt > lifetimeMax) lifetimeMax = rtt;
}

async function main() {
  const credentialsProvider = auth.AwsCredentialsProvider.newDefault();
  const builder = iot.AwsIotMqttConnectionConfigBuilder.new_with_websockets({
    region: REGION,
    credentials_provider: credentialsProvider,
  });
  builder.with_endpoint(ENDPOINT);
  builder.with_client_id(CLIENT_ID);
  builder.with_clean_session(true);
  builder.with_keep_alive_seconds(60);

  const client = new mqtt.MqttClient();
  connection = client.new_connection(builder.build());

  connection.on("interrupt", (err) => {
    console.warn("[probe] connection interrupted:", err?.error ?? String(err));
  });
  connection.on("resume", () => console.log("[probe] connection resumed"));
  connection.on("error", (err) => console.error("[probe] mqtt error:", err));

  console.log("[probe] Connecting…");
  await connection.connect();
  console.log(`[probe] Connected. Subscribing to ${TOPIC}…`);

  await connection.subscribe(TOPIC, mqtt.QoS.AtMostOnce, (_topic, payload) => {
    onEcho(payload);
  });
  console.log(`[probe] Subscribed. Sending pings every ${INTERVAL_MS}ms…\n`);

  publishTimer = setInterval(() => {
    const payload = JSON.stringify({ seq: seq++, ts: Date.now() });
    inFlight++;
    connection
      .publish(TOPIC, payload, mqtt.QoS.AtMostOnce)
      .catch((err) => {
        inFlight = Math.max(0, inFlight - 1);
        console.error("[probe] Publish error:", err?.message ?? err);
      });
  }, INTERVAL_MS);

  summaryTimer = setInterval(printSummary, 5000);

  if (DURATION_S > 0) {
    setTimeout(async () => {
      console.log(`\n[probe] Duration ${DURATION_S}s elapsed — final summary:`);
      printSummary();
      await shutdown(0);
    }, DURATION_S * 1000);
  }
}

async function shutdown(code) {
  if (publishTimer) clearInterval(publishTimer);
  if (summaryTimer) clearInterval(summaryTimer);
  try {
    if (connection) await connection.disconnect();
  } catch { /* ignore */ }
  process.exit(code);
}

process.on("SIGINT", async () => {
  console.log("\n[probe] Interrupted — final summary:");
  printSummary();
  await shutdown(0);
});

main().catch((err) => {
  console.error("[probe] Fatal:", err?.message ?? err);
  if (/forbidden|auth|denied|403/i.test(String(err?.message ?? err))) {
    console.error(
      "        Looks like an authorization failure. Add iot:Connect/Publish/" +
        "Subscribe/Receive for the probe topic to the IAM identity, or set " +
        "AWS_LATENCY_TOPIC to an already-allowed topic.",
    );
  }
  process.exit(1);
});
