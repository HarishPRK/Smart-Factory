import { MAX_FUTURE_SKEW_MS, MAX_PACKET_AGE_MS } from './physics'
import { METER_FAULTS, type MeterFault, type MeterReading } from './types'

export function emptyMeterReading(timestamp = Date.now()): MeterReading {
  return {
    timestamp, voltage: null, frequency: null, powerFactor: null, current: null,
    activePower: null, reactivePower: null, importKwh: null, exportKwh: null,
    temperature: null, pulseCount: null, reverseEnergy: null, alarms: null,
  }
}

const fields = {
  voltage: ['voltage', 0, 400], frequency: ['frequency', 0, 100],
  powerFactor: ['power_factor', 0, 1], current: ['current', 0, 1_000],
  activePower: ['active_power', -400_000, 400_000],
  reactivePower: ['reactive_power', -400_000, 400_000],
  importKwh: ['import_kwh', 0, 1e12], exportKwh: ['export_kwh', 0, 1e12],
  temperature: ['temperature', -50, 200], pulseCount: ['pulse_count', 0, Number.MAX_SAFE_INTEGER],
} as const

/** Accept the meter/data payload directly. Never merge missing fields with old/demo values. */
export function normalizeLiveTelemetry(input: unknown, previous?: MeterReading, now = Date.now()):
  { ok: true; telemetry: MeterReading } | { ok: false; error: string } {
  const reject = (error: string) => ({ ok: false as const, error })
  if (!input || typeof input !== 'object' || Array.isArray(input)) return reject('Expected a telemetry object.')
  const packet = input as Record<string, unknown>
  const reading = emptyMeterReading(now)
  for (const [key, [alias, min, max]] of Object.entries(fields)) {
    const field = key as keyof typeof fields
    if (key !== alias && packet[key] !== undefined && packet[alias] !== undefined && packet[key] !== packet[alias]) {
      return reject(`Conflicting ${key} and ${alias}.`)
    }
    const value = packet[key] ?? packet[alias]
    if (value === undefined || value === null) continue
    if (typeof value !== 'number' || !Number.isFinite(value) || value < min || value > max) {
      return reject(`Invalid ${key}: expected a finite number from ${min} to ${max}.`)
    }
    reading[field] = value
  }
  // Console greetings and other non-meter JSON must not mark the stream live.
  if (!Object.keys(fields).some(key => reading[key as keyof typeof fields] !== null)) {
    return reject('No supported meter measurements in this packet.')
  }
  if (packet.timestamp !== undefined) {
    if (typeof packet.timestamp !== 'number' || !Number.isSafeInteger(packet.timestamp)) return reject('Timestamp must be epoch milliseconds.')
    reading.timestamp = packet.timestamp
  }
  if (reading.timestamp < now - MAX_PACKET_AGE_MS) return reject('Packet is stale (older than 15 seconds).')
  if (reading.timestamp > now + MAX_FUTURE_SKEW_MS) return reject('Packet timestamp is more than 5 seconds ahead.')
  if (previous && reading.timestamp <= previous.timestamp) return reject('Out-of-order or duplicate packet timestamp.')
  if (reading.pulseCount !== null && !Number.isSafeInteger(reading.pulseCount)) return reject('pulseCount must be a nonnegative safe integer.')
  for (const field of ['importKwh', 'exportKwh', 'pulseCount'] as const) {
    const before = previous?.[field]
    if (before != null && reading[field] !== null && reading[field] < before) return reject(`${field} cannot decrease within a session.`)
  }
  if (packet.alarms !== undefined && packet.alarms !== null) {
    if (!Array.isArray(packet.alarms) || packet.alarms.some(alarm => !METER_FAULTS.includes(alarm))) return reject('Unsupported meter alarm code.')
    reading.alarms = [...new Set(packet.alarms)] as MeterFault[]
  }
  const reverseEnergy = packet.reverseEnergy ?? packet.reverse_energy
  if (reverseEnergy !== undefined && reverseEnergy !== null) {
    if (typeof reverseEnergy !== 'boolean') return reject('reverseEnergy must be boolean.')
    reading.reverseEnergy = reverseEnergy
  }
  if (reading.activePower !== null) {
    reading.activePowerSource = 'reported'
  } else if (reading.voltage !== null && reading.current !== null && reading.powerFactor !== null && (packet.power_model === undefined || packet.power_model === 'single_phase')) {
    // This meter's agreed feed measures one single-phase circuit, whether JSON or protobuf.
    // Respect an explicitly different model; never multiply a leg reading into a service total.
    reading.activePower = reading.voltage * reading.current * reading.powerFactor * (reading.reverseEnergy ? -1 : 1)
    reading.activePowerSource = 'calculated'
  }
  if (reading.activePower !== null) {
    const exporting = reading.activePower < 0
    if (reading.reverseEnergy !== null && reading.reverseEnergy !== exporting) return reject('reverseEnergy must match the active-power direction.')
    reading.reverseEnergy = exporting
  }
  return { ok: true, telemetry: reading }
}
