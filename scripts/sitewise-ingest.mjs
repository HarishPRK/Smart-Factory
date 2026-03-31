/**
 * MQTT-to-SiteWise ingestion daemon.
 *
 * Subscribes to the Mosquitto broker (same as mqtt-bridge.mjs) and pushes
 * every PLC reading into AWS IoT SiteWise via BatchPutAssetPropertyValue,
 * using property aliases so the script has zero coupling to SiteWise UUIDs.
 *
 * Usage:  node scripts/sitewise-ingest.mjs
 * Env:    MQTT_HOST            (default 192.168.10.254)
 *         MQTT_PORT            (default 1883)
 *         AWS_REGION           (default us-east-1)
 *         SITEWISE_PREFIX      (default /smart-factory/plc-1)
 *         SITEWISE_BATCH_MS    (default 1000)
 *
 * AWS credentials are resolved via the default SDK credential chain
 * (env vars, ~/.aws/credentials, EC2 instance role, etc.).
 */

import mqtt from "mqtt";
import {
  IoTSiteWiseClient,
  BatchPutAssetPropertyValueCommand,
} from "@aws-sdk/client-iotsitewise";

// ── Configuration ───────────────────────────────────────

const MQTT_HOST = process.env.MQTT_HOST ?? "192.168.10.254";
const MQTT_PORT = Number(process.env.MQTT_PORT ?? 1883);
const REGION = process.env.AWS_REGION ?? "us-east-1";
const PREFIX = process.env.SITEWISE_PREFIX ?? "/smart-factory/plc-1";
const BATCH_MS = Number(process.env.SITEWISE_BATCH_MS ?? 1000);

const sitewise = new IoTSiteWiseClient({ region: REGION });

// ── Pending values accumulator ──────────────────────────
// Map<alias, { value, quality, timeInSeconds, offsetInNanos }>
// Newer messages overwrite older ones within the same batch window.

/** @type {Map<string, object>} */
const pending = new Map();

// Monotonic nanosecond offset to guarantee unique timestamps per property
let lastEpochSec = 0;
let nanoCounter = 0;

function uniqueTimestamp() {
  const sec = Math.floor(Date.now() / 1000);
  if (sec === lastEpochSec) {
    nanoCounter += 1_000; // advance by 1 µs
  } else {
    lastEpochSec = sec;
    nanoCounter = 0;
  }
  return { timeInSeconds: sec, offsetInNanos: nanoCounter };
}

// ── Payload → SiteWise mapping ──────────────────────────

function mapPayload(raw) {
  const ts = uniqueTimestamp();

  // Analog sensors (DOUBLE)
  const analogMap = {
    voltage_pot: "voltage",
    current_pot: "current",
    temperature: "temperature",
    pH: "pH",
  };

  for (const [mqttKey, swName] of Object.entries(analogMap)) {
    const arr = raw[mqttKey];
    if (Array.isArray(arr) && arr.length > 0 && arr[0] != null) {
      pending.set(`${PREFIX}/${swName}/raw_value`, {
        doubleValue: Number(arr[0]),
        ...ts,
      });
    }
  }

  // Digital sensors (INTEGER)
  const digitalMap = {
    photoE_sensor: "photoE_sensor",
    metal_sensor: "metal_sensor",
    push_button: "push_button",
  };

  for (const [mqttKey, swName] of Object.entries(digitalMap)) {
    const arr = raw[mqttKey];
    if (Array.isArray(arr) && arr.length > 0 && arr[0] != null) {
      pending.set(`${PREFIX}/${swName}/state`, {
        integerValue: Number(arr[0]),
        ...ts,
      });
    }
  }

  // 8-channel relay (INTEGER)
  const relays = raw["8ch_relay_1"];
  if (Array.isArray(relays)) {
    for (let i = 0; i < Math.min(relays.length, 8); i++) {
      if (relays[i] != null) {
        pending.set(`${PREFIX}/relay_ch${i}/state`, {
          integerValue: Number(relays[i]),
          ...ts,
        });
      }
    }
  }

  // Alerts (INTEGER)
  const alerts = raw.alerts;
  if (Array.isArray(alerts)) {
    for (let i = 0; i < Math.min(alerts.length, 4); i++) {
      if (alerts[i] != null) {
        pending.set(`${PREFIX}/alert_${i}`, {
          integerValue: Number(alerts[i]),
          ...ts,
        });
      }
    }
  }
}

