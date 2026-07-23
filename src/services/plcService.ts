import type { PLCParameter } from "../types";
import { plcParameters } from "../data/mockData";
import { latencyMonitor } from "./latencyMonitor";

/* ── PLC telemetry topics ────────────────────────────────
 * The PLC publishes its data split across per-source subtopics of this base
 * (UNS layout): data/boardA, data/boardB, data/esp32, data/system_metrics.
 * Each message carries only that source's keys, so transports subscribe to
 * the `/#` wildcard and merge partial payloads before parsing. Both transport
 * paths (direct IoT Core subscription and the Mosquitto WS bridge filter)
 * key off these constants — change them here when the plant/line topology
 * moves.
 */
export const PLC_DATA_TOPIC = "prplHome/McKinney/lineA/plc1/data";
// `base/#` also matches the base topic itself per the MQTT spec, so an
// unsplit publish on the bare data topic still comes through.
export const PLC_DATA_TOPIC_FILTER = `${PLC_DATA_TOPIC}/#`;

/** True for the base data topic and any of its per-source subtopics. */
export function isPLCDataTopic(topic: string): boolean {
  return topic === PLC_DATA_TOPIC || topic.startsWith(`${PLC_DATA_TOPIC}/`);
}

/* ── Raw MQTT payload from the PLC data topic ────────────── */

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
  // Flat payload keys — board A relays + analog channels (current schema).
  boardA_rfid_authorized_user?: number;
  boardA_relay_motor?: number;
  boardA_relay_alarm?: number;
  boardA_voltage_pot_2?: number;
  boardA_pressure_sensor?: number;
  boardA_microwave_motion_sensor?: number;
  boardA_ph_sensor?: number;
  boardA_metaloxide_sensor?: number;
  boardA_turbidity_sensor?: number;
  boardA_light_sensor?: number;
  boardA_orp_sensor?: number;
  // Board B IO — flat names (current schema).
  boardB_io_metal_sensor?: number;
  boardB_io_green_button?: number;
  boardB_io_push_lock_button?: number;
  boardB_io_output_red?: number;
  boardB_io_output_yellow?: number;
  boardB_io_output_green?: number;
  boardB_io_output_buzzer?: number;
  // Board B analog extras
  boardB_analog_8ch_b_fire_sensor?: number;
  boardB_analog_8ch_b_water_leakage_sensor?: number;
  // Shelly proEM 3-phase power meter — current payload publishes per-phase
  // (a/b/c) channels, a neutral current, and pre-summed totals. The relay
  // state remains a single bit. The older single-channel keys (temperature,
  // freq, plain _act_power/_current/_voltage/_pf) are kept below as legacy
  // fallbacks for older firmware that still ships the aggregated shape.
  boardB_shellypro3em_data_a_act_power?: number;
  boardB_shellypro3em_data_a_aprt_power?: number;
  boardB_shellypro3em_data_a_current?: number;
  boardB_shellypro3em_data_a_pf?: number;
  boardB_shellypro3em_data_a_voltage?: number;
  boardB_shellypro3em_data_b_act_power?: number;
  boardB_shellypro3em_data_b_aprt_power?: number;
  boardB_shellypro3em_data_b_current?: number;
  boardB_shellypro3em_data_b_pf?: number;
  boardB_shellypro3em_data_b_voltage?: number;
  boardB_shellypro3em_data_c_act_power?: number;
  boardB_shellypro3em_data_c_aprt_power?: number;
  boardB_shellypro3em_data_c_current?: number;
  boardB_shellypro3em_data_c_pf?: number;
  boardB_shellypro3em_data_c_voltage?: number;
  boardB_shellypro3em_data_n_current?: number;
  boardB_shellypro3em_data_total_act_power?: number;
  boardB_shellypro3em_data_total_aprt_power?: number;
  boardB_shellypro3em_data_total_current?: number;
  boardB_shellypro3em_relay_1_state?: number;
  // Legacy single-channel proEM keys (pre-2026-04 firmware)
  boardB_shellyproem_data_temperature?: number;
  boardB_shellyproem_data_act_power?: number;
  boardB_shellyproem_data_aprt_power?: number;
  boardB_shellyproem_data_current?: number;
  boardB_shellyproem_data_voltage?: number;
  boardB_shellyproem_data_freq?: number;
  boardB_shellyproem_data_pf?: number;
  // Shelly Pro3 — 3-channel relay device with built-in metering
  boardB_shelly_pro3_data_temperature?: number;
  boardB_shelly_pro3_data_act_power?: number;
  boardB_shelly_pro3_data_aprt_power?: number;
  boardB_shelly_pro3_data_current?: number;
  boardB_shelly_pro3_data_voltage?: number;
  boardB_shelly_pro3_data_freq?: number;
  boardB_shelly_pro3_data_pf?: number;
  boardB_shelly_pro3_relay_1_state?: number;
  boardB_shelly_pro3_relay_2_state?: number;
  boardB_shelly_pro3_relay_3_state?: number;
  // Shelly Pro2PM — 2-channel metering relay
  boardB_shelly_pro2pm_data_temperature?: number;
  boardB_shelly_pro2pm_data_act_power?: number;
  boardB_shelly_pro2pm_data_aprt_power?: number;
  boardB_shelly_pro2pm_data_current?: number;
  boardB_shelly_pro2pm_data_voltage?: number;
  boardB_shelly_pro2pm_data_freq?: number;
  boardB_shelly_pro2pm_data_pf?: number;
  boardB_shelly_pro2pm_relay_1_state?: number;
  boardB_shelly_pro2pm_relay_2_state?: number;
  // Latched system-level E-stop state (clears RFID authorization client-side)
  system_was_in_emergency_stop_state?: number;
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
  // Aggregate OEE metrics — published on the PLC data topic as shift-rollup values
  // alongside (or instead of) raw sensor channels. Consumed by the OEE
  // dashboard via subscribeRawPLCPayload.
  OEE?: number;
  availability?: number;
  performance?: number;
  quality?: number;
  total_units_produced?: number;
  uptime_in_minutes?: number;
  downtime_in_minutes?: number;
}

