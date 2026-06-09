/**
 * Digital Twin Layout
 *
 * Stage positions, sensor placement offsets, conveyor t-values,
 * and threshold configurations for the manufacturing pipeline.
 */
import type {
  StageConfig,
  StageId,
  SensorConfig,
  OutputDeviceConfig,
  ThresholdEffect,
} from "../../types/digitalTwin";

// ── Stage positions along the zig-zag conveyor (x, y, z) ──
//
// Real Pepsi bottling sequence:
//   INTAKE → BLOW MOLDING → FILLING → COOLING → QC → PACKING → DISPATCH
//
// Row 1 (z=8):  INTAKE ────── BLOW MOLDING ──────┐
//                                                 │ turn
// Row 2 (z=0):  COOLING ←──── FILLING ───────────┘
//   │
//   └──── Row 3 (z=-8): QC ── CASE PACKING ── DISPATCH
//
// Note: internal IDs stay "mixing"/"forming"/"curing" for sensor/scenario
// backwards-compatibility. Only the physical positions + visual labels change.
//
export const STAGE_POSITIONS: Record<StageId, [number, number, number]> = {
  intake:    [ -13,  0.5,  8],   // Row 1 left — PET resin intake
  forming:   [   0,  0.5,  8],   // Row 1 center — blow molding (was "mixing" position)
  mixing:    [   6,  0.5,  0],   // Row 2 right — Pepsi filling (was "forming" position)
  curing:    [  -4,  0.5,  0],   // Row 2 left — cooling tunnel
  quality:   [  -6,  0.5, -8],   // Row 3 left — quality inspection
  packaging: [   4,  0.5, -8],   // Row 3 center — case packing
  dispatch:  [  14,  0.5, -8],   // Row 3 right — shipping dock
};

// Parametric t-values (0–1) along the zig-zag conveyor path.
// Ordered by the REAL Pepsi bottling sequence:
//   intake → forming(blow mold) → mixing(filling) → curing(cooling) → ...
export const STAGE_CONVEYOR_T: Record<StageId, number> = {
  intake:    0.04,   // Row 1 left — pellets enter
  forming:   0.18,   // Row 1 center — blow molding
  mixing:    0.40,   // Row 2 right — Pepsi filling
  curing:    0.55,   // Row 2 left — cooling tunnel
  quality:   0.72,   // Row 3 left — quality inspection
  packaging: 0.85,   // Row 3 center — case packing
  dispatch:  0.96,   // Row 3 right — shipping dock
};

// ── Sensor offset positions relative to stage center ───────
// [dx, dy, dz] — sensors are mounted on an archway over the belt.
// Eight slots (two rows × four columns) so a stage can carry up to 8
// distinct inputs after the V2 sensor expansion.
export const SENSOR_OFFSETS: [number, number, number][] = [
  [-0.45, 1.6,  0.5],   // Slot 0 — front row, far left
  [-0.15, 1.6,  0.5],   // Slot 1 — front row, center-left
  [ 0.15, 1.6,  0.5],   // Slot 2 — front row, center-right
  [ 0.45, 1.6,  0.5],   // Slot 3 — front row, far right
  [-0.45, 1.6, -0.5],   // Slot 4 — rear row, far left
  [-0.15, 1.6, -0.5],   // Slot 5 — rear row, center-left
  [ 0.15, 1.6, -0.5],   // Slot 6 — rear row, center-right
  [ 0.45, 1.6, -0.5],   // Slot 7 — rear row, far right
];

// ── Device offset positions relative to stage center ───────
export const DEVICE_OFFSETS: [number, number, number][] = [
  [-0.6, 0.6,  0.6],   // Slot 0 — left side
  [ 0.6, 0.6,  0.6],   // Slot 1 — right side
  [ 0.0, 0.4, -0.7],   // Slot 2 — rear center
];

