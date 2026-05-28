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
      const r = parseLorawan(payload);
      if (!r) return;
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