/* ── Raw payload broadcaster ──────────────────────────────
 * Not every PLC data publish is sensor-shaped. Aggregate metrics (OEE,
 * availability, uptime) ride the same topic under different keys, so we
 * broadcast the raw object to any interested subscriber before the sensor
 * parser reduces it to typed PLCParameter rows. Used by the OEE dashboard.
 */
type RawPLCPayloadListener = (payload: RawPLCPayload) => void;
const rawPLCPayloadListeners = new Set<RawPLCPayloadListener>();

export function subscribeRawPLCPayload(cb: RawPLCPayloadListener): () => void {
  rawPLCPayloadListeners.add(cb);
  return () => {
    rawPLCPayloadListeners.delete(cb);
  };
}

function emitRawPLCPayload(payload: RawPLCPayload) {
  for (const cb of rawPLCPayloadListeners) cb(payload);
}

/* ── KOS topic broadcaster ───────────────────────────────
 * AWS IoT publishes dispenser/vending events on `KOS/*` topics on the same
 * broker the bridge already subscribes to. The MosquittoPLCService.onmessage
 * handler routes any topic starting with "kos" (case-insensitive) here, so
 * widgets like KOSDispenseWidget can subscribe without parsing PLC frames.
 */
export type KOSMessageListener = (topic: string, payload: unknown) => void;
const kosMessageListeners = new Set<KOSMessageListener>();

export function subscribeKOSMessage(cb: KOSMessageListener): () => void {
  kosMessageListeners.add(cb);
  return () => {
    kosMessageListeners.delete(cb);
  };
}

function emitKOSMessage(topic: string, payload: unknown) {
  for (const cb of kosMessageListeners) cb(topic, payload);
}

/* ── LoRaWAN topic broadcaster ───────────────────────────
 * Soil moisture / irrigation sensors publish on `lorawan/data` (forwarded
 * from the LoRaWAN gateway through the local broker). Payload shape:
 *   { timestamp, device_name, dev_eui, soil_temp_c, soil_moisture_pct,
 *     conductivity_us_cm, battery_v }
 * The useLorawanSensors hook fans these out per-device.
 */
export type LorawanMessageListener = (topic: string, payload: unknown) => void;
const lorawanMessageListeners = new Set<LorawanMessageListener>();

export function subscribeLorawanMessage(cb: LorawanMessageListener): () => void {
  lorawanMessageListeners.add(cb);
  return () => {
    lorawanMessageListeners.delete(cb);
  };
}

function emitLorawanMessage(topic: string, payload: unknown) {
  for (const cb of lorawanMessageListeners) cb(topic, payload);
}

/* ── Any-message broadcaster ─────────────────────────────
 * The UNS explorer builds the namespace tree straight from broker traffic,
 * so it needs every envelope the transport sees — including topics no other
 * widget consumes. Emitted before the per-prefix routing, on both the
 * Mosquitto WS path and the direct IoT Core path.
 */
