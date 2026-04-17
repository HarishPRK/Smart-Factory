import type { PLCParameter } from "../types";
import { plcParameters } from "../data/mockData";

/* ── Raw MQTT payload from plc/data topic ────────────── */

export interface RawPLCPayload {
  [key: string]: number | number[] | [number] | undefined;
  // New flat payload format
  boardA_voltage_pot_1?: number;
  boardA_current_pot?: number;
  boardA_temperature?: number;
  boardA_photoelectric_sensor?: number;
  boardA_metal_sensor?: number;
  boardA_green_push_button?: number;
  boardA_alert_relays_red?: number;
  boardA_alert_relays_yellow?: number;
  boardA_alert_relays_green?: number;
  boardA_alert_relays_buzzer?: number;
  boardA_8ch_relay_motor?: number;
  boardA_8ch_relay_alarm?: number;
  boardA_voltage_pot_2?: number;
  boardA_8ch_analog_1_pressure_sensor?: number;
  boardA_8ch_analog_1_microwave_motion_sensor?: number;
  boardA_8ch_analog_1_ph_sensor?: number;
  boardA_8ch_analog_1_metaloxide_sensor?: number;
  boardA_8ch_analog_1_turbidity_sensor?: number;
  boardA_8ch_analog_1_light_sensor?: number;
  boardA_8ch_analog_1_orp_sensor?: number;
  boardB_8ch_io_metal_sensor?: number;
  boardB_8ch_io_green_button?: number;
  boardB_8ch_io_push_lock_button?: number;
  boardB_8ch_io_output_red?: number;
  boardB_8ch_io_output_yellow?: number;
  boardB_8ch_io_output_green?: number;
  boardB_8ch_io_output_buzzer?: number;
  boardB_esp32_temperature?: number;
  boardB_esp32_humidity?: number;
  boardB_esp32_pressure?: number;
  boardB_esp32_bme_gas?: number;
  boardB_esp32_water?: number;
  boardB_esp32_no2?: number;
  boardB_esp32_alcohol?: number;
  boardB_esp32_voc?: number;
  boardB_esp32_co?: number;
  boardB_esp32_finger_id?: number;
  boardB_esp32_finger_conf?: number;
  boardB_esp32_finger_match?: number;
  boardB_esp32_touch_raw?: number;
  boardB_esp32_touch_decoded?: number;
  boardB_esp32_touch_event?: number;
  boardB_esp32_distance_cm?: number;
  boardB_esp32_lidar_strength?: number;
  boardB_esp32_lidar_temp_c?: number;
  boardB_esp32_oxygen_percent?: number;
  // Legacy payload format (kept for compatibility)
  voltage_pot?: [number];
  current_pot?: [number];
  photoE_sensor?: [number];
  metal_sensor?: [number];
  alerts?: number[];
  "8ch_relay_1"?: number[];
  push_button?: [number];
  temperature?: [number];
  pH?: [number];
}

/* ── Shared types ──────────────────────────────────────── */

export interface PLCOutputs {
  motorFanOn: boolean;
  emergencyLightOn: boolean;
  photoESensor: boolean;
  metalSensor: boolean;
  /** True when an authorized operator badge is currently presented to the
   *  Board A RFID reader (boardA_rfid_authorized_user). Gates the intake stage. */
  rfidAuthorized: boolean;
  relay: boolean[];
  pushButton: boolean;
  alerts: boolean[];
}

export interface PLCState {
  params: PLCParameter[];
  outputs: PLCOutputs;
}

export const DEFAULT_OUTPUTS: PLCOutputs = {
  motorFanOn: false,
  emergencyLightOn: false,
  photoESensor: false,
  metalSensor: false,
  rfidAuthorized: false,
  relay: [false, false, false, false, false, false, false, false],
  pushButton: false,
  alerts: [false, false, false, false],
};

const PLC_DEBUG = import.meta.env.DEV || import.meta.env.VITE_PLC_DEBUG === "true";
let lastPLCParseLogAt = 0;

function plcDebug(message: string, details?: unknown) {
  if (!PLC_DEBUG) return;
  if (details === undefined) console.debug(`[PLC] ${message}`);
  else console.debug(`[PLC] ${message}`, details);
}

function plcWarn(message: string, details?: unknown) {
  if (!PLC_DEBUG) return;
  if (details === undefined) console.warn(`[PLC] ${message}`);
  else console.warn(`[PLC] ${message}`, details);
}

/* ── Payload parser ───────────────────────────────────── */

function deriveStatus(
  value: number,
  nominal: number,
  min: number,
  max: number
): "normal" | "warning" | "critical" {
  const range = max - min;
  if (range === 0) return "normal";
  const deviation = Math.abs(value - nominal) / range;
  if (deviation > 0.4) return "critical";
  if (deviation > 0.2) return "warning";
  return "normal";
}

