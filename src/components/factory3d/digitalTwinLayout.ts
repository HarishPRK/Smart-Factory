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

// ── Stage positions along the conveyor (x, y, z) ──────────
// Conveyor runs from x=-10 to x=10 at y=0.5, z=3
export const STAGE_POSITIONS: Record<StageId, [number, number, number]> = {
  intake:    [-9.5, 0.5, 3],
  mixing:    [-6.5, 0.5, 3],
  forming:   [-3.0, 0.5, 3],
  curing:    [ 0.0, 0.5, 3],
  quality:   [ 3.0, 0.5, 3],
  packaging: [ 6.5, 0.5, 3],
  dispatch:  [ 9.5, 0.5, 3],
};

// Parametric t-values (0–1) along the conveyor path for each stage
export const STAGE_CONVEYOR_T: Record<StageId, number> = {
  intake:    0.025,
  mixing:    0.175,
  forming:   0.35,
  curing:    0.50,
  quality:   0.65,
  packaging: 0.825,
  dispatch:  0.975,
};

// ── Sensor offset positions relative to stage center ───────
// [dx, dy, dz] — sensors are mounted on an archway over the belt
export const SENSOR_OFFSETS: [number, number, number][] = [
  [-0.4, 1.6,  0.5],   // Slot 0 — left upper
  [ 0.4, 1.6,  0.5],   // Slot 1 — right upper
  [-0.4, 1.6, -0.5],   // Slot 2 — left upper rear
  [ 0.4, 1.6, -0.5],   // Slot 3 — right upper rear
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
];

const MIXING_SENSORS: SensorConfig[] = [
  { sensorId: "mixing_ph",        type: "ph",        label: "pH",           unit: "",    min: 0,   max: 14,   nominal: 7.0,  warningThreshold: 9.0,  criticalThreshold: 10.0, volatility: 0.3 },
  { sensorId: "mixing_orp",       type: "orp",       label: "ORP",          unit: "mV",  min: -500, max: 500, nominal: 200,  warningThreshold: 350,  criticalThreshold: 420,  volatility: 5.0 },
  { sensorId: "mixing_turbidity", type: "turbidity", label: "Turbidity",    unit: "NTU", min: 0,   max: 100,  nominal: 15,   warningThreshold: 50,   criticalThreshold: 75,   volatility: 2.0 },
  { sensorId: "mixing_mq",        type: "mq_gas",    label: "MQ Gas",       unit: "ppm", min: 0,   max: 1000, nominal: 50,   warningThreshold: 300,  criticalThreshold: 500,  volatility: 8.0 },
];

const FORMING_SENSORS: SensorConfig[] = [
  { sensorId: "forming_pressure", type: "pressure",        label: "Pressure",        unit: "bar", min: 0,   max: 200, nominal: 80,   warningThreshold: 130,  criticalThreshold: 150,  volatility: 3.0 },
  { sensorId: "forming_light",    type: "light_intensity", label: "Light Intensity",  unit: "lux", min: 0,   max: 1000, nominal: 500, warningThreshold: 200,  criticalThreshold: 100,  volatility: 10.0 },
];

const CURING_SENSORS: SensorConfig[] = [
  { sensorId: "curing_o2",        type: "o2",              label: "O2",               unit: "%",   min: 0,   max: 25,   nominal: 20.9, warningThreshold: 18.0, criticalThreshold: 16.0, volatility: 0.4 },
  { sensorId: "curing_mq",        type: "mq_gas",          label: "MQ Gas",           unit: "ppm", min: 0,   max: 1000, nominal: 30,   warningThreshold: 300,  criticalThreshold: 500,  volatility: 6.0 },
  { sensorId: "curing_motion",    type: "microwave_motion", label: "Motion",           unit: "",    min: 0,   max: 1,    nominal: 0,    warningThreshold: 0.7,  criticalThreshold: 0.9,  volatility: 0.15 },
];

const QUALITY_SENSORS: SensorConfig[] = [
  { sensorId: "quality_lidar",     type: "lidar",           label: "LiDAR",            unit: "mm",  min: 0,   max: 50,   nominal: 0.5,  warningThreshold: 1.5,  criticalThreshold: 2.0,  volatility: 0.2 },
  { sensorId: "quality_light",     type: "light_intensity", label: "Light Intensity",   unit: "lux", min: 0,   max: 1000, nominal: 600,  warningThreshold: 250,  criticalThreshold: 150,  volatility: 8.0 },
  { sensorId: "quality_turbidity", type: "turbidity",       label: "Turbidity",         unit: "NTU", min: 0,   max: 100,  nominal: 5,    warningThreshold: 30,   criticalThreshold: 50,   volatility: 1.5 },
];

const PACKAGING_SENSORS: SensorConfig[] = [
  { sensorId: "pkg_motion",   type: "microwave_motion", label: "Motion",    unit: "",    min: 0,   max: 1,    nominal: 0,   warningThreshold: 0.7, criticalThreshold: 0.9, volatility: 0.15 },
  { sensorId: "pkg_pressure", type: "pressure",         label: "Pressure",  unit: "bar", min: 0,   max: 100,  nominal: 30,  warningThreshold: 60,  criticalThreshold: 80,  volatility: 2.0 },
  { sensorId: "pkg_water",    type: "water",            label: "Water",     unit: "",    min: 0,   max: 1,    nominal: 0,   warningThreshold: 0.3, criticalThreshold: 0.6, volatility: 0.08 },
];

