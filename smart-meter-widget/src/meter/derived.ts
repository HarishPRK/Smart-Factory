import type { MeterReading } from './types'

/** Single-phase quantities from matched RMS measurements. No sinusoidal assumption. */
export function deriveElectrical(reading: MeterReading) {
  const apparentVa = reading.voltage === null || reading.current === null ? null : reading.voltage * reading.current
  const watts = reading.activePower
  // This includes reactive AND distortion components; PF alone cannot separate them.
  const nonActiveVa = apparentVa === null || watts === null || Math.abs(watts) > apparentVa + 1e-6
    ? null : Math.sqrt(Math.max(0, apparentVa ** 2 - watts ** 2))
  return {
    apparentVa,
    nonActiveVa,
    cycleMs: reading.frequency !== null && reading.frequency > 0 ? 1000 / reading.frequency : null,
    frequencyDeviationHz: reading.frequency === null ? null : reading.frequency - 60,
  }
}

export interface EnergySummary {
  since: number
  lastTimestamp: number
  importWh: number
  exportWh: number
  apparentVAh: number
  observedMs: number
  peakW: number
  samples: number
  gaps: number
  persisted: boolean
}

export function readEnergySummary(input: unknown, timestamp: number): EnergySummary | null {
  if (!input || typeof input !== 'object') return null
  const value = input as Record<string, unknown>
  for (const key of ['since', 'lastTimestamp', 'importWh', 'exportWh', 'apparentVAh', 'observedMs', 'peakW', 'samples', 'gaps']) {
    if (typeof value[key] !== 'number' || !Number.isFinite(value[key]) || value[key] < 0) return null
  }
  if ((value.lastTimestamp as number) > timestamp || (value.persisted === true && value.lastTimestamp !== timestamp) || (value.since as number) > (value.lastTimestamp as number) || typeof value.persisted !== 'boolean') return null
  if ((value.observedMs as number) > (value.lastTimestamp as number) - (value.since as number)) return null
  if (['since', 'lastTimestamp', 'observedMs', 'samples', 'gaps'].some(key => !Number.isSafeInteger(value[key]))) return null
  return value as unknown as EnergySummary
}
