import assert from 'node:assert/strict'
import { test } from 'node:test'
import { normalizeLiveTelemetry } from '../src/meter/live'
import { createMeterStore } from '../src/useMeterStore'

const sample = { voltage: 124.5, frequency: 60, power_factor: 0.901 }
const now = 1_800_000_000_000
function read(packet: unknown) {
  const result = normalizeLiveTelemetry(packet, undefined, now)
  assert.equal(result.ok, true)
  if (!result.ok) throw new Error(result.error)
  return result.telemetry
}

test('the actual three-field payload displays exact measurements and no fabricated metrics', () => {
  const t = read(sample)
  assert.equal(t.voltage, 124.5)
  assert.equal(t.frequency, 60)
  assert.equal(t.powerFactor, 0.901)
  assert.equal(t.timestamp, now)
  for (const key of ['activePower', 'reactivePower', 'current', 'temperature', 'importKwh', 'exportKwh', 'pulseCount', 'alarms', 'reverseEnergy'] as const) {
    assert.equal(t[key], null, key)
  }
})

test('the agreed meter feed calculates watts for JSON without requiring an extra model flag', () => {
  const calculated = read({ ...sample, current: 10 })
  assert.ok(Math.abs(calculated.activePower! - 1121.745) < 0.00001)
  assert.equal(calculated.activePowerSource, 'calculated')
  assert.equal(calculated.importKwh, null)
  assert.equal(calculated.reactivePower, null)
  const reported = read({ ...sample, current: 10, active_power: -1200, power_model: 'single_phase' })
  assert.equal(reported.activePower, -1200)
  assert.equal(reported.activePowerSource, 'reported')
  assert.equal(reported.reverseEnergy, true)
  assert.equal(read({ ...sample, current: 0, power_model: 'single_phase' }).activePower, 0)
  assert.equal(read({ ...sample, current: 10, power_model: 'three_phase' }).activePower, null)
  assert.equal(read({ ...sample, current: 10, power_model: 'single_phase' }).activePower, calculated.activePower)
  assert.ok(Math.abs(read({ voltage: 123.599998, current: 0.279, power_factor: 0.909, frequency: 60 }).activePower! - 31.346319092778) < 1e-10)
})

test('each fresh reading replaces power, including rising, falling and zero loads', (context) => {
  context.mock.timers.enable({ apis: ['Date'], now })
  const store = createMeterStore('websocket')
  const watts: number[] = []
  for (const [index, current] of [0.279, 0.4, 0.1, 0].entries()) {
    context.mock.timers.setTime(now + index * 6000)
    assert.equal(store.getState().ingest({ voltage: 123.599998, current, power_factor: 0.909, frequency: 60 }), true)
    const expected = 123.599998 * current * 0.909
    watts.push(expected)
    assert.equal(store.getState().telemetry.activePower, expected)
    assert.equal(store.getState().telemetry.activePowerSource, 'calculated')
  }
  assert.deepEqual(store.getState().history.map(point => point.activePower), watts)
  assert.equal(store.getState().telemetry.importKwh, null)
})

test('bad JSON shapes, greetings, nonfinite values, alias conflicts, units and inconsistent direction are rejected', () => {
  for (const packet of [null, [], 'hello', { message: 'Hello from AWS IoT console' }, { ...sample, voltage: NaN }, { ...sample, frequency: Infinity }, { ...sample, power_factor: 1.1 }, { ...sample, powerFactor: 0.8 }, { ...sample, current: '10' }, { ...sample, activePower: -100, reverseEnergy: false }, { ...sample, alarms: ['made-up'] }, { ...sample, pulse_count: 1.2 }, { ...sample, timestamp: now / 1000 }, { ...sample, timestamp: now + 6000 }]) {
    assert.equal(normalizeLiveTelemetry(packet, undefined, now).ok, false, JSON.stringify(packet))
  }
})

test('known registers remain validated without creating missing registers or assuming a healthy alarm state', () => {
  const first = read({ ...sample, import_kwh: 25, pulse_count: 100, alarms: [] })
  assert.deepEqual(first.alarms, [])
  assert.equal(first.exportKwh, null)
  assert.equal(normalizeLiveTelemetry({ ...sample, timestamp: now + 1000, import_kwh: 24 }, first, now + 1000).ok, false)
  assert.equal(normalizeLiveTelemetry({ ...sample, timestamp: now }, first, now).ok, false)
})

test('partial updates clear absent measurements, and switching sources clears previous values/history', (context) => {
  context.mock.timers.enable({ apis: ['Date'], now })
  const store = createMeterStore('websocket')
  assert.equal(store.getState().telemetry.voltage, null)
  store.getState().ingest({ ...sample, current: 10, active_power: 1121.745 })
  context.mock.timers.setTime(now + 6000)
  store.getState().ingest(sample)
  assert.equal(store.getState().telemetry.current, null)
  assert.equal(store.getState().telemetry.activePower, null)
  const snapshot = JSON.parse(JSON.stringify(store.getState().telemetry))
  assert.equal(snapshot.importKwh, null)
  store.getState().setSource('simulation')
  assert.equal(store.getState().telemetry.current, 42)
  store.getState().setSource('websocket')
  assert.equal(store.getState().telemetry.current, null)
  assert.equal(store.getState().history.length, 0)
})