const DISPATCH_SENSORS: SensorConfig[] = [
  { sensorId: "dispatch_gps",         type: "gps",        label: "GPS",         unit: "m",  min: 0, max: 100, nominal: 50,  warningThreshold: 70,  criticalThreshold: 90,  volatility: 0.5 },
  { sensorId: "dispatch_fingerprint", type: "fingerprint", label: "Fingerprint", unit: "",   min: 0, max: 1,   nominal: 1,   warningThreshold: 0.5, criticalThreshold: 0.2, volatility: 0.1 },
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
  { deviceId: "forming_motor",  type: "motor",        label: "Press Motor",   defaultActive: true, defaultRpm: 60 },
  { deviceId: "forming_phase",  type: "single_phase", label: "Phase Supply",  defaultActive: true, defaultPowerW: 2200 },
  { deviceId: "forming_power",  type: "power_meter",  label: "Power Meter",   defaultActive: true, defaultPowerW: 1800 },
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
  { sensorId: "mixing_ph", condition: "above_critical", effect: "stop",            targetDeviceId: "mixing_motor", description: "pH critical — stop mixer motor",  qualityPenalty: 25 },
  { sensorId: "mixing_ph", condition: "above_warning",  effect: "quality_degrade", description: "pH elevated — quality degradation",                                qualityPenalty: 10 },
  { sensorId: "mixing_orp", condition: "above_warning", effect: "slowdown",        description: "ORP elevated — reduce throughput",                                 qualityPenalty: 5 },
  { sensorId: "mixing_mq",  condition: "above_critical", effect: "emergency_stop", description: "Gas detected — emergency stop",                                    qualityPenalty: 30 },
];

const FORMING_EFFECTS: ThresholdEffect[] = [
  { sensorId: "forming_pressure", condition: "above_critical", effect: "emergency_stop", description: "Overpressure — emergency stop all motors", qualityPenalty: 30 },
  { sensorId: "forming_pressure", condition: "above_warning",  effect: "slowdown",       description: "High pressure — reduce speed",             qualityPenalty: 5 },
  { sensorId: "forming_light",    condition: "below_warning",  effect: "quality_degrade", description: "Low light — inspection failure",           qualityPenalty: 15 },
];

const CURING_EFFECTS: ThresholdEffect[] = [
  { sensorId: "curing_o2", condition: "below_critical", effect: "emergency_stop",  description: "Low O2 — emergency stop + lights", qualityPenalty: 30 },
  { sensorId: "curing_o2", condition: "below_warning",  effect: "slowdown",        description: "O2 dropping — reduce speed",       qualityPenalty: 5 },
  { sensorId: "curing_mq", condition: "above_critical", effect: "emergency_stop",  description: "Gas leak — emergency stop",        qualityPenalty: 30 },
  { sensorId: "curing_mq", condition: "above_warning",  effect: "quality_degrade", description: "Gas detected — quality risk",      qualityPenalty: 10 },
];

const QUALITY_EFFECTS: ThresholdEffect[] = [
  { sensorId: "quality_lidar",     condition: "above_critical", effect: "quality_degrade", description: "Dimensional deviation — defective",  qualityPenalty: 30 },
  { sensorId: "quality_lidar",     condition: "above_warning",  effect: "quality_degrade", description: "Dimensional warning — minor defect", qualityPenalty: 10 },
  { sensorId: "quality_turbidity", condition: "above_critical", effect: "stop",            description: "Contamination detected — stop line", qualityPenalty: 25 },
];

const PACKAGING_EFFECTS: ThresholdEffect[] = [
  { sensorId: "pkg_water",    condition: "above_critical", effect: "stop",            description: "Moisture detected — stop packaging", qualityPenalty: 20 },
  { sensorId: "pkg_pressure", condition: "above_warning",  effect: "slowdown",        description: "Seal pressure high — slow down",     qualityPenalty: 5 },
  { sensorId: "pkg_pressure", condition: "above_critical", effect: "emergency_stop",  description: "Seal pressure critical — stop",      qualityPenalty: 25 },
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
    thresholdEffects: [],
  },
  {
    id: "mixing",
    label: "Chemical Mixing",
    description: "Raw materials blended to specification",
    position: STAGE_POSITIONS.mixing,
    conveyorT: STAGE_CONVEYOR_T.mixing,
    dwellTimeSec: 12,
    sensorConfigs: MIXING_SENSORS,
    outputDeviceConfigs: MIXING_DEVICES,
    thresholdEffects: MIXING_EFFECTS,
  },
  {
    id: "forming",
    label: "Forming / Molding",
    description: "Material shaped under pressure",
    position: STAGE_POSITIONS.forming,
    conveyorT: STAGE_CONVEYOR_T.forming,
    dwellTimeSec: 15,
    sensorConfigs: FORMING_SENSORS,
    outputDeviceConfigs: FORMING_DEVICES,
    thresholdEffects: FORMING_EFFECTS,
  },
  {
    id: "curing",
    label: "Thermal Curing",
    description: "Heat treatment and chemical curing",
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
    thresholdEffects: [],
  },
];

// ── Helper: get stage config by ID ─────────────────────────
export function getStageConfig(id: StageId): StageConfig {
  return STAGE_CONFIGS.find((s) => s.id === id)!;
}
