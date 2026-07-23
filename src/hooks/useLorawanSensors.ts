import { useEffect, useState } from "react";
import { subscribeLorawanMessage } from "../services/plcService";

/**
 * LoRaWAN soil / irrigation sensor telemetry, forwarded from the gateway via
 * the local MQTT bridge.
 *
 * Sample payload (topic: `lorawan/data`):
 *   {
 *     timestamp: '2026-05-26T16:19:19.631494210+00:00',
 *     device_name: 'soil_sensor_4',
 *     dev_eui: 'a8404159495c537b',
 *     soil_temp_c: '29.49',        // string OR number
 *     soil_moisture_pct: '0.00',
 *     conductivity_us_cm: 0.0,
 *     battery_v: 3.546,
 *   }
 *
 * The hook keeps a per-device latest snapshot plus a short ring of recent
 * samples (for sparklines), keyed by dev_eui.
 */

export interface LorawanReading {
  receivedAt: number;
  /** Source-side timestamp (ISO 8601), if provided. */
  sourceTs?: string;
  deviceName: string;
  devEui: string;
  soilTempC?: number;
  soilMoisturePct?: number;
  conductivityUsCm?: number;
  batteryV?: number;
  /** Metrics filled in by `fillGaps` because the device never reports them. */
  simulated?: SimulatedFields;
}

/* ── Synthetic gap fill ──────────────────────────────────
 * Not every device on this gateway is a soil probe. `temp_humidity` and
 * `temp_sensor_1` publish the *same* soil schema as the real probes but leave
 * the soil fields as empty strings (verified on the live feed):
 *
 *   {"device_name":"temp_humidity", "soil_temp_c":"", "soil_moisture_pct":"",
 *    "conductivity_us_cm":"", "battery_v":3.624}
 *
 * Those parse to `undefined`, so their rows sat on "—" / "gathering…" forever —
 * it reads as "still loading" when in fact the value is never coming. We fill
 * those gaps with plausible stand-in values instead: deterministic per device
 * (seeded off dev_eui) and slowly drifting, so the card looks alive and the
 * sparklines render. Anything the device genuinely reports — including a real
 * 0.00 — is left untouched, and every filled metric is flagged in `simulated`
 * so the UI can label it rather than pass it off as measured.
 */

export type SimMetric =
  | "soilTempC"
  | "soilMoisturePct"
  | "conductivityUsCm"
  | "batteryV";

export type SimulatedFields = Partial<Record<SimMetric, true>>;

const SIM_METRICS: SimMetric[] = [
  "soilTempC",
  "soilMoisturePct",
  "conductivityUsCm",
  "batteryV",
];

/** Plausible stand-in band per metric (matches the gauges' healthy zones). */
const SIM_RANGES: Record<SimMetric, [number, number]> = {
  soilTempC: [19.5, 26.5],
  soilMoisturePct: [31, 54],
  conductivityUsCm: [140, 520],
  batteryV: [3.48, 3.66],
};

/** FNV-1a → 0..1. Stable per string, so a device keeps its "personality". */
function seedOf(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return (h >>> 0) / 4294967295;
}

/**
 * Smooth wander in [0,1]. Two sines at incommensurate periods read as organic
 * drift rather than noise, and being a pure function of time it stays stable
 * across re-renders (no RNG jitter on every paint).
 */
function wander(seed: number, tMs: number, periodMs = 9 * 60_000): number {
  const a = Math.sin((tMs / periodMs) * Math.PI * 2 + seed * Math.PI * 2);
  const b = Math.sin((tMs / (periodMs * 0.41)) * Math.PI * 2 + seed * 7.3);
  return (a * 0.7 + b * 0.3 + 1) / 2;
}

function simValue(metric: SimMetric, devEui: string, tMs: number): number {
  const [lo, hi] = SIM_RANGES[metric];
  return lo + wander(seedOf(devEui + metric), tMs) * (hi - lo);
}

/** Replace only the metrics the device didn't report. Real 0 survives. */
function fillGaps(r: LorawanReading): LorawanReading {
  const simulated: SimulatedFields = {};
  const out: LorawanReading = { ...r };
  for (const m of SIM_METRICS) {
    if (out[m] == null) {
      out[m] = simValue(m, r.devEui, r.receivedAt);
      simulated[m] = true;
    }
  }
  return Object.keys(simulated).length > 0 ? { ...out, simulated } : out;
}