/** Relay color: red when sensor active (motor running), green when idle */
export function deriveRelayColor(photoEActive: boolean): string {
  if (photoEActive) return "#ef4444";   // red — motor running
  return "#10b981";                     // green — idle
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function scaleLinear(
  value: number,
  inMin: number,
  inMax: number,
  outMin: number,
  outMax: number,
): number {
  if (inMax === inMin) return outMin;
  const normalized = (value - inMin) / (inMax - inMin);
  return outMin + clamp(normalized, 0, 1) * (outMax - outMin);
}

function scalar(rawValue: unknown): number | null {
  if (typeof rawValue === "number" && Number.isFinite(rawValue)) return rawValue;
  if (
    Array.isArray(rawValue) &&
    rawValue.length > 0 &&
    typeof rawValue[0] === "number" &&
    Number.isFinite(rawValue[0])
  ) {
    return rawValue[0];
  }
  return null;
}

function prevParam(prev: PLCState | null, id: string) {
  return prev?.params.find((p) => p.id === id);
}

function prevNum(prev: PLCState | null, id: string, fallback: number): number {
  return prevParam(prev, id)?.value ?? fallback;
}

function prevBit(prev: PLCState | null, id: string, fallback: boolean): boolean {
  return prevParam(prev, id)?.active ?? fallback;
}

function prevKnown(prev: PLCState | null, id: string): boolean {
  const param = prevParam(prev, id);
  return !!param && !param.placeholder;
}

function readSignal(
  raw: RawPLCPayload,
  keys: string[],
  prevValue: number,
  prevHasReal = false,
): { value: number; hasReal: boolean } {
  for (const key of keys) {
    const value = scalar(raw[key]);
    if (value == null || value === -1) continue;
    return { value, hasReal: true };
  }
  return { value: prevHasReal ? prevValue : 0, hasReal: prevHasReal };
}

function readScaledSignal(
  raw: RawPLCPayload,
  keys: string[],
  prevValue: number,
  prevHasReal: boolean,
  mapper: (value: number, key: string) => number,
): { value: number; hasReal: boolean } {
  for (const key of keys) {
    const value = scalar(raw[key]);
    if (value == null || value === -1) continue;
    return { value: mapper(value, key), hasReal: true };
  }
  return { value: prevHasReal ? prevValue : 0, hasReal: prevHasReal };
}

function readBitSignal(
  raw: RawPLCPayload,
  keys: string[],
  prevValue: boolean,
  prevHasReal = false,
): { value: boolean; hasReal: boolean } {
  const resolved = readSignal(raw, keys, prevValue ? 1 : 0, prevHasReal);
  return { value: resolved.value >= 0.5, hasReal: resolved.hasReal };
}

function collectFallbackDebug(
  raw: RawPLCPayload,
  label: string,
  keys: string[],
  hasReal: boolean,
  value: number | boolean,
  debugEvents: string[],
) {
  if (hasReal) return;
  const touchedKeys = keys.filter((key) => raw[key] !== undefined);
  if (touchedKeys.length === 0) return;
  const usedUnsetValue = touchedKeys.some((key) => scalar(raw[key]) === -1);
  debugEvents.push(
    `${label}: ${usedUnsetValue ? "unset(-1)" : "missing/invalid"} from ${touchedKeys.join(", ")} -> fallback ${value}`,
  );
}

function analogParam(config: {
  id: string;
  label: string;
  value: number;
  hasReal: boolean;
  unit: string;
  min: number;
  max: number;
  nominal: number;
  decimals: number;
  accentHex: string;
}): PLCParameter {
  return {
    id: config.id,
    label: config.label,
    kind: "analog",
    value: config.value,
    unit: config.unit,
    min: config.min,
    max: config.max,
    nominal: config.nominal,
    decimals: config.decimals,
    accentHex: config.accentHex,
    status: config.hasReal
      ? deriveStatus(config.value, config.nominal, config.min, config.max)
      : "normal",
    placeholder: !config.hasReal,
  };
}

function digitalParam(config: {
  id: string;
  label: string;
  active: boolean;
  hasReal: boolean;
  accentHex: string;
}): PLCParameter {
  return {
    id: config.id,
    label: config.label,
    kind: "digital",
    active: config.active,
    accentHex: config.accentHex,
    status: "normal",
    placeholder: !config.hasReal,
  };
}

export function isRawPLCPayload(data: unknown): data is RawPLCPayload {
  if (!data || typeof data !== "object") return false;
  const raw = data as Record<string, unknown>;
  return [
    // New flat payload (2026-04)
    "boardA_voltage_pot_1",
    "boardA_current_pot",
    "boardA_photoelectric_sensor",
    "boardA_ph_sensor",
    "boardA_pressure_sensor",
    "boardB_io_green_button",
    // Legacy keys (pre-2026-04)
    "boardA_8ch_analog_1_ph_sensor",
    "boardA_8ch_analog_1_pressure_sensor",
    "voltage_pot",
    "current_pot",
    "photoE_sensor",
    "pH",
  ].some((key) => raw[key] !== undefined);
}

/** Map the raw MQTT JSON from plc/data into our frontend PLCState. */
export function parsePLCPayload(raw: RawPLCPayload, prev?: PLCState | null): PLCState {
  const prevState = prev ?? null;
  const debugEvents: string[] = [];

  const voltage = readSignal(
    raw,
    ["boardA_voltage_pot_1", "voltage_pot"],
    prevNum(prevState, "voltage", 0),
    prevKnown(prevState, "voltage"),
  );
  const current = readSignal(
    raw,
    ["boardA_current_pot", "current_pot"],
    prevNum(prevState, "current", 0),
    prevKnown(prevState, "current"),
  );
  const temperature = readSignal(
    raw,
    ["boardA_temperature", "boardB_esp32_temperature", "temperature"],
    prevNum(prevState, "temperature", 0),
    prevKnown(prevState, "temperature"),
  );
  const ph = readSignal(
    raw,
    ["boardA_ph_sensor", "boardA_8ch_analog_1_ph_sensor", "pH"],
    prevNum(prevState, "ph", 7),
    prevKnown(prevState, "ph"),
  );
  const photoE = readBitSignal(
    raw,
    ["boardA_photoelectric_sensor", "photoE_sensor"],
    prevBit(prevState, "photoE", false),
    prevKnown(prevState, "photoE"),
  );
  const metal = readBitSignal(
    raw,
    // plc/data uses the flat `boardA_metal_sensor` / `boardB_io_metal_sensor`
    // keys. The legacy `boardB_8ch_io_metal_sensor` key was dropped from the
    // payload; we stop reading it here (it's still sent on plc/control for
    // firmware compatibility).
    ["boardA_metal_sensor", "boardB_io_metal_sensor", "metal_sensor"],
    prevBit(prevState, "metal", false),
    prevKnown(prevState, "metal"),
  );
  // RFID — authorizes operator badge at the intake gate. When this reads 0 the
  // digital twin forces the intake stage into "idle" (line cannot start).
  const rfidAuthorized = readBitSignal(
    raw,
    ["boardA_rfid_authorized_user"],
    prevState?.outputs.rfidAuthorized ?? false,
    prevState?.outputs.rfidAuthorized !== undefined,
  );
  const pushButton = readBitSignal(
    raw,
    [
      "boardA_green_push_button",
      "boardB_io_green_button",
      "boardB_io_push_lock_button",
      "push_button",
    ],
    prevState?.outputs.pushButton ?? false,
    prevState?.outputs.pushButton !== undefined,
  );
  // ── Relay / alert reads from plc/data ──
  // plc/data publishes the new flat keys only (boardA_relay_motor,
  // boardA_relay_alarm, boardA_alert_relays_*, boardB_io_output_*). The
  // `boardA_8ch_relay_*` and `boardB_8ch_io_*` names are no longer in the
  // inbound payload — they're retained only on plc/control publishes for
  // firmware-side backwards compatibility.
  const motorRelay = readBitSignal(
    raw,
    ["boardA_relay_motor"],
    prevState?.outputs.motorFanOn ?? false,
    prevState != null,
  );
  const alarmRelay = readBitSignal(
    raw,
    ["boardA_relay_alarm"],
    prevState?.outputs.relay?.[1] ?? false,
    prevState != null,
  );
  const alertRed = readBitSignal(
    raw,
    ["boardA_alert_relays_red", "boardB_io_output_red"],
    prevState?.outputs.alerts?.[0] ?? false,
    prevState != null,
  );
  const alertYellow = readBitSignal(
    raw,
    ["boardA_alert_relays_yellow", "boardB_io_output_yellow"],
    prevState?.outputs.alerts?.[1] ?? false,
    prevState != null,
  );
  const alertGreen = readBitSignal(
    raw,
    ["boardA_alert_relays_green", "boardB_io_output_green"],
    prevState?.outputs.relay?.[4] ?? false,
    prevState != null,
  );
  const alertBuzzer = readBitSignal(
    raw,
    ["boardA_alert_relays_buzzer", "boardB_io_output_buzzer"],
    prevState?.outputs.alerts?.[2] ?? false,
    prevState != null,
  );

  // Pressure: new payload uses `boardA_pressure_sensor` (raw 12-bit ADC,
  // ~0–4095 → scaled to 0–200 bar). Keep the legacy key + boardB ESP32 key
  // as fallbacks for older deployments.
  const formingPressure = readScaledSignal(
    raw,
    [
      "boardA_pressure_sensor",
      "boardA_8ch_analog_1_pressure_sensor",
      "boardB_esp32_pressure",
    ],
    prevNum(prevState, "forming_pressure", 0),
    prevKnown(prevState, "forming_pressure"),
    (value, key) =>
      key === "boardB_esp32_pressure" && value <= 200
        ? value
        : scaleLinear(value, 0, 4095, 0, 200),
  );
  const microwaveMotion = readScaledSignal(
    raw,
    [
      "boardA_microwave_motion_sensor",
      "boardA_8ch_analog_1_microwave_motion_sensor",
      "boardB_esp32_touch_event",
    ],
    prevNum(prevState, "curing_motion", 0),
    prevKnown(prevState, "curing_motion"),
    (value) => (value <= 1 ? value : scaleLinear(value, 0, 4095, 0, 1)),
  );
  const mqGas = readScaledSignal(
    raw,
    [
      "boardA_metaloxide_sensor",
      "boardA_8ch_analog_1_metaloxide_sensor",
      "boardB_esp32_bme_gas",
      "boardB_esp32_voc",
      "boardB_esp32_co",
      "boardB_esp32_no2",
      "boardB_esp32_alcohol",
    ],
    prevNum(prevState, "mixing_mq", 0),
    prevKnown(prevState, "mixing_mq"),
    (value, key) => {
      if (key.startsWith("boardB_esp32_") && value <= 1000) return value;
      if (value <= 100) return value;
      return scaleLinear(value, 0, 5000, 0, 100);
    },
  );
  const turbidity = readScaledSignal(
    raw,
    ["boardA_turbidity_sensor", "boardA_8ch_analog_1_turbidity_sensor"],
    prevNum(prevState, "mixing_turbidity", 0),
    prevKnown(prevState, "mixing_turbidity"),
    (value) => (value <= 100 ? value : scaleLinear(value, 0, 5000, 0, 50)),
  );
  const light = readScaledSignal(
    raw,
    ["boardA_light_sensor", "boardA_8ch_analog_1_light_sensor"],
    prevNum(prevState, "forming_light", 0),
    prevKnown(prevState, "forming_light"),
    (value) => (value <= 1000 ? value : scaleLinear(value, 0, 5000, 0, 1000)),
  );
  const orp = readScaledSignal(
    raw,
    ["boardA_orp_sensor", "boardA_8ch_analog_1_orp_sensor"],
    prevNum(prevState, "mixing_orp", 0),
    prevKnown(prevState, "mixing_orp"),
    (value) =>
      value >= -500 && value <= 500 ? value : scaleLinear(value, 0, 5000, 0, 400),
  );
  const oxygen = readScaledSignal(
    raw,
    ["boardB_esp32_oxygen_percent"],
    prevNum(prevState, "curing_o2", 0),
    prevKnown(prevState, "curing_o2"),
    (value) => (value <= 25 ? value : scaleLinear(value, 0, 5000, 0, 25)),
  );
  const lidar = readScaledSignal(
    raw,
    ["boardB_esp32_distance_cm"],
    prevNum(prevState, "quality_lidar", 0),
    prevKnown(prevState, "quality_lidar"),
    (value) => (value <= 50 ? value : scaleLinear(value, 0, 100, 0, 50)),
  );
  const fingerprint = readScaledSignal(
    raw,
    ["boardB_esp32_finger_match", "boardB_esp32_finger_conf", "boardB_esp32_finger_id"],
    prevNum(prevState, "intake_fingerprint", 0),
    prevKnown(prevState, "intake_fingerprint"),
    (value) => (value <= 1 ? value : value > 0 ? 1 : 0),
  );
  const water = readScaledSignal(
    raw,
    [
      // New flat payload — Board B's 8-channel analog water-leakage probe.
      "boardB_analog_8ch_b_water_leakage_sensor",
      "boardB_esp32_water",
    ],
    prevNum(prevState, "pkg_water", 0),
    prevKnown(prevState, "pkg_water"),
    (value) => (value <= 1 ? value : scaleLinear(value, 0, 5000, 0, 1)),
  );
  // Fire / smoke detector (boardB_analog_8ch_b_fire_sensor). Raw ADC on a
  // 12-bit channel — values ≥ ~3000 indicate smoke / flame.
  const fire = readScaledSignal(
    raw,
    ["boardB_analog_8ch_b_fire_sensor"],
    prevNum(prevState, "fire", 0),
    prevKnown(prevState, "fire"),
    (value) => (value <= 100 ? value : scaleLinear(value, 0, 4095, 0, 100)),
  );
  // System-wide emergency-stop latch from the PLC firmware.
  const systemEmergencyStop = readBitSignal(
    raw,
    ["system_was_in_emergency_stop_state"],
    false,
    false,
  );
  const auxGps = readScaledSignal(
    raw,
    ["boardA_voltage_pot_2"],
    prevNum(prevState, "intake_gps", 0),
    prevKnown(prevState, "intake_gps"),
    (value) => (value <= 5 ? scaleLinear(value, 0, 5, 0, 100) : scaleLinear(value, 0, 5000, 0, 100)),
  );

  collectFallbackDebug(
    raw,
    "voltage",
    ["boardA_voltage_pot_1", "voltage_pot"],
    voltage.hasReal,
    voltage.value,
    debugEvents,
  );
  collectFallbackDebug(
    raw,
    "current",
    ["boardA_current_pot", "current_pot"],
    current.hasReal,
    current.value,
    debugEvents,
  );
  collectFallbackDebug(
    raw,
    "temperature",
    ["boardA_temperature", "boardB_esp32_temperature", "temperature"],
    temperature.hasReal,
    temperature.value,
    debugEvents,
  );
  collectFallbackDebug(
    raw,
    "photoelectric",
    ["boardA_photoelectric_sensor", "photoE_sensor"],
    photoE.hasReal,
    photoE.value,
    debugEvents,
  );
  collectFallbackDebug(
    raw,
    "metal",
    ["boardA_metal_sensor", "boardB_io_metal_sensor", "boardB_8ch_io_metal_sensor", "metal_sensor"],
    metal.hasReal,
    metal.value,
    debugEvents,
  );
  collectFallbackDebug(
    raw,
    "push_button",
    [
      "boardA_green_push_button",
      "boardB_io_green_button",
      "boardB_io_push_lock_button",
      "boardB_8ch_io_green_button",
      "boardB_8ch_io_push_lock_button",
      "push_button",
    ],
    pushButton.hasReal,
    pushButton.value,
    debugEvents,
  );
  collectFallbackDebug(
    raw,
    "forming_pressure",
    ["boardA_pressure_sensor", "boardA_8ch_analog_1_pressure_sensor", "boardB_esp32_pressure"],
    formingPressure.hasReal,
    formingPressure.value,
    debugEvents,
  );
  collectFallbackDebug(
    raw,
    "mixing_ph",
    ["boardA_ph_sensor", "boardA_8ch_analog_1_ph_sensor", "pH"],
    ph.hasReal,
    ph.value,
    debugEvents,
  );
  collectFallbackDebug(
    raw,
    "mixing_mq",
    [
      "boardA_metaloxide_sensor",
      "boardA_8ch_analog_1_metaloxide_sensor",
      "boardB_esp32_bme_gas",
      "boardB_esp32_voc",
      "boardB_esp32_co",
      "boardB_esp32_no2",
      "boardB_esp32_alcohol",
    ],
    mqGas.hasReal,
    mqGas.value,
    debugEvents,
  );
  collectFallbackDebug(
    raw,
    "quality_lidar",
    ["boardB_esp32_distance_cm"],
    lidar.hasReal,
    lidar.value,
    debugEvents,
  );

  const relayAccent = alertRed.value || alertBuzzer.value || alarmRelay.value
    ? "#ef4444"
    : alertYellow.value
      ? "#f59e0b"
      : alertGreen.value
        ? "#10b981"
        : "#64748b";
  const relayStatus = alertRed.value || alertBuzzer.value || alarmRelay.value
    ? "critical"
    : alertYellow.value
      ? "warning"
      : "normal";

  const params: PLCParameter[] = [
    analogParam({
      id: "voltage",
      label: "Voltage",
      value: voltage.value,
      hasReal: voltage.hasReal,
      unit: "V",
      min: 0,
      max: 12,
      nominal: 5.0,
      decimals: 1,
      accentHex: "#f59e0b",
    }),
    analogParam({
      id: "current",
      label: "Current",
      value: current.value,
      hasReal: current.hasReal,
      unit: "A",
      min: 0,
      max: 10,
      nominal: 6.0,
      decimals: 1,
      accentHex: "#06b6d4",
    }),
    {
      id: "relay",
      label: "Relay",
      kind: "relay",
      active: true,
      accentHex: relayAccent,
      status: relayStatus,
      placeholder: false,
    },
    analogParam({
      id: "ph",
      label: "pH",
      value: ph.value,
      hasReal: ph.hasReal,
      unit: "",
      min: 0,
      max: 14,
      nominal: 7.0,
      decimals: 1,
      accentHex: "#8b5cf6",
    }),
    digitalParam({
      id: "photoE",
      label: "Photo-E",
      active: photoE.value,
      hasReal: photoE.hasReal,
      accentHex: "#10b981",
    }),
    digitalParam({
      id: "metal",
      label: "Metal Det.",
      active: metal.value,
      hasReal: metal.hasReal,
      accentHex: "#f97316",
    }),
    analogParam({
      id: "temperature",
      label: "Temperature",
      value: temperature.value,
      hasReal: temperature.hasReal,
      unit: "°C",
      min: 0,
      max: 100,
      nominal: 25,
      decimals: 1,
      accentHex: "#ef4444",
    }),
    analogParam({
      id: "mixing_ph",
      label: "Mixing pH",
      value: ph.value,
      hasReal: ph.hasReal,
      unit: "",
      min: 0,
      max: 14,
      nominal: 7,
      decimals: 1,
      accentHex: "#8b5cf6",
    }),
    analogParam({
      id: "mixing_orp",
      label: "Mixing ORP",
      value: orp.value,
      hasReal: orp.hasReal,
      unit: "mV",
      min: -500,
      max: 500,
      nominal: 200,
      decimals: 0,
      accentHex: "#22c55e",
    }),
    analogParam({
      id: "mixing_turbidity",
      label: "Mixing Turbidity",
      value: turbidity.value,
      hasReal: turbidity.hasReal,
      unit: "NTU",
      min: 0,
      max: 100,
      nominal: 15,
      decimals: 1,
      accentHex: "#06b6d4",
    }),
    analogParam({
      id: "mixing_mq",
      label: "Mixing MQ Gas",
      value: mqGas.value,
      hasReal: mqGas.hasReal,
      unit: "ppm",
      min: 0,
      max: 1000,
      nominal: 50,
      decimals: 1,
      accentHex: "#f97316",
    }),
    analogParam({
      id: "forming_pressure",
      label: "Forming Pressure",
      value: formingPressure.value,
      hasReal: formingPressure.hasReal,
      unit: "bar",
      min: 0,
      max: 200,
      nominal: 65,   // Normal operating range is 60–80 bar
      decimals: 1,
      accentHex: "#3b82f6",
    }),
    analogParam({
      id: "forming_light",
      label: "Forming Light",
      value: light.value,
      hasReal: light.hasReal,
      unit: "lux",
      min: 0,
      max: 1000,
      nominal: 500,
      decimals: 0,
      accentHex: "#eab308",
    }),
    analogParam({
      id: "curing_o2",
      label: "Curing O2",
      value: oxygen.value,
      hasReal: oxygen.hasReal,
      unit: "%",
      min: 0,
      max: 25,
      nominal: 20.9,
      decimals: 1,
      accentHex: "#10b981",
    }),
    analogParam({
      id: "curing_mq",
      label: "Curing MQ Gas",
      value: mqGas.value,
      hasReal: mqGas.hasReal,
      unit: "ppm",
      min: 0,
      max: 1000,
      nominal: 30,
      decimals: 1,
      accentHex: "#f59e0b",
    }),
    analogParam({
      id: "curing_motion",
      label: "Curing Motion",
      value: microwaveMotion.value,
      hasReal: microwaveMotion.hasReal,
      unit: "",
      min: 0,
      max: 1,
      nominal: 0,
      decimals: 1,
      accentHex: "#22c55e",
    }),
    analogParam({
      id: "quality_lidar",
      label: "Quality LiDAR",
      value: lidar.value,
      hasReal: lidar.hasReal,
      unit: "mm",
      min: 0,
      max: 50,
      nominal: 0.5,
      decimals: 1,
      accentHex: "#f59e0b",
    }),
    analogParam({
      id: "quality_light",
      label: "Quality Light",
      value: light.value,
      hasReal: light.hasReal,
      unit: "lux",
      min: 0,
      max: 1000,
      nominal: 600,
      decimals: 0,
      accentHex: "#eab308",
    }),
    analogParam({
      id: "quality_turbidity",
      label: "Quality Turbidity",
      value: turbidity.value,
      hasReal: turbidity.hasReal,
      unit: "NTU",
      min: 0,
      max: 100,
      nominal: 5,
      decimals: 1,
      accentHex: "#06b6d4",
    }),
    analogParam({
      id: "pkg_motion",
      label: "Packaging Motion",
      value: microwaveMotion.value,
      hasReal: microwaveMotion.hasReal,
      unit: "",
      min: 0,
      max: 1,
      nominal: 0,
      decimals: 1,
      accentHex: "#22c55e",
    }),
    analogParam({
      id: "pkg_pressure",
      label: "Packaging Pressure",
      value: formingPressure.value,
      hasReal: formingPressure.hasReal,
      unit: "bar",
      min: 0,
      max: 100,
      nominal: 65,   // Normal operating range is 60–80 bar
      decimals: 1,
      accentHex: "#3b82f6",
    }),
    analogParam({
      id: "pkg_water",
      label: "Packaging Water",
      value: water.value,
      hasReal: water.hasReal,
      unit: "",
      min: 0,
      max: 1,
      nominal: 0,
      decimals: 1,
      accentHex: "#0ea5e9",
    }),
    analogParam({
      id: "fire",
      label: "Fire / Smoke",
      value: fire.value,
      hasReal: fire.hasReal,
      unit: "",
      min: 0,
      max: 100,
      nominal: 0,
      decimals: 0,
      accentHex: "#ef4444",
    }),
    analogParam({
      id: "intake_gps",
      label: "Intake GPS",
      value: auxGps.value,
      hasReal: auxGps.hasReal,
      unit: "m",
      min: 0,
      max: 100,
      nominal: 50,
      decimals: 1,
      accentHex: "#22c55e",
    }),
    analogParam({
      id: "dispatch_gps",
      label: "Dispatch GPS",
      value: auxGps.value,
      hasReal: auxGps.hasReal,
      unit: "m",
      min: 0,
      max: 100,
      nominal: 50,
      decimals: 1,
      accentHex: "#22c55e",
    }),
    analogParam({
      id: "intake_lidar",
      label: "Intake LiDAR",
      value: lidar.value,
      hasReal: lidar.hasReal,
      unit: "mm",
      min: 0,
      max: 50,
      nominal: 25,
      decimals: 1,
      accentHex: "#f59e0b",
    }),
    analogParam({
      id: "intake_fingerprint",
      label: "Intake Fingerprint",
      value: fingerprint.value,
      hasReal: fingerprint.hasReal,
      unit: "",
      min: 0,
      max: 1,
      nominal: 1,
      decimals: 1,
      accentHex: "#10b981",
    }),
    analogParam({
      id: "dispatch_fingerprint",
      label: "Dispatch Fingerprint",
      value: fingerprint.value,
      hasReal: fingerprint.hasReal,
      unit: "",
      min: 0,
      max: 1,
      nominal: 1,
      decimals: 1,
      accentHex: "#10b981",
    }),
  ];

  const relay = [
    motorRelay.value,
    alarmRelay.value,
    alertRed.value,
    alertYellow.value,
    alertGreen.value,
    alertBuzzer.value,
    pushButton.value,
    metal.value,
  ];

  if (debugEvents.length > 0) {
    plcWarn("Fallbacks applied for plc/data payload", debugEvents);
  }

  const now = Date.now();
  if (PLC_DEBUG && now - lastPLCParseLogAt > 1000) {
    lastPLCParseLogAt = now;
    plcDebug("Parsed plc/data payload", {
      keys: Object.keys(raw),
      analog: {
        voltage: voltage.value,
        current: current.value,
        temperature: temperature.value,
        ph: ph.value,
        pressure: formingPressure.value,
        mqGas: mqGas.value,
      },
      outputs: {
        motorFanOn: motorRelay.value,
        emergencyLightOn:
          alarmRelay.value ||
          alertRed.value ||
          alertBuzzer.value ||
          systemEmergencyStop.value,
        photoESensor: photoE.value,
        metalSensor: metal.value,
        rfidAuthorized: rfidAuthorized.value,
        pushButton: pushButton.value,
        alerts: [alertRed.value, alertYellow.value, alertBuzzer.value, alarmRelay.value],
      },
    });
  }

  return {
    params,
    outputs: {
      motorFanOn: motorRelay.value,
      emergencyLightOn:
        alarmRelay.value ||
        alertRed.value ||
        alertBuzzer.value ||
        systemEmergencyStop.value,
      photoESensor: photoE.value,
      metalSensor: metal.value,
      rfidAuthorized: rfidAuthorized.value,
      relay,
      pushButton: pushButton.value,
      alerts: [alertRed.value, alertYellow.value, alertBuzzer.value, alarmRelay.value],
    },
  };
}

/* ── Interface ─────────────────────────────────────────── */

export interface PLCService {
  subscribe(onUpdate: (state: PLCState) => void): () => void;
  sendCommand(deviceId: string, command: Record<string, unknown>): Promise<void>;
  fetchCurrentState(): Promise<PLCState>;
}

/* ── Mock implementation ──────────────────────────────── */

export class MockPLCService implements PLCService {
  private params: PLCParameter[] = plcParameters.map((p) => ({ ...p }));
  private outputs: PLCOutputs = {
    ...DEFAULT_OUTPUTS,
    // Derive initial motor fan state from Photo-E default
    motorFanOn: plcParameters.find((p) => p.id === "photoE")?.active ?? false,
    photoESensor: plcParameters.find((p) => p.id === "photoE")?.active ?? false,
    metalSensor: plcParameters.find((p) => p.id === "metal")?.active ?? false,
  };
  private listeners: Set<(state: PLCState) => void> = new Set();

  subscribe(onUpdate: (state: PLCState) => void): () => void {
    this.listeners.add(onUpdate);
    onUpdate(this.getState());
    return () => {
      this.listeners.delete(onUpdate);
    };
  }

  async sendCommand(deviceId: string, command: Record<string, unknown>): Promise<void> {
    await new Promise((r) => setTimeout(r, 150));

    if (deviceId === "motor_fan" && command.action === "toggle") {
      const newVal = !this.outputs.motorFanOn;
      const relay = [...this.outputs.relay];
      relay[0] = newVal;
      this.outputs = { ...this.outputs, motorFanOn: newVal, relay };
      this.notify();
      return;
    }

    const idx = this.params.findIndex((p) => p.id === deviceId);
    if (idx !== -1 && this.params[idx].kind === "digital") {
      const param = this.params[idx];
      const newActive = !param.active;
      this.params = this.params.map((p, i) =>
        i === idx ? { ...p, active: newActive } : p
      );

      if (deviceId === "photoE") {
        this.outputs = { ...this.outputs, motorFanOn: newActive, photoESensor: newActive };
        // Sync relay card color with photoE state
        const relayIdx = this.params.findIndex((p) => p.id === "relay");
        if (relayIdx !== -1) {
          this.params = this.params.map((p, i) =>
            i === relayIdx ? { ...p, accentHex: deriveRelayColor(newActive) } : p
          );
        }
      } else if (deviceId === "metal") {
        this.outputs = { ...this.outputs, metalSensor: newActive };
      }

      this.notify();
    }
  }

  async fetchCurrentState(): Promise<PLCState> {
    return this.getState();
  }

  private getState(): PLCState {
    return { params: [...this.params], outputs: { ...this.outputs } };
  }

  private notify() {
    const state = this.getState();
    this.listeners.forEach((cb) => cb(state));
  }
}

/* ── IoT Core Direct (browser → MQTT/WSS → IoT Core) ── */

export class IoTCorePLCService implements PLCService {
  private client: import("mqtt").MqttClient | null = null;
  private listeners: Set<(state: PLCState) => void> = new Set();
  private lastState: PLCState | null = null;
  private pendingRaw: RawPLCPayload | null = null;
  private flushTimer: ReturnType<typeof setTimeout> | null = null;
  private readonly endpoint: string;
  private readonly identityPoolId: string;
  private readonly region: string;
  private readonly attachPolicyUrl: string;

  constructor(endpoint: string, identityPoolId: string, region: string, attachPolicyUrl: string) {
    this.endpoint = endpoint;
    this.identityPoolId = identityPoolId;
    this.region = region;
    this.attachPolicyUrl = attachPolicyUrl;
  }

  subscribe(onUpdate: (state: PLCState) => void): () => void {
    this.listeners.add(onUpdate);

    if (this.lastState) {
      onUpdate(this.lastState);
    }

    if (!this.client) {
      this.connect();
    }

    return () => {
      this.listeners.delete(onUpdate);
      if (this.listeners.size === 0) {
        this.disconnect();
      }
    };
  }

  async sendCommand(deviceId: string, command: Record<string, unknown>): Promise<void> {
    if (!this.client || !this.client.connected) {
      throw new Error("Not connected to IoT Core");
    }
    const payload = JSON.stringify({ deviceId, ...command });
    this.client.publish("plc/cmd", payload);
  }

  async fetchCurrentState(): Promise<PLCState> {
    if (this.lastState) return this.lastState;
    return {
      params: plcParameters.map((p) => ({ ...p })),
      outputs: { ...DEFAULT_OUTPUTS },
    };
  }

  private async connect() {
    try {
      const { fromCognitoIdentityPool } = await import("@aws-sdk/credential-providers");
      const { CognitoIdentityClient, GetIdCommand } = await import("@aws-sdk/client-cognito-identity");
      const mqttModule = await import("mqtt");
      const mqttConnect = mqttModule.connect ?? mqttModule.default?.connect ?? mqttModule.default;

      // 1. Get Cognito identity ID
      const cognitoClient = new CognitoIdentityClient({ region: this.region });
      const { IdentityId: identityId } = await cognitoClient.send(
        new GetIdCommand({ IdentityPoolId: this.identityPoolId })
      );
      console.log("[IoTCore] Identity ID:", identityId);

      // 2. Attach IoT policy to this identity (via REST endpoint)
      if (this.attachPolicyUrl) {
        try {
          await fetch(this.attachPolicyUrl, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ identityId }),
          });
          console.log("[IoTCore] Policy attached to identity");
        } catch (err) {
          console.warn("[IoTCore] Policy attach failed (may already be attached):", err);
        }
      }

      // 3. Get credentials
      const credentialProvider = fromCognitoIdentityPool({
        identityPoolId: this.identityPoolId,
        clientConfig: { region: this.region },
      });
      const credentials = await credentialProvider();

      // 4. Build signed URL and connect
      const url = await this.buildSignedUrl(credentials);
      const clientId = `dashboard-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

      this.client = mqttConnect(url, {
        clientId,
        clean: true,
        reconnectPeriod: 5000,
        connectTimeout: 10000,
        protocolVersion: 4,
        protocolId: "MQTT",
        createWebsocket: (wsUrl: string) => new WebSocket(wsUrl, ["mqtt"]),
      });

      this.client.on("connect", () => {
        console.log("[IoTCore] Connected — direct MQTT, no Lambda delay");
        this.client!.subscribe("plc/data", { qos: 0 }, (err) => {
          if (err) console.error("[IoTCore] Subscribe error:", err);
          else console.log("[IoTCore] Subscribed to plc/data");
        });
      });

      this.client.on("message", (_topic: string, payload: Buffer) => {
        try {
          this.pendingRaw = JSON.parse(payload.toString()) as RawPLCPayload;
          if (!this.flushTimer) {
            this.flushTimer = setTimeout(() => {
              this.flushTimer = null;
              if (!this.pendingRaw) return;
              const state = parsePLCPayload(this.pendingRaw, this.lastState);
              this.pendingRaw = null;
              this.lastState = state;
              this.listeners.forEach((cb) => cb(state));
            }, 50);
          }
        } catch (err) {
          console.error("[IoTCore] Parse error:", err);
        }
      });

      this.client.on("error", (err: Error) => {
        console.error("[IoTCore] Error:", err);
      });

      this.client.on("close", () => {
        console.log("[IoTCore] Disconnected");
      });
    } catch (err) {
      console.error("[IoTCore] Connection setup failed:", err);
    }
  }

  private async buildSignedUrl(credentials: { accessKeyId: string; secretAccessKey: string; sessionToken?: string }): Promise<string> {
    // IoT Core WebSocket uses SigV4 WITHOUT X-Amz-Expires (unlike standard presigning).
    // We must sign manually since SignatureV4.presign() always adds X-Amz-Expires.
    const { Sha256 } = await import("@aws-crypto/sha256-js");

    const now = new Date();
    const amzDate = now.toISOString().replace(/[-:]/g, "").split(".")[0] + "Z";
    const dateShort = amzDate.slice(0, 8);
    const scope = `${dateShort}/${this.region}/iotdevicegateway/aws4_request`;

    // Query params — NO X-Amz-Expires (IoT Core rejects it)
    const params: Record<string, string> = {
      "X-Amz-Algorithm": "AWS4-HMAC-SHA256",
      "X-Amz-Credential": `${credentials.accessKeyId}/${scope}`,
      "X-Amz-Date": amzDate,
      "X-Amz-SignedHeaders": "host",
    };
    if (credentials.sessionToken) {
      params["X-Amz-Security-Token"] = credentials.sessionToken;
    }

    const canonicalQS = Object.keys(params)
      .sort()
      .map((k) => `${encodeURIComponent(k)}=${encodeURIComponent(params[k])}`)
      .join("&");

    const canonicalRequest = [
      "GET",
      "/mqtt",
      canonicalQS,
      `host:${this.endpoint}\n`,
      "host",
      "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
    ].join("\n");

    // Hash the canonical request
    const crHash = new Sha256();
    crHash.update(canonicalRequest);
    const crDigest = toHex(await crHash.digest());

    const stringToSign = `AWS4-HMAC-SHA256\n${amzDate}\n${scope}\n${crDigest}`;

    // Derive signing key: HMAC chain
    const kDate = await hmacSha256(Sha256, `AWS4${credentials.secretAccessKey}`, dateShort);
    const kRegion = await hmacSha256(Sha256, kDate, this.region);
    const kService = await hmacSha256(Sha256, kRegion, "iotdevicegateway");
    const kSigning = await hmacSha256(Sha256, kService, "aws4_request");

    const signature = toHex(await hmacSha256(Sha256, kSigning, stringToSign));

    return `wss://${this.endpoint}/mqtt?${canonicalQS}&X-Amz-Signature=${signature}`;
  }

  private disconnect() {
    if (this.flushTimer) {
      clearTimeout(this.flushTimer);
      this.flushTimer = null;
    }
    if (this.client) {
      this.client.end(true);
      this.client = null;
    }
  }
}