// ── Stage Colors ───────────────────────────────────────────
export const STAGE_STATUS_COLORS: Record<string, { hex: string; emissive: number }> = {
  idle:    { hex: "#6b7280", emissive: 0x6b7280 },
  running: { hex: "#10b981", emissive: 0x10b981 },
  warning: { hex: "#f59e0b", emissive: 0xf59e0b },
  faulted: { hex: "#ef4444", emissive: 0xef4444 },
  blocked: { hex: "#8b5cf6", emissive: 0x8b5cf6 },
};

// ── Sensor Configurations per Stage ────────────────────────

const INTAKE_SENSORS: SensorConfig[] = [
  { sensorId: "intake_gps",         type: "gps",         label: "GPS",          unit: "m",   min: 0, max: 100, nominal: 50,  warningThreshold: 70,  criticalThreshold: 90,  volatility: 0.5 },
  { sensorId: "intake_fingerprint", type: "fingerprint",  label: "Fingerprint",  unit: "",    min: 0, max: 1,   nominal: 1,   warningThreshold: 0.5, criticalThreshold: 0.2, volatility: 0.1 },
  { sensorId: "intake_lidar",       type: "lidar",        label: "LiDAR",        unit: "mm",  min: 0, max: 50,  nominal: 25,  warningThreshold: 35,  criticalThreshold: 45,  volatility: 0.8 },
  // V2 additions
  { sensorId: "intake_rfid",        type: "rfid",         label: "RFID",         unit: "",    min: 0, max: 1,   nominal: 1,   warningThreshold: 0.5, criticalThreshold: 0.2, volatility: 0.1 },
  { sensorId: "intake_optical",     type: "optical",      label: "Crate Optical",unit: "",    min: 0, max: 1,   nominal: 1,   warningThreshold: 0.5, criticalThreshold: 0.2, volatility: 0.1 },
];

const MIXING_SENSORS: SensorConfig[] = [
  { sensorId: "mixing_ph",          type: "ph",           label: "pH",          unit: "",     min: 0,   max: 14,   nominal: 7.0,  warningThreshold: 9.0,  criticalThreshold: 10.0, volatility: 0.3 },
  { sensorId: "mixing_orp",         type: "orp",          label: "ORP",         unit: "mV",   min: -500, max: 500, nominal: 200,  warningThreshold: 350,  criticalThreshold: 420,  volatility: 5.0 },
  { sensorId: "mixing_turbidity",   type: "turbidity",    label: "Turbidity",   unit: "NTU",  min: 0,   max: 100,  nominal: 15,   warningThreshold: 50,   criticalThreshold: 75,   volatility: 2.0 },
  { sensorId: "mixing_mq",          type: "mq_gas",       label: "MQ Gas",      unit: "ppm",  min: 0,   max: 1000, nominal: 50,   warningThreshold: 300,  criticalThreshold: 500,  volatility: 8.0 },
  // V2 additions — syrup tank level, flow, valve feedback, E-stop
  { sensorId: "mixing_water_level", type: "water_level",  label: "Syrup Tank",  unit: "%",    min: 0,   max: 100,  nominal: 75,   warningThreshold: 30,   criticalThreshold: 15,   volatility: 1.0 },
  { sensorId: "mixing_flow_liquid", type: "flow_liquid",  label: "Syrup Flow",  unit: "L/min",min: 0,   max: 60,   nominal: 40,   warningThreshold: 20,   criticalThreshold: 10,   volatility: 2.0 },
  { sensorId: "mixing_valve",       type: "valve_signal", label: "Fill Valve",  unit: "%",    min: 0,   max: 100,  nominal: 80,   warningThreshold: 50,   criticalThreshold: 25,   volatility: 1.5 },
  { sensorId: "mixing_estop",       type: "emergency_stop", label: "E-Stop",    unit: "",     min: 0,   max: 1,    nominal: 0,    warningThreshold: 0.5,  criticalThreshold: 0.9,  volatility: 0.0 },
];

