/**
 * Digital Twin Types
 *
 * Defines all sensor, output device, manufacturing stage, and product types
 * for the digital twin manufacturing pipeline.
 */

// ── 12 Input Sensor Types ──────────────────────────────────
export type SensorType =
  | "ph"
  | "microwave_motion"
  | "turbidity"
  | "o2"
  | "lidar"
  | "light_intensity"
  | "gps"
  | "orp"
  | "water"
  | "mq_gas"
  | "pressure"
  | "fingerprint";

// ── 6 Output Device Types ──────────────────────────────────
export type OutputDeviceType =
  | "switch_4ep"
  | "shelly"
  | "single_phase"
  | "power_meter"
  | "motor"
  | "emergency_light";

// ── Manufacturing Stage IDs ────────────────────────────────
export type StageId =
  | "intake"
  | "mixing"
  | "forming"
  | "curing"
  | "quality"
  | "packaging"
  | "dispatch";

export type StageStatus = "idle" | "running" | "warning" | "faulted" | "blocked";

// ── Sensor Reading ─────────────────────────────────────────
export interface SensorReading {
  sensorId: string;
  type: SensorType;
  label: string;
  value: number;
  unit: string;
  min: number;
  max: number;
  nominal: number;
  warningThreshold: number;
  criticalThreshold: number;
  status: "normal" | "warning" | "critical";
  timestamp: number;
}

// ── Output Device State ────────────────────────────────────
export interface OutputDeviceState {
  deviceId: string;
  type: OutputDeviceType;
  label: string;
  active: boolean;
  /** For switch_4ep: 4 endpoint states */
  endpoints?: boolean[];
  /** For power_meter / single_phase: power reading */
  powerW?: number;
  currentA?: number;
  voltageV?: number;
  /** For motor: rpm and direction */
  rpm?: number;
  direction?: "forward" | "reverse" | "stopped";
}

// ── Threshold Effect (cause-effect chain) ──────────────────
export interface ThresholdEffect {
  sensorId: string;
  condition: "above_warning" | "above_critical" | "below_warning" | "below_critical";
  effect: "slowdown" | "stop" | "quality_degrade" | "emergency_stop" | "bypass";
  targetDeviceId?: string;
  description: string;
  qualityPenalty?: number;
}

// ── Manufacturing Stage ────────────────────────────────────
export interface ManufacturingStage {
  id: StageId;
  label: string;
  description: string;
  position: [number, number, number];
  sensors: SensorReading[];
  outputDevices: OutputDeviceState[];
  status: StageStatus;
  throughput: number;
  qualityScore: number;
  dwellTimeSec: number;
  thresholdEffects: ThresholdEffect[];
}

// ── Product on Belt ────────────────────────────────────────
export interface ProductOnBelt {
  id: string;
  /** 0–1 along the full conveyor path */
  progress: number;
  currentStageId: StageId | null;
  qualityScore: number;
  defects: string[];
  enteredAt: number;
  /** Visual color based on quality */
  color: string;
  
  /** Filling station state (optional) */
  fillingState?: {
    isLocked: boolean;          // true when bottle is stopped for filling
    lockedPosition: number;     // the exact progress value where it's locked
    fillStartTime: number;      // when filling started
    nozzleIndex: number;        // which nozzle (0-3) is filling this bottle
  };
}

// ── Sensor Config (for simulation) ─────────────────────────
export interface SensorConfig {
  sensorId: string;
  type: SensorType;
  label: string;
  unit: string;
  min: number;
  max: number;
  nominal: number;
  warningThreshold: number;
  criticalThreshold: number;
  volatility: number;
}

// ── Stage Config (for layout) ──────────────────────────────
export interface StageConfig {
  id: StageId;
  label: string;
  description: string;
  position: [number, number, number];
  conveyorT: number;
  dwellTimeSec: number;
  sensorConfigs: SensorConfig[];
  outputDeviceConfigs: OutputDeviceConfig[];
  thresholdEffects: ThresholdEffect[];
}

export interface OutputDeviceConfig {
  deviceId: string;
  type: OutputDeviceType;
  label: string;
  defaultActive: boolean;
  defaultRpm?: number;
  defaultPowerW?: number;
}

// ── Digital Twin Scenario ──────────────────────────────────
export interface DigitalTwinScenario {
  id: string;
  label: string;
  duration: string;
  color: string;
  description: string;
}