// HMAC-SHA256 using @aws-crypto/sha256-js (pass key as string or Uint8Array)
async function hmacSha256(
  Sha256: new (key: Uint8Array) => { update(data: string): void; digest(): Promise<Uint8Array> },
  key: string | Uint8Array,
  data: string
): Promise<Uint8Array> {
  const keyBytes = typeof key === "string" ? new TextEncoder().encode(key) : key;
  const h = new Sha256(keyBytes);
  h.update(data);
  return h.digest();
}

function toHex(buf: Uint8Array): string {
  return Array.from(buf)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

/* ── AWS implementation (API Gateway + IoT Core) ──────── */

export class AWSPLCService implements PLCService {
  private ws: WebSocket | null = null;
  private listeners: Set<(state: PLCState) => void> = new Set();
  private lastState: PLCState | null = null;
  private pendingData: RawPLCPayload | PLCState | null = null;
  private pendingIsRaw = false;
  private flushTimer: ReturnType<typeof setTimeout> | null = null;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private disconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private readonly apiUrl: string;
  private readonly wsUrl: string;

  constructor(apiUrl: string, wsUrl: string) {
    this.apiUrl = apiUrl;
    this.wsUrl = wsUrl;
  }

  subscribe(onUpdate: (state: PLCState) => void): () => void {
    this.listeners.add(onUpdate);

    // Cancel any pending disconnect (React StrictMode remount)
    if (this.disconnectTimer) {
      clearTimeout(this.disconnectTimer);
      this.disconnectTimer = null;
    }

    if (!this.ws || this.ws.readyState === WebSocket.CLOSED) {
      this.connect();
    }

    return () => {
      this.listeners.delete(onUpdate);
      if (this.listeners.size === 0) {
        // Delay disconnect to survive React StrictMode unmount/remount
        this.disconnectTimer = setTimeout(() => {
          if (this.listeners.size === 0) this.disconnect();
        }, 1000);
      }
    };
  }

  async sendCommand(deviceId: string, command: Record<string, unknown>): Promise<void> {
    const res = await fetch(`${this.apiUrl}/command`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ deviceId, ...command }),
    });
    if (!res.ok) {
      throw new Error(`Command failed: ${res.status} ${res.statusText}`);
    }
  }

  async fetchCurrentState(): Promise<PLCState> {
    const res = await fetch(`${this.apiUrl}/state`);
    if (!res.ok) {
      throw new Error(`Fetch state failed: ${res.status}`);
    }
    return res.json();
  }

  private connect() {
    this.ws = new WebSocket(this.wsUrl);

    this.ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        const isRaw = isRawPLCPayload(data);
        this.pendingData = data;
        this.pendingIsRaw = isRaw;

        if (!this.flushTimer) {
          this.flushTimer = setTimeout(() => {
            this.flushTimer = null;
            if (!this.pendingData) return;
            const state = this.pendingIsRaw
              ? parsePLCPayload(this.pendingData as RawPLCPayload, this.lastState)
              : this.pendingData as PLCState;
            this.pendingData = null;
            this.lastState = state;
            this.listeners.forEach((cb) => cb(state));
          }, 50);
        }
      } catch {
        console.error("[AWSPLCService] Failed to parse WebSocket message");
      }
    };

    this.ws.onclose = () => {
      if (this.listeners.size > 0) {
        this.reconnectTimer = setTimeout(() => this.connect(), 3000);
      }
    };

    this.ws.onerror = (err) => {
      console.error("[AWSPLCService] WebSocket error:", err);
      this.ws?.close();
    };
  }

  private disconnect() {
    if (this.flushTimer) {
      clearTimeout(this.flushTimer);
      this.flushTimer = null;
    }
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
  }
}

