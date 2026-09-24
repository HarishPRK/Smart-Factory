import { METER_FAULTS, type MeterControls, type MeterTelemetry, type TelemetryValidation } from './types'

export const DEFAULT_IMP_PER_KWH = 1_000
export const MAX_SIMULATION_STEP_SECONDS = 1
export const MAX_PACKET_AGE_MS = 15_000
export const MAX_FUTURE_SKEW_MS = 5_000
export const HISTORY_WINDOW_MS = 120_000

export function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value))
}

export function createDefaultControls(): MeterControls {
  return { loadAmps: 42, powerFactor: 0.96, solarExport: false, faults: [] }
}

export function createInitialTelemetry(timestamp = Date.now()): MeterTelemetry {
  const powerFactor = 0.96
  return {
    timestamp,
    voltage: 240,
    current: 42,
    powerFactor,
    activePower: 240 * 42 * powerFactor,
    reactivePower: 240 * 42 * Math.sqrt(1 - powerFactor ** 2),
    frequency: 60,
    importKwh: 12_847.382,
    exportKwh: 0,
    temperature: 32.6,
    pulseCount: 0,
    reverseEnergy: false,
    alarms: [],
  }
}

/** Box-Muller normal sample, clipped to two standard deviations. */
export function boundedGaussian(rng: () => number = Math.random): number {
  const first = clamp(rng(), Number.EPSILON, 1 - Number.EPSILON)
  const second = clamp(rng(), Number.EPSILON, 1 - Number.EPSILON)
  return clamp(Math.sqrt(-2 * Math.log(first)) * Math.cos(2 * Math.PI * second), -2, 2)
}

/**
 * One deterministic, side-effect-free simulation step.
 * Balanced split phase: total apparent power is V_L-L × I_line (no extra ×2).
 * A suspended tab advances at most one second rather than inventing missed energy.
 */
export function stepMeter(
  previous: MeterTelemetry,
  controls: MeterControls,
  elapsedSeconds: number,
  timestamp = Date.now(),
  rng: () => number = Math.random,
  impPerKwh = DEFAULT_IMP_PER_KWH,
): MeterTelemetry {
  const dt = Number.isFinite(elapsedSeconds) ? clamp(elapsedSeconds, 0, MAX_SIMULATION_STEP_SECONDS) : 0
  const voltageMultiplier = controls.faults.includes('sag') ? 0.78 : controls.faults.includes('surge') ? 1.18 : 1
  const voltage = 240 * voltageMultiplier + boundedGaussian(rng) * 0.75
  const requestedCurrent = Number.isFinite(controls.loadAmps) ? clamp(controls.loadAmps, 0, 200) : 0
  const current = controls.faults.includes('overcurrent')
    ? 225 + boundedGaussian(rng) * 0.4
    : clamp(requestedCurrent * (1 + boundedGaussian(rng) * 0.002), 0, 200)
  const powerFactor = Number.isFinite(controls.powerFactor) ? clamp(controls.powerFactor, 0.85, 1) : 1
  const direction = controls.solarExport ? -1 : 1
  const activePower = voltage * current * powerFactor * direction
  const reactivePower = voltage * current * Math.sqrt(Math.max(0, 1 - powerFactor ** 2)) * direction
  const energyDelta = Math.abs(activePower) * dt / 3_600_000
  const importKwh = previous.importKwh + (activePower > 0 ? energyDelta : 0)
  const exportKwh = previous.exportKwh + (activePower < 0 ? energyDelta : 0)
  const impulseConstant = Number.isFinite(impPerKwh) ? clamp(impPerKwh, 1, 100_000) : DEFAULT_IMP_PER_KWH
  // Compare cumulative boundaries rather than rounding each frame's small increment.
  const oldBoundary = Math.floor((previous.importKwh + previous.exportKwh) * impulseConstant + 1e-7)
  const newBoundary = Math.floor((importKwh + exportKwh) * impulseConstant + 1e-7)
  const targetTemperature = 28 + 44 * (current / 200) ** 2 + (1 - powerFactor) * 8
  const temperature = previous.temperature + (targetTemperature - previous.temperature) * (1 - Math.exp(-dt / 18))
  return {
    timestamp,
    voltage,
    current,
    powerFactor,
    activePower,
    reactivePower,
    frequency: 60 + boundedGaussian(rng) * 0.012,
    importKwh,
    exportKwh,
    temperature,
    pulseCount: previous.pulseCount + Math.max(0, newBoundary - oldBoundary),
    reverseEnergy: activePower < 0,
    alarms: [...controls.faults],
  }
}

