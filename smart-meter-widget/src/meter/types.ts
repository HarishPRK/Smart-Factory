export const METER_FAULTS = ['sag', 'surge', 'overcurrent', 'reversePolarity', 'tamper'] as const

export type MeterFault = (typeof METER_FAULTS)[number]
export type CameraPreset = 'front' | 'terminals' | 'isometric'
export type MeterSource = 'simulation' | 'websocket' | 'mqtt'
export type MeterConnection = 'simulated' | 'connecting' | 'connected' | 'disconnected' | 'error'

/** Canonical gateway packet. All timestamps are epoch milliseconds, not seconds. */
export interface MeterTelemetry {
  timestamp: number
  /** Line-to-line RMS voltage; balanced 120/240 V split-phase model. */
  voltage: number
  /** RMS line current, always nonnegative. */
  current: number
  powerFactor: number
  /** Watts: positive = import, negative = export. */
  activePower: number
  /** VAR; inductive in simulation, signed with energy direction. */
  reactivePower: number
  frequency: number
  /** Separate monotonic cumulative registers in kWh. */
  importKwh: number
  exportKwh: number
  /** Illustrative enclosure temperature, degrees Celsius. */
  temperature: number
  /** Monotonic impulse counter for absolute (import + export) active energy. */
  pulseCount: number
  reverseEnergy: boolean
  alarms: MeterFault[]
}

export interface MeterControls {
  loadAmps: number
  powerFactor: number
  solarExport: boolean
  faults: MeterFault[]
}

export interface MeterStreamOptions {
  source: MeterSource
  url?: string
  topic?: string
}

export type TelemetryValidation =
  | { ok: true; telemetry: MeterTelemetry }
  | { ok: false; error: string }