/* ── Mosquitto via local bridge (browser → WS → bridge → MQTT broker) ── */

export class MosquittoPLCService implements PLCService {
  private ws: WebSocket | null = null;
  private listeners: Set<(state: PLCState) => void> = new Set();
  private lastState: PLCState | null = null;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private disconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private pendingRaw: RawPLCPayload | null = null;
  private flushTimer: ReturnType<typeof setTimeout> | null = null;
  private readonly wsUrl: string;

  constructor(wsUrl: string) {
    this.wsUrl = wsUrl;
  }

  subscribe(onUpdate: (state: PLCState) => void): () => void {
    this.listeners.add(onUpdate);

    if (this.disconnectTimer) {
      clearTimeout(this.disconnectTimer);
      this.disconnectTimer = null;
    }

    if (this.lastState) {
      onUpdate(this.lastState);
    }

    if (!this.ws || this.ws.readyState === WebSocket.CLOSED) {
      this.connect();
    }

    return () => {
      this.listeners.delete(onUpdate);
      if (this.listeners.size === 0) {
        this.disconnectTimer = setTimeout(() => {
          if (this.listeners.size === 0) this.disconnect();
        }, 1000);
      }
    };
  }

  async sendCommand(deviceId: string, command: Record<string, unknown>): Promise<void> {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      throw new Error("Not connected to MQTT bridge");
    }
    const topic = (command._topic as string) ?? "plc/cmd";
    const rawPayload = command._rawPayload as Record<string, unknown> | undefined;
    if (rawPayload) {
      this.ws.send(JSON.stringify({ topic, payload: rawPayload }));
    } else {
      const rest = { ...command };
      delete (rest as { _topic?: unknown })._topic;
      delete (rest as { _rawPayload?: unknown })._rawPayload;
      this.ws.send(JSON.stringify({ topic, payload: { deviceId, ...rest } }));
    }
  }

  async fetchCurrentState(): Promise<PLCState> {
    if (this.lastState) return this.lastState;
    return {
      params: plcParameters.map((p) => ({ ...p })),
      outputs: { ...DEFAULT_OUTPUTS },
    };
  }

  private connect() {
    this.ws = new WebSocket(this.wsUrl);

    this.ws.onopen = () => {
      console.log("[Mosquitto] Connected to bridge at", this.wsUrl);
    };

    this.ws.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data as string) as { topic: string; payload: unknown };
        if (msg.topic !== "plc/data") return;

        // Always keep the latest raw payload — never drop a message
        this.pendingRaw = msg.payload as RawPLCPayload;

        // Flush on a 50ms timer so we batch rapid bursts but never lose state
        if (!this.flushTimer) {
          this.flushTimer = setTimeout(() => {
            this.flushTimer = null;
            if (!this.pendingRaw) return;
            const state = parsePLCPayload(this.pendingRaw, this.lastState);
            this.pendingRaw = null;
            this.lastState = state;
            this.listeners.forEach((cb) => cb(state));
          }, 50);
        }
      } catch (err) {
        console.error("[Mosquitto] Parse error:", err);
      }
    };

    this.ws.onclose = () => {
      console.log("[Mosquitto] Disconnected from bridge");
      if (this.listeners.size > 0) {
        this.reconnectTimer = setTimeout(() => this.connect(), 3000);
      }
    };

    this.ws.onerror = (err) => {
      console.error("[Mosquitto] WebSocket error:", err);
      this.ws?.close();
    };
  }

  private disconnect() {
    if (this.flushTimer) {
      clearTimeout(this.flushTimer);
      this.flushTimer = null;
    }
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
  }
}