const FORMING_SENSORS: SensorConfig[] = [
  // Normal operating range is 60–80 bar. Warning triggers below 50 bar, critical below 30 bar.
  // Only "below" thresholds are active — high pressure does NOT stop production.
  { sensorId: "forming_pressure",  type: "pressure",        label: "Pressure",        unit: "bar",  min: 0,  max: 200,  nominal: 65,   warningThreshold: 50,   criticalThreshold: 30,   volatility: 3.0 },
  { sensorId: "forming_light",     type: "light_intensity", label: "Light Intensity", unit: "lux",  min: 0,  max: 1000, nominal: 500,  warningThreshold: 200,  criticalThreshold: 100,  volatility: 10.0 },
  // V2 additions — preform presence, blow-mold air, operator E-stop
  { sensorId: "forming_proximity", type: "proximity",       label: "Preform Prox.",   unit: "",     min: 0,  max: 1,    nominal: 1,    warningThreshold: 0.5,  criticalThreshold: 0.2,  volatility: 0.1 },
  { sensorId: "forming_flow_air",  type: "flow_air",        label: "Blow Air",        unit: "SCFM", min: 0,  max: 200,  nominal: 150,  warningThreshold: 100,  criticalThreshold: 70,   volatility: 3.0 },
  { sensorId: "forming_estop",     type: "emergency_stop",  label: "E-Stop",          unit: "",     min: 0,  max: 1,    nominal: 0,    warningThreshold: 0.5,  criticalThreshold: 0.9,  volatility: 0.0 },
];

const CURING_SENSORS: SensorConfig[] = [
  { sensorId: "curing_o2",       type: "o2",               label: "O2",          unit: "%",    min: 0, max: 25,   nominal: 20.9, warningThreshold: 18.0, criticalThreshold: 16.0, volatility: 0.4 },
  { sensorId: "curing_mq",       type: "mq_gas",           label: "MQ Gas",      unit: "ppm",  min: 0, max: 1000, nominal: 30,   warningThreshold: 300,  criticalThreshold: 500,  volatility: 6.0 },
  { sensorId: "curing_motion",   type: "microwave_motion", label: "Motion",      unit: "",     min: 0, max: 1,    nominal: 0,    warningThreshold: 0.7,  criticalThreshold: 0.9,  volatility: 0.15 },
  // V2 additions — fire detection in oven, cooling airflow
  // Fire sensor publishes HIGH when everything is fine (95 ± a bit) and DROPS
  // when fire/smoke is detected. nominal=95, warning fires below 90,
  // critical/emergency-stop fires below 75.
  { sensorId: "curing_fire",     type: "fire",             label: "Fire",        unit: "",     min: 0, max: 100,  nominal: 95,   warningThreshold: 90,   criticalThreshold: 75,   volatility: 0.3 },
  { sensorId: "curing_flow_air", type: "flow_air",         label: "Cooling Air", unit: "SCFM", min: 0, max: 300,  nominal: 220,  warningThreshold: 150,  criticalThreshold: 100,  volatility: 4.0 },
];

const QUALITY_SENSORS: SensorConfig[] = [
  { sensorId: "quality_lidar",     type: "lidar",           label: "LiDAR",           unit: "mm",  min: 0, max: 50,   nominal: 0.5,  warningThreshold: 1.5,  criticalThreshold: 2.0,  volatility: 0.2 },
  { sensorId: "quality_light",     type: "light_intensity", label: "Light Intensity", unit: "lux", min: 0, max: 1000, nominal: 600,  warningThreshold: 250,  criticalThreshold: 150,  volatility: 8.0 },
  { sensorId: "quality_turbidity", type: "turbidity",       label: "Turbidity",       unit: "NTU", min: 0, max: 100,  nominal: 5,    warningThreshold: 30,   criticalThreshold: 50,   volatility: 1.5 },
  // V2 addition — photoelectric beam-break for bottle pass/fail counting
  { sensorId: "quality_optical",   type: "optical",         label: "Optical",         unit: "",    min: 0, max: 1,    nominal: 1,    warningThreshold: 0.5,  criticalThreshold: 0.2,  volatility: 0.1 },
];