// ── Flush to SiteWise ───────────────────────────────────

async function flush() {
  if (pending.size === 0) return;

  // Snapshot and clear
  const entries = [];
  let entryIdx = 0;

  for (const [alias, val] of pending) {
    const valueKey = "doubleValue" in val ? "doubleValue" : "integerValue";
    entries.push({
      entryId: String(entryIdx++),
      propertyAlias: alias,
      propertyValues: [
        {
          value: { [valueKey]: val[valueKey] },
          timestamp: {
            timeInSeconds: val.timeInSeconds,
            offsetInNanos: val.offsetInNanos,
          },
          quality: "GOOD",
        },
      ],
    });
  }
  pending.clear();

  // BatchPutAssetPropertyValue accepts max 10 entries per call
  const BATCH_SIZE = 10;
  for (let i = 0; i < entries.length; i += BATCH_SIZE) {
    const batch = entries.slice(i, i + BATCH_SIZE);
    await sendWithRetry(batch);
  }
}

async function sendWithRetry(batch, attempt = 0) {
  try {
    const resp = await sitewise.send(
      new BatchPutAssetPropertyValueCommand({ entries: batch })
    );

    // Log partial errors (some entries may fail while others succeed)
    const errors = resp.errorEntries?.filter((e) => e.errors?.length > 0);
    if (errors?.length > 0) {
      for (const entry of errors) {
        for (const err of entry.errors) {
          console.error(
            `[sitewise] Entry ${entry.entryId} error: ${err.errorCode} — ${err.errorMessage}`
          );
        }
      }
    }
  } catch (err) {
    if (err.name === "ThrottlingException" && attempt < 5) {
      const delay = Math.min(1000 * 2 ** attempt, 30_000);
      console.warn(
        `[sitewise] Throttled, retrying in ${delay}ms (attempt ${attempt + 1})`
      );
      await new Promise((r) => setTimeout(r, delay));
      return sendWithRetry(batch, attempt + 1);
    }
    console.error(`[sitewise] BatchPut failed: ${err.message}`);
  }
}

// ── MQTT connection ─────────────────────────────────────

const mqttUrl = `mqtt://${MQTT_HOST}:${MQTT_PORT}`;
const client = mqtt.connect(mqttUrl, {
  clientId: `sitewise-ingest-${Date.now()}`,
  clean: true,
  reconnectPeriod: 5000,
});

client.on("connect", () => {
  console.log(`[sitewise] Connected to MQTT broker at ${mqttUrl}`);
  client.subscribe("plc/data", { qos: 0 }, (err) => {
    if (err) console.error("[sitewise] Subscribe error:", err);
    else console.log("[sitewise] Subscribed to plc/data");
  });
});

client.on("error", (err) => {
  console.error("[sitewise] MQTT error:", err.message);
});

client.on("message", (_topic, payload) => {
  try {
    const raw = JSON.parse(payload.toString());
    mapPayload(raw);
  } catch {
    console.error("[sitewise] Bad JSON from MQTT, skipping");
  }
});

// Flush on interval
const flushTimer = setInterval(() => {
  flush().catch((err) => console.error("[sitewise] Flush error:", err));
}, BATCH_MS);

// Graceful shutdown
function shutdown() {
  console.log("[sitewise] Shutting down...");
  clearInterval(flushTimer);
  flush()
    .catch(() => {})
    .finally(() => {
      client.end(false, () => process.exit(0));
    });
}

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);

console.log(
  `[sitewise] Starting — MQTT ${mqttUrl} → SiteWise (${REGION}, prefix: ${PREFIX}, batch: ${BATCH_MS}ms)`
);