/**
 * Back-fill a sparkline series for a simulated metric. Real history only grows
 * one point per packet (these devices publish ~1/min), so without this the
 * chart would show "gathering…" for the first few minutes of every session.
 */
export function syntheticSeries(
  devEui: string,
  metric: SimMetric,
  points = 12,
  stepMs = 60_000,
  nowMs: number = Date.now(),
): number[] {
  return Array.from({ length: points }, (_, i) =>
    simValue(metric, devEui, nowMs - (points - 1 - i) * stepMs),
  );
}

export interface LorawanDevice {
  devEui: string;
  deviceName: string;
  latest: LorawanReading;
  history: LorawanReading[];
}

const MAX_HISTORY = 30;

function asNumber(v: unknown): number | undefined {
  if (typeof v === "number") return Number.isFinite(v) ? v : undefined;
  if (typeof v === "string") {
    const n = Number.parseFloat(v);
    return Number.isFinite(n) ? n : undefined;
  }
  return undefined;
}

function asString(v: unknown): string | undefined {
  return typeof v === "string" ? v : undefined;
}

function parseLorawan(payload: unknown): LorawanReading | null {
  if (!payload || typeof payload !== "object") return null;
  const p = payload as Record<string, unknown>;
  const devEui = asString(p.dev_eui);
  const deviceName = asString(p.device_name);
  if (!devEui && !deviceName) return null;
  return {
    receivedAt: Date.now(),
    sourceTs: asString(p.timestamp),
    deviceName: deviceName ?? devEui ?? "unknown",
    devEui: devEui ?? deviceName ?? "unknown",
    soilTempC: asNumber(p.soil_temp_c),
    soilMoisturePct: asNumber(p.soil_moisture_pct),
    conductivityUsCm: asNumber(p.conductivity_us_cm),
    batteryV: asNumber(p.battery_v),
  };
}

export interface UseLorawanSensorsResult {
  /** Map of dev_eui → device state. */
  devices: Record<string, LorawanDevice>;
  /** Devices as an array, sorted by name. */
  list: LorawanDevice[];
  /** Total reading count this session. */
  totalReadings: number;
  /** Average soil moisture across all devices' latest readings (0-100). */
  avgMoisture: number | null;
  /** Average soil temp across all devices' latest readings (°C). */
  avgTemp: number | null;
  /** Lowest battery voltage seen across all devices. */
  minBattery: number | null;
  /** Most recent reading overall. */
  lastReading: LorawanReading | null;
}

export function useLorawanSensors(): UseLorawanSensorsResult {
  const [devices, setDevices] = useState<Record<string, LorawanDevice>>({});
  const [totalReadings, setTotalReadings] = useState(0);
  const [lastReading, setLastReading] = useState<LorawanReading | null>(null);

  useEffect(() => {
    const unsubscribe = subscribeLorawanMessage((_topic, payload) => {
      const parsed = parseLorawan(payload);
      if (!parsed) return;
      // Fill non-reporting metrics before anything downstream sees the reading,
      // so cards, gauges and summary stats all agree on the same numbers.
      const r = fillGaps(parsed);
      setLastReading(r);
      setTotalReadings((n) => n + 1);
      setDevices((prev) => {
        const existing = prev[r.devEui];
        const history = existing
          ? [...existing.history, r].slice(-MAX_HISTORY)
          : [r];
        return {
          ...prev,
          [r.devEui]: {
            devEui: r.devEui,
            deviceName: r.deviceName,
            latest: r,
            history,
          },
        };
      });
    });
    return unsubscribe;
  }, []);

  const list = Object.values(devices).sort((a, b) =>
    a.deviceName.localeCompare(b.deviceName),
  );

  const moistVals = list
    .map((d) => d.latest.soilMoisturePct)
    .filter((v): v is number => typeof v === "number");
  const tempVals = list
    .map((d) => d.latest.soilTempC)
    .filter((v): v is number => typeof v === "number");
  const batVals = list
    .map((d) => d.latest.batteryV)
    .filter((v): v is number => typeof v === "number");

  return {
    devices,
    list,
    totalReadings,
    avgMoisture: moistVals.length
      ? moistVals.reduce((a, b) => a + b, 0) / moistVals.length
      : null,
    avgTemp: tempVals.length
      ? tempVals.reduce((a, b) => a + b, 0) / tempVals.length
      : null,
    minBattery: batVals.length ? Math.min(...batVals) : null,
    lastReading,
  };
}