const PACKAGING_SENSORS: SensorConfig[] = [
  { sensorId: "pkg_motion",    type: "microwave_motion", label: "Motion",     unit: "",    min: 0, max: 1,   nominal: 0,  warningThreshold: 0.7, criticalThreshold: 0.9, volatility: 0.15 },
  // Normal operating range is 60–80 bar. Warning triggers below 50 bar, critical below 30 bar.
  // Only "below" thresholds are active — high pressure does NOT stop production.
  { sensorId: "pkg_pressure",  type: "pressure",         label: "Pressure",   unit: "bar", min: 0, max: 100, nominal: 65, warningThreshold: 50,  criticalThreshold: 30,  volatility: 2.0 },
  // Water-leakage probe. In the current rig this analog channel sits at its
  // full-scale 1.0 (stuck/floating high) with no real leak present, which used
  // to fault Packaging and fire the emergency light. Thresholds raised above
  // the sensor's 0–1 range so a normal/maxed reading reads "normal" instead of
  // false-alarming. Lower these back toward 0.3 / 0.6 to re-arm leak detection.
  { sensorId: "pkg_water",     type: "water",            label: "Water",      unit: "",    min: 0, max: 1,   nominal: 0,  warningThreshold: 1.1, criticalThreshold: 1.2, volatility: 0.08 },
  // V2 additions — case presence, fire detection, operator E-stop
  { sensorId: "pkg_proximity", type: "proximity",        label: "Case Prox.", unit: "",    min: 0, max: 1,   nominal: 1,  warningThreshold: 0.5, criticalThreshold: 0.2, volatility: 0.1 },
  // Fire: high = safe, low = fire detected. See curing_fire for rationale.
  { sensorId: "pkg_fire",      type: "fire",             label: "Fire",       unit: "",    min: 0, max: 100, nominal: 95, warningThreshold: 90,  criticalThreshold: 75,  volatility: 0.3 },
  { sensorId: "pkg_estop",     type: "emergency_stop",   label: "E-Stop",     unit: "",    min: 0, max: 1,   nominal: 0,  warningThreshold: 0.5, criticalThreshold: 0.9, volatility: 0.0 },
];

const DISPATCH_SENSORS: SensorConfig[] = [
  { sensorId: "dispatch_gps",         type: "gps",              label: "GPS",         unit: "m", min: 0, max: 100, nominal: 50, warningThreshold: 70,  criticalThreshold: 90,  volatility: 0.5 },
  { sensorId: "dispatch_fingerprint", type: "fingerprint",      label: "Fingerprint", unit: "",  min: 0, max: 1,   nominal: 1,  warningThreshold: 0.5, criticalThreshold: 0.2, volatility: 0.1 },
  // V2 additions — RFID for pallet/truck tag read, capacitive confirm pad
  { sensorId: "dispatch_rfid",        type: "rfid",             label: "RFID",        unit: "",  min: 0, max: 1,   nominal: 1,  warningThreshold: 0.5, criticalThreshold: 0.2, volatility: 0.1 },
  { sensorId: "dispatch_touch",       type: "capacitive_touch", label: "Confirm Pad", unit: "",  min: 0, max: 1,   nominal: 1,  warningThreshold: 0.5, criticalThreshold: 0.2, volatility: 0.1 },
];

// ── Output Device Configurations per Stage ─────────────────

const INTAKE_DEVICES: OutputDeviceConfig[] = [
  { deviceId: "intake_switch",    type: "switch_4ep",      label: "Intake Switch",    defaultActive: true },
  { deviceId: "intake_emergency", type: "emergency_light",  label: "Emergency Light",  defaultActive: false },
];

