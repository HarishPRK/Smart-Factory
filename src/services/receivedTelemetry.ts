import type { PLCParameter } from "../types";

export type TelemetrySource = "plc" | "simulation" | "none";

/** The bridge publishes frequently. Retained samples become explicitly stale
 * if no real controller receipt has arrived within this bounded window. */
export const PLC_TELEMETRY_STALE_MS = 15_000;

export interface ReceivedTelemetryState {
  params: PLCParameter[];
  telemetrySource: TelemetrySource;
  lastReceivedAt: number | null;
  receivedHistories: Record<string, number[]>;
}

export function isReceivedParameter(param: PLCParameter): boolean {
  if (param.placeholder) return false;
  return param.kind === "analog"
    ? typeof param.value === "number" && Number.isFinite(param.value)
    : typeof param.active === "boolean";
}

/** True equivalents of parser channels, not the visual model's fallback
 * readings. A missing inspection channel is never filled from forming light. */
const SENSOR_CHANNELS: Record<string, string[]> = {
  mixing_ph: ["mixing_ph", "ph"],
  intake_optical: ["intake_optical", "photoE"],
  quality_optical: ["quality_optical", "photoE"],
  forming_proximity: ["forming_proximity", "photoE"],
  pkg_proximity: ["pkg_proximity", "photoE"],
  curing_fire: ["curing_fire", "fire"],
  pkg_fire: ["pkg_fire", "fire"],
  forming_estop: ["forming_estop", "system_emergency_stop"],
  mixing_estop: ["mixing_estop", "system_emergency_stop"],
  pkg_estop: ["pkg_estop", "system_emergency_stop"],
  intake_rfid: ["intake_rfid", "operator_rfid"],
  dispatch_rfid: ["dispatch_rfid", "operator_rfid"],
};

/** The current parser intentionally exposes some board probes under multiple
 * station IDs. Disclose that shared physical input without inventing another. */
const SHARED_INPUTS: Record<string, { id: string; label: string }> = {
  mixing_ph: { id: "ph", label: "Shared pH input" },
  mixing_mq: { id: "mixing_mq", label: "Shared gas input" },
  curing_mq: { id: "mixing_mq", label: "Shared gas input" },
  forming_light: { id: "forming_light", label: "Shared light input" },
  quality_light: { id: "forming_light", label: "Shared light input" },
  mixing_turbidity: { id: "mixing_turbidity", label: "Shared turbidity input" },
  quality_turbidity: { id: "mixing_turbidity", label: "Shared turbidity input" },
  curing_motion: { id: "curing_motion", label: "Shared motion input" },
  pkg_motion: { id: "curing_motion", label: "Shared motion input" },
  forming_pressure: { id: "forming_pressure", label: "Shared pressure input" },
  pkg_pressure: { id: "forming_pressure", label: "Shared pressure input" },
  intake_gps: { id: "intake_gps", label: "Auxiliary input" },
  dispatch_gps: { id: "intake_gps", label: "Auxiliary input" },
  quality_lidar: { id: "quality_lidar", label: "Shared distance input" },
  intake_lidar: { id: "quality_lidar", label: "Shared distance input" },
  intake_fingerprint: { id: "intake_fingerprint", label: "Shared fingerprint input" },
  dispatch_fingerprint: { id: "intake_fingerprint", label: "Shared fingerprint input" },
  photoE: { id: "photoE", label: "Shared photoelectric input" },
  fire: { id: "fire", label: "Shared fire / smoke input" },
  system_emergency_stop: { id: "system_emergency_stop", label: "Controller emergency-stop input" },
  operator_rfid: { id: "operator_rfid", label: "Shared RFID authorization" },
};

export interface ReceivedSensorChannel {
  param: PLCParameter | null;
  value: number | null;
  history: number[];
  available: boolean;
  state: "live" | "awaiting" | "stale";
  sourceId: string | null;
  sourceLabel: string;
  shared: boolean;
}

/** Read the received engineering value directly. Never read the clamped or
 * generated digital-twin sensor value, or its mixed simulation history. */
export function readSensorPLCChannel(sensorId: string, state: ReceivedTelemetryState, now = Date.now()): ReceivedSensorChannel {
  const empty: ReceivedSensorChannel = {
    param: null, value: null, history: [], available: false,
    state: "awaiting", sourceId: null, sourceLabel: "Awaiting PLC input", shared: false,
  };
  if (state.telemetrySource !== "plc") return empty;
  const channelIds = SENSOR_CHANNELS[sensorId] ?? [sensorId];
  const param = channelIds.map((id) => state.params.find((candidate) => candidate.id === id && isReceivedParameter(candidate))).find(Boolean);
  if (!param) return empty;
  const value = param.kind === "analog" ? param.value! : param.active ? 1 : 0;
  const shared = SHARED_INPUTS[param.id];
  const sourceId = shared?.id ?? param.id;
  const sourceHistory = state.receivedHistories[sourceId] ?? state.receivedHistories[param.id] ?? [];
  const receivedAt = param.receivedAt ?? state.lastReceivedAt;
  const fresh = receivedAt !== null && now - receivedAt < PLC_TELEMETRY_STALE_MS;
  const displayedParam = param.id === "intake_gps" || param.id === "dispatch_gps"
    ? { ...param, label: "Auxiliary input", unit: "%" } : param;
  return {
    param: displayedParam, value, history: sourceHistory.filter(Number.isFinite), available: true,
    state: fresh ? "live" : "stale", sourceId,
    sourceLabel: shared?.label ?? `${param.label} PLC input`, shared: !!shared,
  };
}