/* ── Factory ───────────────────────────────────────────── */

export function createPLCService(): PLCService {
  const mode = import.meta.env.VITE_PLC_MODE ?? "mock";

  if (mode === "iotcore") {
    const endpoint = import.meta.env.VITE_IOT_ENDPOINT;
    const identityPoolId = import.meta.env.VITE_COGNITO_IDENTITY_POOL_ID;
    const region = import.meta.env.VITE_AWS_REGION ?? "us-east-1";
    const attachPolicyUrl = import.meta.env.VITE_ATTACH_POLICY_URL ?? "";
    if (!endpoint || !identityPoolId) {
      console.warn("[PLCService] IoT Core mode requested but config missing, falling back to mock");
      return new MockPLCService();
    }
    return new IoTCorePLCService(endpoint, identityPoolId, region, attachPolicyUrl);
  }

  if (mode === "mosquitto") {
    const bridgeUrl = import.meta.env.VITE_MQTT_BRIDGE_URL ?? `ws://${window.location.hostname}:9001`;
    return new MosquittoPLCService(bridgeUrl);
  }

  if (mode === "aws") {
    const apiUrl = import.meta.env.VITE_AWS_API_GATEWAY_URL;
    const wsUrl = import.meta.env.VITE_AWS_WS_URL;
    if (!apiUrl || !wsUrl) {
      console.warn("[PLCService] AWS mode requested but URLs not configured, falling back to mock");
      return new MockPLCService();
    }
    return new AWSPLCService(apiUrl, wsUrl);
  }

  return new MockPLCService();
}