const MIXING_DEVICES: OutputDeviceConfig[] = [
  { deviceId: "mixing_shelly", type: "shelly", label: "Mixer Relay",  defaultActive: true },
  { deviceId: "mixing_motor",  type: "motor",  label: "Mixer Motor",  defaultActive: true, defaultRpm: 120 },
];

const FORMING_DEVICES: OutputDeviceConfig[] = [
  { deviceId: "forming_motor",       type: "motor",             label: "Press Motor",     defaultActive: true, defaultRpm: 60 },
  // 3-phase blow-molder drive — metered by Shelly proEM. Live per-phase data
  // (boardB_shellyproem_data_a/b/c_*) is read by ThreePhaseMotorWidget.
  { deviceId: "forming_3phase_motor", type: "three_phase_motor", label: "3-Phase Motor",   defaultActive: true, defaultPowerW: 2200 },
  { deviceId: "forming_power",       type: "power_meter",       label: "Power Meter",     defaultActive: true, defaultPowerW: 1800 },
];

const CURING_DEVICES: OutputDeviceConfig[] = [
  { deviceId: "curing_shelly", type: "shelly", label: "Oven Relay",   defaultActive: true },
  { deviceId: "curing_motor",  type: "motor",  label: "Oven Fan",     defaultActive: true, defaultRpm: 200 },
];

const QUALITY_DEVICES: OutputDeviceConfig[] = [
  { deviceId: "quality_switch", type: "switch_4ep",  label: "QC Switch",    defaultActive: true },
  { deviceId: "quality_power",  type: "power_meter", label: "Power Meter",  defaultActive: true, defaultPowerW: 500 },
];

const PACKAGING_DEVICES: OutputDeviceConfig[] = [
  { deviceId: "pkg_motor",     type: "motor",           label: "Seal Motor",      defaultActive: true, defaultRpm: 90 },
  { deviceId: "pkg_emergency", type: "emergency_light", label: "Emergency Light",  defaultActive: false },
];

const DISPATCH_DEVICES: OutputDeviceConfig[] = [
  { deviceId: "dispatch_switch", type: "switch_4ep", label: "Gate Switch", defaultActive: true },
  { deviceId: "dispatch_shelly", type: "shelly",     label: "Gate Relay",  defaultActive: true },
];

// ── Threshold Effects ──────────────────────────────────────

const MIXING_EFFECTS: ThresholdEffect[] = [
  { sensorId: "mixing_ph",          condition: "above_critical", effect: "stop",            targetDeviceId: "mixing_motor", description: "pH critical — stop mixer motor",              qualityPenalty: 25 },
  { sensorId: "mixing_ph",          condition: "above_warning",  effect: "quality_degrade",                                   description: "pH elevated — quality degradation",            qualityPenalty: 10 },
  { sensorId: "mixing_orp",         condition: "above_warning",  effect: "slowdown",                                          description: "ORP elevated — reduce throughput",             qualityPenalty: 5  },
  { sensorId: "mixing_mq",          condition: "above_critical", effect: "emergency_stop",                                    description: "Gas detected — emergency stop",                qualityPenalty: 30 },
  // V2 effects
  { sensorId: "mixing_water_level", condition: "below_warning",  effect: "slowdown",                                          description: "Syrup tank low — reduce throughput",           qualityPenalty: 5  },
  { sensorId: "mixing_water_level", condition: "below_critical", effect: "stop",            targetDeviceId: "mixing_motor",   description: "Syrup tank critical — stop filling",           qualityPenalty: 20 },
  { sensorId: "mixing_flow_liquid", condition: "below_warning",  effect: "slowdown",                                          description: "Low syrup flow — reduce throughput",           qualityPenalty: 5  },
  { sensorId: "mixing_flow_liquid", condition: "below_critical", effect: "stop",            targetDeviceId: "mixing_motor",   description: "Flow lost — stop filler",                      qualityPenalty: 20 },
  { sensorId: "mixing_valve",       condition: "below_warning",  effect: "quality_degrade",                                   description: "Valve deviating from commanded position",      qualityPenalty: 10 },
  { sensorId: "mixing_valve",       condition: "below_critical", effect: "stop",            targetDeviceId: "mixing_motor",   description: "Valve stuck — stop filler",                    qualityPenalty: 20 },
  { sensorId: "mixing_estop",       condition: "above_critical", effect: "emergency_stop",                                    description: "Operator E-stop pressed — emergency shutdown", qualityPenalty: 30 },
];

