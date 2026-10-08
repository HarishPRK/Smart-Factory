import type { LorawanDevice, LorawanReading, SimMetric } from "../../hooks/useLorawanSensors";

export type LoraMetric = SimMetric;
export const LORA_METRICS = [
  { key: "soilMoisturePct", payloadKey: "soil_moisture_pct", label: "Moisture", unit: "%", decimals: 1, color: "#6ed6a2" },
  { key: "soilTempC", payloadKey: "soil_temp_c", label: "Soil temperature", unit: "°C", decimals: 1, color: "#e9bd70" },
  { key: "conductivityUsCm", payloadKey: "conductivity_us_cm", label: "Conductivity", unit: "µS/cm", decimals: 1, color: "#82b5f6" },
  { key: "batteryV", payloadKey: "battery_v", label: "Battery voltage", unit: "V", decimals: 2, color: "#43d8f1" },
] as const;

/** The legacy hook may backfill gaps. A measured zero is retained; a stand-in never is. */
export function receivedMetric(reading: LorawanReading, metric: LoraMetric): number | null {
  const value = reading[metric];
  return !reading.simulated?.[metric] && typeof value === "number" && Number.isFinite(value) ? value : null;
}

export function receivedSeries(device: LorawanDevice, metric: LoraMetric) {
  return device.history.flatMap((reading) => {
    const value = receivedMetric(reading, metric);
    return value !== null && Number.isFinite(reading.receivedAt) ? [{ value, timestamp: reading.receivedAt }] : [];
  }).sort((a, b) => a.timestamp - b.timestamp);
}

export function receivedSummary(list: LorawanDevice[]) {
  const values = (metric: LoraMetric) => list.flatMap((device) => {
    const value = receivedMetric(device.latest, metric);
    return value === null ? [] : [value];
  });
  const moisture = values("soilMoisturePct"); const battery = values("batteryV");
  return { moisture: moisture.length ? moisture.reduce((sum, value) => sum + value, 0) / moisture.length : null, battery: battery.length ? Math.min(...battery) : null };
}

export function relativePacketAge(timestamp: number, now: number) {
  const seconds = Math.max(0, Math.floor((now - timestamp) / 1000));
  if (seconds < 1) return "Just received";
  if (seconds < 60) return `${seconds}s ago`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  return `${Math.floor(seconds / 3600)}h ago`;
}