export type AnyMessageListener = (topic: string, payload: unknown) => void;
const anyMessageListeners = new Set<AnyMessageListener>();

export function subscribeAnyMessage(cb: AnyMessageListener): () => void {
  anyMessageListeners.add(cb);
  return () => {
    anyMessageListeners.delete(cb);
  };
}

function emitAnyMessage(topic: string, payload: unknown) {
  for (const cb of anyMessageListeners) cb(topic, payload);
}

// Module-level memory of the previous E-stop signal state. Used to detect
// the rising edge (inactive → active) for the RFID latch clear path, so a
// firmware-side latched "was in emergency" bit doesn't keep re-clearing the
// authorized state on every subsequent tick.
let lastEstopSignal = false;

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
  max: number,
  warningFrac = 0.2,
  criticalFrac = 0.4,
): "normal" | "warning" | "critical" {
  const range = max - min;
  if (range === 0) return "normal";
  const deviation = Math.abs(value - nominal) / range;
  if (deviation > criticalFrac) return "critical";
  if (deviation > warningFrac) return "warning";
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

/**
 * Normalise any MQTT-friendly scalar-ish value into a number. Supports:
 *   - number          → returned as-is
 *   - [number, ...]   → first element (legacy array payload format)
 *   - boolean         → 1 / 0          (firmware sometimes publishes bits as bool)
 *   - "1" / "0"       → 1 / 0          (JSON-as-string edge cases)
 *   - "true" / "false" → 1 / 0         (same, different encoding)
 *   - "authorized" / "unauthorized" → 1 / 0   (semantic RFID states)
 *   - "on" / "off"    → 1 / 0          (relay convention)
 *
 * Everything else returns null, which tells the reader "no real data here,
 * keep the previous value".
 */
function scalar(rawValue: unknown): number | null {
  if (typeof rawValue === "number" && Number.isFinite(rawValue)) return rawValue;
  if (typeof rawValue === "boolean") return rawValue ? 1 : 0;
  if (typeof rawValue === "string") {
    const trimmed = rawValue.trim().toLowerCase();
    if (trimmed === "true" || trimmed === "on" || trimmed === "authorized" || trimmed === "yes") return 1;
    if (trimmed === "false" || trimmed === "off" || trimmed === "unauthorized" || trimmed === "no") return 0;
    const n = Number(trimmed);
    if (Number.isFinite(n)) return n;
  }
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
  /** Optional override for the warning trigger (fraction of range from nominal).
   *  Default 0.2 means a deviation >20% of (max-min) raises a warning. Raise
   *  this for sensors with naturally wide normal swings (e.g. ambient light). */
  warningFrac?: number;
  /** Optional override for the critical trigger. Default 0.4. */
  criticalFrac?: number;
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
      ? deriveStatus(
          config.value,
          config.nominal,
          config.min,
          config.max,
          config.warningFrac,
          config.criticalFrac,
        )
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
    "boardA_ph_sensor",
    "boardA_pressure_sensor",
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
    ["boardA_ph_sensor", "boardA_ph_sensor", "pH"],
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
    // keys. The legacy `boardB_io_metal_sensor` key was dropped from the
    // payload; we stop reading it here (it's still sent on plc/control for
    // firmware compatibility).
    ["boardA_metal_sensor", "boardB_io_metal_sensor", "metal_sensor"],
    prevBit(prevState, "metal", false),
    prevKnown(prevState, "metal"),
  );
  // RFID — authorizes operator badge at the intake gate. When this reads 0 the
  // digital twin forces the intake stage into "idle" (line cannot start).
  //
  // The key list covers the firmware variations we've seen in the wild:
  // the canonical `boardA_rfid_authorized_user` plus common alternates that
  // some PLC builds publish (`rfid`, `rfid_authorized`, `rfid_authorised`,
  // `authorized`, `badge`). Values may arrive as number/bool/string — the
  // scalar() helper normalises all of them.
  const rfidAuthorized = readBitSignal(
    raw,
    [
      "boardA_rfid_authorized_user",
      "rfid_authorized_user",
      "rfid_authorized",
      "rfid_authorised",
      "rfidAuthorized",
      "rfid",
      "authorized",
      "badge",
    ],
    prevState?.outputs.rfidAuthorized ?? false,
    prevState?.outputs.rfidAuthorized !== undefined,
  );
  // Latch logic is applied below (after alert/buzzer reads) so an explicit
  // operator E-stop can still clear authorization. The firmware transiently
  // republishes rfid_authorized=0 when the physical green start button is
  // pressed, which would otherwise drop the line back to idle every time the
  // operator starts production; the latch keeps the badge state sticky.
  const pushButton = readBitSignal(
    raw,
    [
      "boardA_green_push_button",
      "boardB_io_green_button",
      "push_button",
    ],
    prevState?.outputs.pushButton ?? false,
    prevState?.outputs.pushButton !== undefined,
  );

  // Physical E-stop (push-lock) button — a dedicated digital input, distinct
  // from the green start button. Reads from every push-lock variant the PLC
  // firmware may publish. Used below to clear the RFID latch so the line
  // returns to "awaiting badge" as soon as the operator hits E-stop.
  const estopButton = readBitSignal(
    raw,
    [
      "boardB_io_push_lock_button",
      "boardB_io_push_lock_button",
      "boardA_push_lock_button",
      "push_lock_button",
    ],
    false,
    false,
  );
  // ── Relay / alert reads from plc/data ──
  // plc/data publishes the new flat keys only (boardA_relay_motor,
  // boardA_relay_alarm, boardA_alert_relays_*, boardB_io_output_*). The
  // `boardA_relay_*` and `boardB_io_*` names are no longer in the
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

  // RFID latch — once authorized, hold true until a real E-stop event.
  //
  // The raw payload transiently drops rfid_authorized_user to 0 when the
  // operator presses the physical green start button; without this latch
  // the line would fall back to idle on every start press.
  //
  // System-level E-stop state from the PLC itself. This is the latched
  // "emergency stop active" bit the controller maintains after an operator
  // pushes the physical lock button. It stays true until the operator resets
  // the lock, which is exactly the behaviour we want for clearing the RFID
  // authorization client-side.
  const systemEstop = readBitSignal(
    raw,
    [
      "system_was_in_emergency_stop_state",
      "system_in_emergency_stop_state",
      "system_emergency_stop",
    ],
    false,
    false,
  );

  // RFID authorization latch — rising-edge detection on E-stop signals.
  //
  // Why rising-edge instead of "currently active"?
  // `system_was_in_emergency_stop_state` is a **latched** firmware bit: it
  // sticks at 1 after an emergency occurs and stays there until the PLC
  // program explicitly resets it, which can be long after the operator has
  // physically reset the push-lock button. If we cleared RFID on every tick
  // where that bit is high, the operator could never re-authorize — because
  // scanning the badge would set rfidAuthorized to true for one tick, and
  // the very next tick would clear it again.
  //
  // By detecting the rising edge (previously false, now true) we fire the
  // clear exactly ONCE when the E-stop actually triggers. Subsequent ticks
  // with the bit still latched are no-ops, and the latch re-holds the
  // authorized state the moment the operator scans a new badge.
  //
  // We also suppress the clear while the green start button is pressed —
  // some firmware pulses the E-stop bits as an "arming" artifact during
  // green press, which would otherwise drop the line back to idle.
  const greenPressed = pushButton.value === true;
  const estopSignalNow = systemEstop.value === true || estopButton.value === true;
  const estopSignalPrev = lastEstopSignal;
  lastEstopSignal = estopSignalNow;
  const estopRisingEdge = estopSignalNow && !estopSignalPrev;
  if (estopRisingEdge && !greenPressed) {
    rfidAuthorized.value = false;
  } else {
    rfidAuthorized.value =
      rfidAuthorized.value || (prevState?.outputs.rfidAuthorized ?? false);
  }

  // Pressure: new payload uses `boardA_pressure_sensor` (raw 12-bit ADC,
  // ~0–4095 → scaled to 0–200 bar). Keep the legacy key + boardB ESP32 key
  // as fallbacks for older deployments.
  const formingPressure = readScaledSignal(
    raw,
    [
      "boardA_pressure_sensor",
      "boardA_pressure_sensor",
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
      "boardA_microwave_motion_sensor",
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
      "boardA_metaloxide_sensor",
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
    ["boardA_turbidity_sensor", "boardA_turbidity_sensor"],
    prevNum(prevState, "mixing_turbidity", 0),
    prevKnown(prevState, "mixing_turbidity"),
    (value) => (value <= 100 ? value : scaleLinear(value, 0, 5000, 0, 50)),
  );
  const light = readScaledSignal(
    raw,
    ["boardA_light_sensor", "boardA_light_sensor"],
    prevNum(prevState, "forming_light", 0),
    prevKnown(prevState, "forming_light"),
    (value) => (value <= 1000 ? value : scaleLinear(value, 0, 5000, 0, 1000)),
  );
  const orp = readScaledSignal(
    raw,
    ["boardA_orp_sensor", "boardA_orp_sensor"],
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
    ["boardA_metal_sensor", "boardB_io_metal_sensor", "boardB_io_metal_sensor", "metal_sensor"],
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
      "boardB_io_green_button",
      "boardB_io_push_lock_button",
      "push_button",
    ],
    pushButton.hasReal,
    pushButton.value,
    debugEvents,
  );
  collectFallbackDebug(
    raw,
    "forming_pressure",
    ["boardA_pressure_sensor", "boardA_pressure_sensor", "boardB_esp32_pressure"],
    formingPressure.hasReal,
    formingPressure.value,
    debugEvents,
  );
  collectFallbackDebug(
    raw,
    "mixing_ph",
    ["boardA_ph_sensor", "boardA_ph_sensor", "pH"],
    ph.hasReal,
    ph.value,
    debugEvents,
  );
  collectFallbackDebug(
    raw,
    "mixing_mq",
    [
      "boardA_metaloxide_sensor",
      "boardA_metaloxide_sensor",
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
    // `system_emergency_stop` — surfaces the latched PLC-level E-stop state
    // as a PLCParameter so SENSOR_FALLBACKS can route the three stage-level
    // E-stop sensors (forming_estop / mixing_estop / pkg_estop) to it. When
    // the operator hits the physical push-lock, this bit goes high, each
    // stage's emergency_stop sensor picks it up as a "critical" reading,
    // and evaluateThresholds' sensorEstopActive guard freezes the whole line.
    digitalParam({
      id: "system_emergency_stop",
      label: "System E-Stop",
      active: systemEmergencyStop.value,
      hasReal: systemEmergencyStop.hasReal,
      accentHex: "#ef4444",
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
      // Indoor / factory-floor illuminance swings widely (200–1000 lux is
      // routinely normal). Widen the tolerance so common bright readings
      // like 870 lux don't trip a warning.
      warningFrac: 0.45,
      criticalFrac: 0.65,
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
      // Inspection-lane lighting follows the same wide-tolerance reasoning
      // as forming_light above.
      warningFrac: 0.45,
      criticalFrac: 0.65,
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
      // Inverted semantics: high reading = safe, low reading = smoke / flame.
      // Nominal sits near the top of the range and the wide tolerance keeps
      // the param GREEN in the normal "no fire" band; readings only flag
      // critical once they drop below ~60 (i.e. real smoke detection).
      nominal: 95,
      decimals: 0,
      accentHex: "#ef4444",
      warningFrac: 0.20,
      criticalFrac: 0.35,
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
  // Union of the latest values from every per-source subtopic slice (boardA /
  // boardB / esp32 / system_metrics). Must persist across flushes: each slice
  // carries only its own keys, so a per-flush reset hands the parser a single
  // slice and lets lower-priority fallback keys win — signals with cross-board
  // fallbacks (MQ gas, pressure) then alternate between different physical
  // sensors on every message.
  private mergedRaw: RawPLCPayload = {};
  private hasUnflushed = false;
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
        this.client!.subscribe(PLC_DATA_TOPIC_FILTER, { qos: 0 }, (err) => {
          if (err) console.error("[IoTCore] Subscribe error:", err);
          else console.log(`[IoTCore] Subscribed to ${PLC_DATA_TOPIC_FILTER}`);
        });
      });

      this.client.on("message", (topic: string, payload: Buffer) => {
        try {
          const incoming = JSON.parse(payload.toString()) as RawPLCPayload;
          emitAnyMessage(topic, incoming);
          // Fold this slice into the persistent union. Fresh object each time
          // so subscribers holding the previous frame never see it mutate.
          this.mergedRaw = { ...this.mergedRaw, ...incoming };
          this.hasUnflushed = true;

          // Latency measurement: the bridge stamps `_bridgeTs` (epoch ms) when
          // it republishes plc/data to IoT Core. Read it off the incoming slice
          // — not the union, where a stale stamp would be re-recorded on every
          // later message — to get bridge → IoT Core → browser latency.
          latencyMonitor.record(
            (incoming as { _bridgeTs?: number })._bridgeTs,
            "iotcore",
          );

          // Broadcast the raw payload to non-sensor subscribers (OEE dashboard,
          // KPI tiles) before the sensor parser reduces it. plc/data carries the
          // shift-rollup OEE fields alongside the sensor channels, so this must
          // fire on the IoTCore path too — not just the Mosquitto bridge path.
          emitRawPLCPayload(this.mergedRaw);

          // Coalesce ~20 ms of arrivals into one parse/render — bounded, so no
          // perceptible delay is added; matches the Mosquitto bridge path.
          if (!this.flushTimer) {
            this.flushTimer = setTimeout(() => {
              this.flushTimer = null;
              if (!this.hasUnflushed) return;
              this.hasUnflushed = false;
              const state = parsePLCPayload(this.mergedRaw, this.lastState);
              this.lastState = state;
              this.listeners.forEach((cb) => cb(state));
            }, 20);
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
  // Persistent union of the per-source subtopic slices — see the field note on
  // IoTCorePLCService.mergedRaw. Resetting this per flush made cross-board
  // fallback signals (MQ gas, pressure) alternate between physical sensors.
  private mergedRaw: RawPLCPayload = {};
  private hasUnflushed = false;
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
        const msg = JSON.parse(event.data as string) as {
          topic: string;
          payload: unknown;
          publishedAt?: number;
        };

        if (msg.topic) emitAnyMessage(msg.topic, msg.payload);

        // KOS topics (forwarded from AWS IoT by the bridge) take a separate
        // route — they're consumed by the dispenser widget, not the PLC
        // sensor parser. Match `kos/...` and `KOS/...` (case-insensitive,
        // also tolerant of dot-separated topic styles).
        if (msg.topic && /^kos[\/.]/i.test(msg.topic)) {
          emitKOSMessage(msg.topic, msg.payload);
          return;
        }

        // LoRaWAN soil/irrigation telemetry (lorawan/data + any subtopic).
        if (msg.topic && /^lorawan[\/.]/i.test(msg.topic)) {
          emitLorawanMessage(msg.topic, msg.payload);
          return;
        }

        if (!msg.topic || !isPLCDataTopic(msg.topic)) return;

        // Latency measurement: the bridge stamps `publishedAt` (epoch ms) on
        // the WS envelope when it forwards PLC data. Gives the local
        // bridge → WS → browser baseline to compare against the iotcore path.
        latencyMonitor.record(msg.publishedAt, "mosquitto");

        // Fold this slice into the persistent union. Fresh object each time
        // so subscribers holding the previous frame never see it mutate.
        // Never drop a message.
        this.mergedRaw = { ...this.mergedRaw, ...(msg.payload as RawPLCPayload) };
        this.hasUnflushed = true;

        // Broadcast the raw payload to non-sensor subscribers (OEE dashboard,
        // KPI tiles) before the sensor parser reduces it.
        emitRawPLCPayload(this.mergedRaw);

        // Flush within ~20 ms. Intentionally aggressive — PLCContext has its
        // own rAF coalesce layer above this that bundles rapid successive
        // updates into a single React commit, so we don't need to batch
        // heavily here. Keeping this window short means the instant an
        // operator turns a pot, the voltage/current widgets on the PLC
        // Parameters panel update in < 40 ms end-to-end.
        if (!this.flushTimer) {
          this.flushTimer = setTimeout(() => {
            this.flushTimer = null;
            if (!this.hasUnflushed) return;
            this.hasUnflushed = false;
            const state = parsePLCPayload(this.mergedRaw, this.lastState);
            this.lastState = state;
            this.listeners.forEach((cb) => cb(state));
          }, 20);
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

/** Resolve the bridge WS URL from where the page is served: dev hosts
 *  (localhost / LAN) talk straight to the bridge on port 9001; anything
 *  public goes through the nginx `/ws` proxy on the same origin, so the
 *  build survives EC2 hostname changes without a rebuild. */
function defaultBridgeUrl(): string {
  const { protocol, hostname, host } = window.location;
  const isLocal =
    hostname === "localhost" ||
    hostname === "127.0.0.1" ||
    /^192\.168\./.test(hostname) ||
    /^10\./.test(hostname);
  if (isLocal) return `ws://${hostname}:9001`;
  return `${protocol === "https:" ? "wss:" : "ws:"}//${host}/ws`;
}

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
    // `||` (not `??`): an empty VITE_MQTT_BRIDGE_URL in .env.production means
    // "auto-detect" — Vite bakes it in as "", which is not nullish.
    const bridgeUrl = import.meta.env.VITE_MQTT_BRIDGE_URL || defaultBridgeUrl();
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