const FORMING_EFFECTS: ThresholdEffect[] = [
  // Pressure: normal range is 60–80 bar. Below 50 bar halts the press immediately;
  // below 30 bar escalates to an emergency stop with alarm light.
  { sensorId: "forming_pressure",  condition: "below_warning",  effect: "stop",            targetDeviceId: "forming_motor", description: "Pressure below 50 bar — press halted",         qualityPenalty: 15 },
  { sensorId: "forming_pressure",  condition: "below_critical", effect: "emergency_stop",                                   description: "Pressure critically low — emergency stop",     qualityPenalty: 25 },
  { sensorId: "forming_light",     condition: "below_warning",  effect: "quality_degrade",                                  description: "Low light — inspection failure",               qualityPenalty: 15 },
  // V2 effects
  // Proximity = beam-break photoelectric. A momentary 0 is normal between
  // preform cycles, so we keep the effects "soft" — no hard stop, no
  // emergency light.
  { sensorId: "forming_proximity", condition: "below_warning",  effect: "quality_degrade",                                  description: "No preform under beam — quality watch",        qualityPenalty: 3  },
  { sensorId: "forming_proximity", condition: "below_critical", effect: "slowdown",                                         description: "Preform absent on press — slowdown",           qualityPenalty: 5  },
  { sensorId: "forming_flow_air",  condition: "below_warning",  effect: "stop",            targetDeviceId: "forming_motor", description: "Blow-mold air low — stop press",               qualityPenalty: 15 },
  { sensorId: "forming_flow_air",  condition: "below_critical", effect: "emergency_stop",                                   description: "Blow-mold air lost — emergency stop",          qualityPenalty: 25 },
  { sensorId: "forming_estop",     condition: "above_critical", effect: "emergency_stop",                                   description: "Operator E-stop pressed — emergency shutdown", qualityPenalty: 30 },
];

const CURING_EFFECTS: ThresholdEffect[] = [
  { sensorId: "curing_o2",       condition: "below_critical", effect: "emergency_stop",                                description: "Low O2 — emergency stop + lights",     qualityPenalty: 30 },
  { sensorId: "curing_o2",       condition: "below_warning",  effect: "slowdown",                                      description: "O2 dropping — reduce speed",           qualityPenalty: 5  },
  { sensorId: "curing_mq",       condition: "above_critical", effect: "emergency_stop",                                description: "Gas leak — emergency stop",            qualityPenalty: 30 },
  { sensorId: "curing_mq",       condition: "above_warning",  effect: "quality_degrade",                               description: "Gas detected — quality risk",          qualityPenalty: 10 },
  // V2 effects
  // Fire: value drops when fire is present. Below 90 → warning slowdown;
  // below 75 → emergency stop + lights.
  { sensorId: "curing_fire",     condition: "below_warning",  effect: "slowdown",                                      description: "Heat signature rising — slowdown",     qualityPenalty: 10 },
  { sensorId: "curing_fire",     condition: "below_critical", effect: "emergency_stop",                                description: "Fire detected — emergency stop",       qualityPenalty: 30 },
  { sensorId: "curing_flow_air", condition: "below_warning",  effect: "slowdown",                                      description: "Cooling airflow low — reduce speed",   qualityPenalty: 5  },
  { sensorId: "curing_flow_air", condition: "below_critical", effect: "stop",            targetDeviceId: "curing_motor", description: "Cooling airflow lost — stop oven fan", qualityPenalty: 20 },
];