export function pulseIntervalMs(activePower: number, impPerKwh = DEFAULT_IMP_PER_KWH): number {
  if (!Number.isFinite(activePower) || activePower === 0 || !Number.isFinite(impPerKwh) || impPerKwh <= 0) return Infinity
  return 3_600_000_000 / (Math.abs(activePower) * impPerKwh)
}

/** Validate at the trust boundary; never spread an untrusted packet into store state. */
export function validateMeterTelemetry(
  input: unknown,
  previous?: MeterTelemetry,
  now = Date.now(),
): TelemetryValidation {
  const reject = (error: string): TelemetryValidation => ({ ok: false, error })
  if (!input || typeof input !== 'object' || Array.isArray(input)) return reject('Expected a telemetry object.')
  const value = input as Record<string, unknown>
  const bounds: Record<string, readonly [number, number]> = {
    timestamp: [0, Number.MAX_SAFE_INTEGER],
    voltage: [0, 400],
    current: [0, 1_000],
    powerFactor: [0, 1],
    activePower: [-400_000, 400_000],
    reactivePower: [-400_000, 400_000],
    frequency: [0, 100],
    importKwh: [0, 1e12],
    exportKwh: [0, 1e12],
    temperature: [-50, 200],
    pulseCount: [0, Number.MAX_SAFE_INTEGER],
  }
  for (const [key, [minimum, maximum]] of Object.entries(bounds)) {
    const field = value[key]
    if (typeof field !== 'number' || !Number.isFinite(field) || field < minimum || field > maximum) {
      return reject(`Invalid ${key}: expected a finite number from ${minimum} to ${maximum}.`)
    }
  }
  const timestamp = value.timestamp as number
  if (!Number.isSafeInteger(timestamp)) return reject('Timestamp must be epoch milliseconds.')
  if (timestamp < now - MAX_PACKET_AGE_MS) return reject('Packet is stale (older than 15 seconds).')
  if (timestamp > now + MAX_FUTURE_SKEW_MS) return reject('Packet timestamp is more than 5 seconds ahead.')
  if (previous && timestamp <= previous.timestamp) return reject('Out-of-order or duplicate packet timestamp.')
  if (!Number.isSafeInteger(value.pulseCount)) return reject('pulseCount must be a nonnegative safe integer.')
  if (typeof value.reverseEnergy !== 'boolean') return reject('reverseEnergy must be boolean.')
  if (value.reverseEnergy !== ((value.activePower as number) < 0)) return reject('reverseEnergy must match the active-power direction.')
  if (!Array.isArray(value.alarms) || value.alarms.some((alarm: unknown) => !METER_FAULTS.includes(alarm as never))) {
    return reject('alarms must contain only supported meter fault codes.')
  }
  if (previous && ((value.importKwh as number) < previous.importKwh || (value.exportKwh as number) < previous.exportKwh)) {
    return reject('Cumulative energy registers cannot decrease within a session.')
  }
  if (previous && (value.pulseCount as number) < previous.pulseCount) return reject('Pulse counter cannot decrease within a session.')
  return {
    ok: true,
    telemetry: {
      timestamp,
      voltage: value.voltage as number,
      current: value.current as number,
      powerFactor: value.powerFactor as number,
      activePower: value.activePower as number,
      reactivePower: value.reactivePower as number,
      frequency: value.frequency as number,
      importKwh: value.importKwh as number,
      exportKwh: value.exportKwh as number,
      temperature: value.temperature as number,
      pulseCount: value.pulseCount as number,
      reverseEnergy: value.reverseEnergy,
      alarms: [...new Set(value.alarms)] as MeterTelemetry['alarms'],
    },
  }
}
