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
const DEBUG_INGEST = process.env.DEBUG_PLC_INGEST === "true";

const sitewise = new IoTSiteWiseClient({ region: REGION });

// ── Pending values accumulator ──────────────────────────
// Map<alias, { value, quality, timeInSeconds, offsetInNanos }>
// Newer messages overwrite older ones within the same batch window.

/** @type {Map<string, object>} */
const pending = new Map();
const lastKnownValues = new Map();

function ingestDebug(message, details) {
  if (!DEBUG_INGEST) return;
  if (details === undefined) console.log(`[sitewise][debug] ${message}`);
  else console.log(`[sitewise][debug] ${message}`, details);
}

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

function scalar(rawValue) {
  if (typeof rawValue === "number" && Number.isFinite(rawValue)) return rawValue;
  if (Array.isArray(rawValue) && rawValue.length > 0 && typeof rawValue[0] === "number" && Number.isFinite(rawValue[0])) {
    return rawValue[0];
  }
  return null;
}

function resolveValue(raw, keys, alias, fallback = 0) {
  for (const key of keys) {
    const value = scalar(raw[key]);
    if (value == null || value === -1) continue;
    lastKnownValues.set(alias, Number(value));
    return Number(value);
  }

  if (lastKnownValues.has(alias)) return lastKnownValues.get(alias);
  lastKnownValues.set(alias, fallback);
  return fallback;
}

function resolveBit(raw, keys, alias, fallback = 0) {
  const value = resolveValue(raw, keys, alias, fallback);
  return value >= 0.5 ? 1 : 0;
}

// ── Payload → SiteWise mapping ──────────────────────────

function mapPayload(raw) {
  const ts = uniqueTimestamp();
  const debugSummary = {
    analog: {},
    digital: {},
    relays: [],
    alerts: [],
  };

  // Analog sensors (DOUBLE)
  const analogMap = {
    voltage: ["boardA_voltage_pot_1", "voltage_pot"],
    current: ["boardA_current_pot", "current_pot"],
    temperature: ["boardA_temperature", "boardB_esp32_temperature", "temperature"],
    pH: ["boardA_8ch_analog_1_ph_sensor", "pH"],
  };

  for (const [swName, mqttKeys] of Object.entries(analogMap)) {
    const value = resolveValue(raw, mqttKeys, `${PREFIX}/${swName}/raw_value`, 0);
    debugSummary.analog[swName] = value;
    pending.set(`${PREFIX}/${swName}/raw_value`, {
      doubleValue: value,
      ...ts,
    });
  }

  // Digital sensors (INTEGER)
  const digitalMap = {
    photoE_sensor: ["boardA_photoelectric_sensor", "photoE_sensor"],
    metal_sensor: ["boardA_metal_sensor", "boardB_8ch_io_metal_sensor", "metal_sensor"],
    push_button: [
      "boardA_green_push_button",
      "boardB_8ch_io_green_button",
      "boardB_8ch_io_push_lock_button",
      "push_button",
    ],
    motor: ["boardA_8ch_relay_motor"],
  };

  for (const [swName, mqttKeys] of Object.entries(digitalMap)) {
    const value = resolveBit(raw, mqttKeys, `${PREFIX}/${swName}/state`, 0);
    debugSummary.digital[swName] = value;
    pending.set(`${PREFIX}/${swName}/state`, {
      integerValue: value,
      ...ts,
    });
  }

  // 8-channel relay (INTEGER)
  const relays = [
    resolveBit(raw, ["boardA_8ch_relay_motor"], `${PREFIX}/relay_ch0/state`, 0),
    resolveBit(raw, ["boardA_8ch_relay_alarm"], `${PREFIX}/relay_ch1/state`, 0),
    resolveBit(raw, ["boardA_alert_relays_red", "boardB_8ch_io_output_red"], `${PREFIX}/relay_ch2/state`, 0),
    resolveBit(raw, ["boardA_alert_relays_yellow", "boardB_8ch_io_output_yellow"], `${PREFIX}/relay_ch3/state`, 0),
    resolveBit(raw, ["boardA_alert_relays_green", "boardB_8ch_io_output_green"], `${PREFIX}/relay_ch4/state`, 0),
    resolveBit(raw, ["boardA_alert_relays_buzzer", "boardB_8ch_io_output_buzzer"], `${PREFIX}/relay_ch5/state`, 0),
    resolveBit(raw, ["boardA_green_push_button"], `${PREFIX}/relay_ch6/state`, 0),
    resolveBit(raw, ["boardA_metal_sensor", "boardB_8ch_io_metal_sensor"], `${PREFIX}/relay_ch7/state`, 0),
  ];

  const legacyRelays = raw["8ch_relay_1"];
  if (Array.isArray(legacyRelays)) {
    for (let i = 0; i < Math.min(legacyRelays.length, 8); i++) {
      if (typeof legacyRelays[i] === "number" && legacyRelays[i] !== -1) {
        relays[i] = Number(legacyRelays[i]);
        lastKnownValues.set(`${PREFIX}/relay_ch${i}/state`, relays[i]);
      }
    }
  }

  for (let i = 0; i < relays.length; i++) {
    debugSummary.relays[i] = Number(relays[i]);
    pending.set(`${PREFIX}/relay_ch${i}/state`, {
      integerValue: Number(relays[i]),
      ...ts,
    });
  }

  pending.set(`${PREFIX}/motor/state`, {
    integerValue: Number(relays[0]),
    ...ts,
  });

  // Alerts (INTEGER)
  const alerts = [
    resolveBit(raw, ["boardA_alert_relays_red", "boardB_8ch_io_output_red"], `${PREFIX}/alert_0`, 0),
    resolveBit(raw, ["boardA_alert_relays_yellow", "boardB_8ch_io_output_yellow"], `${PREFIX}/alert_1`, 0),
    resolveBit(raw, ["boardA_alert_relays_buzzer", "boardB_8ch_io_output_buzzer"], `${PREFIX}/alert_2`, 0),
    resolveBit(raw, ["boardA_8ch_relay_alarm"], `${PREFIX}/alert_3`, 0),
  ];

  const legacyAlerts = raw.alerts;
  if (Array.isArray(legacyAlerts)) {
    for (let i = 0; i < Math.min(legacyAlerts.length, 4); i++) {
      if (typeof legacyAlerts[i] === "number" && legacyAlerts[i] !== -1) {
        alerts[i] = Number(legacyAlerts[i]);
        lastKnownValues.set(`${PREFIX}/alert_${i}`, alerts[i]);
      }
    }
  }

  for (let i = 0; i < alerts.length; i++) {
    debugSummary.alerts[i] = Number(alerts[i]);
    pending.set(`${PREFIX}/alert_${i}`, {
      integerValue: Number(alerts[i]),
      ...ts,
    });
  }

  ingestDebug("Mapped plc/data payload to SiteWise aliases", {
    keys: Object.keys(raw),
    summary: debugSummary,
  });
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