const QUALITY_EFFECTS: ThresholdEffect[] = [
  { sensorId: "quality_lidar",     condition: "above_critical", effect: "quality_degrade", description: "Dimensional deviation — defective",        qualityPenalty: 30 },
  { sensorId: "quality_lidar",     condition: "above_warning",  effect: "quality_degrade", description: "Dimensional warning — minor defect",       qualityPenalty: 10 },
  { sensorId: "quality_turbidity", condition: "above_critical", effect: "stop",            description: "Contamination detected — stop line",       qualityPenalty: 25 },
  // V2 effect — optical beam-break for bottle pass/fail counting.
  // Beam clear is normal between bottles, so use soft effects only.
  { sensorId: "quality_optical",   condition: "below_warning",  effect: "quality_degrade", description: "Bottle miscount on optical sensor",        qualityPenalty: 3  },
  { sensorId: "quality_optical",   condition: "below_critical", effect: "quality_degrade", description: "Sustained optical miscount — flag batch",  qualityPenalty: 8  },
];

const PACKAGING_EFFECTS: ThresholdEffect[] = [
  { sensorId: "pkg_water",     condition: "above_critical", effect: "stop",             targetDeviceId: "pkg_motor", description: "Moisture detected — stop packaging",          qualityPenalty: 20 },
  // Pressure: normal range is 60–80 bar. Below 50 bar halts packaging immediately;
  // below 30 bar escalates to an emergency stop.
  { sensorId: "pkg_pressure",  condition: "below_warning",  effect: "stop",             targetDeviceId: "pkg_motor", description: "Pressure below 50 bar — packaging halted",    qualityPenalty: 15 },
  { sensorId: "pkg_pressure",  condition: "below_critical", effect: "emergency_stop",                                 description: "Pressure critically low — emergency stop",    qualityPenalty: 25 },
  // V2 effects
  // Proximity = shared photoelectric beam-break. Keep soft so transient
  // clear signals don't trigger packaging's emergency light.
  { sensorId: "pkg_proximity", condition: "below_warning",  effect: "quality_degrade",                                description: "No case under beam — quality watch",          qualityPenalty: 3  },
  { sensorId: "pkg_proximity", condition: "below_critical", effect: "slowdown",                                       description: "Case absent on sealer — slowdown",            qualityPenalty: 5  },
  // Fire: value drops when fire present — same inverted semantics as curing.
  { sensorId: "pkg_fire",      condition: "below_warning",  effect: "slowdown",                                       description: "Heat signature rising on cardboard — slowdown", qualityPenalty: 10 },
  { sensorId: "pkg_fire",      condition: "below_critical", effect: "emergency_stop",                                 description: "Fire detected — emergency stop",              qualityPenalty: 30 },
  { sensorId: "pkg_estop",     condition: "above_critical", effect: "emergency_stop",                                 description: "Operator E-stop pressed — emergency shutdown", qualityPenalty: 30 },
];

// V2 — intake & dispatch effect tables (were empty before the sensor expansion)

const INTAKE_EFFECTS: ThresholdEffect[] = [
  { sensorId: "intake_rfid",    condition: "below_critical", effect: "stop",            description: "RFID authorization missing — gate closed", qualityPenalty: 10 },
  // Optical beam-break — resting state is naturally 0 (no product under beam),
  // so we keep effects soft to avoid faulting intake with its emergency light
  // on every idle frame.
  { sensorId: "intake_optical", condition: "below_warning",  effect: "quality_degrade", description: "Crate count anomaly — quality watch",       qualityPenalty: 3  },
  { sensorId: "intake_optical", condition: "below_critical", effect: "slowdown",        description: "Sustained optical clear — slowdown",        qualityPenalty: 5  },
];

const DISPATCH_EFFECTS: ThresholdEffect[] = [
  { sensorId: "dispatch_rfid",  condition: "below_critical", effect: "stop",            description: "RFID pallet tag missing — gate closed",         qualityPenalty: 10 },
  { sensorId: "dispatch_touch", condition: "below_critical", effect: "stop",            description: "Operator confirm pad not pressed — gate closed", qualityPenalty: 10 },
];

// ── Full Stage Configurations ──────────────────────────────

export const STAGE_CONFIGS: StageConfig[] = [
  {
    id: "intake",
    label: "Raw Material Intake",
    description: "Incoming material verification and staging",
    position: STAGE_POSITIONS.intake,
    conveyorT: STAGE_CONVEYOR_T.intake,
    dwellTimeSec: 5,
    sensorConfigs: INTAKE_SENSORS,
    outputDeviceConfigs: INTAKE_DEVICES,
    thresholdEffects: INTAKE_EFFECTS,
  },
  {
    id: "forming",
    label: "Bottle Blow Molding",
    description: "PET preforms heated and blown into bottle shape",
    position: STAGE_POSITIONS.forming,
    conveyorT: STAGE_CONVEYOR_T.forming,
    dwellTimeSec: 15,
    sensorConfigs: FORMING_SENSORS,
    outputDeviceConfigs: FORMING_DEVICES,
    thresholdEffects: FORMING_EFFECTS,
  },
  {
    id: "mixing",
    label: "Pepsi Filling",
    description: "Empty bottles filled with carbonated Pepsi syrup mixture",
    position: STAGE_POSITIONS.mixing,
    conveyorT: STAGE_CONVEYOR_T.mixing,
    dwellTimeSec: 12,
    sensorConfigs: MIXING_SENSORS,
    outputDeviceConfigs: MIXING_DEVICES,
    thresholdEffects: MIXING_EFFECTS,
  },
  {
    id: "curing",
    label: "Cooling Tunnel",
    description: "Filled bottles cooled and carbonation stabilized",
    position: STAGE_POSITIONS.curing,
    conveyorT: STAGE_CONVEYOR_T.curing,
    dwellTimeSec: 20,
    sensorConfigs: CURING_SENSORS,
    outputDeviceConfigs: CURING_DEVICES,
    thresholdEffects: CURING_EFFECTS,
  },
  {
    id: "quality",
    label: "Quality Inspection",
    description: "Dimensional and contamination checks",
    position: STAGE_POSITIONS.quality,
    conveyorT: STAGE_CONVEYOR_T.quality,
    dwellTimeSec: 8,
    sensorConfigs: QUALITY_SENSORS,
    outputDeviceConfigs: QUALITY_DEVICES,
    thresholdEffects: QUALITY_EFFECTS,
  },
  {
    id: "packaging",
    label: "Packaging",
    description: "Sealed and prepared for dispatch",
    position: STAGE_POSITIONS.packaging,
    conveyorT: STAGE_CONVEYOR_T.packaging,
    dwellTimeSec: 10,
    sensorConfigs: PACKAGING_SENSORS,
    outputDeviceConfigs: PACKAGING_DEVICES,
    thresholdEffects: PACKAGING_EFFECTS,
  },
  {
    id: "dispatch",
    label: "Dispatch",
    description: "Final verification and outbound staging",
    position: STAGE_POSITIONS.dispatch,
    conveyorT: STAGE_CONVEYOR_T.dispatch,
    dwellTimeSec: 5,
    sensorConfigs: DISPATCH_SENSORS,
    outputDeviceConfigs: DISPATCH_DEVICES,
    thresholdEffects: DISPATCH_EFFECTS,
  },
];

// ── Helper: get stage config by ID ─────────────────────────
export function getStageConfig(id: StageId): StageConfig {
  return STAGE_CONFIGS.find((s) => s.id === id)!;
}
