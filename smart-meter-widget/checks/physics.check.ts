import assert from 'node:assert/strict'
import { test } from 'node:test'
import { boundedGaussian, createDefaultControls, createInitialTelemetry, pulseIntervalMs, stepMeter, validateMeterTelemetry } from '../src/meter/physics'

const noNoise = () => 0.25 // cos(2π × 0.25) = 0 for each Box-Muller pair.
const closeTo = (actual: number, expected: number, tolerance = 1e-8) => assert.ok(Math.abs(actual - expected) < tolerance, `${actual} != ${expected}`)

test('balanced 120/240 V power is V line-to-line × line current × PF', () => {
  const previous = createInitialTelemetry(1_000)
  const sample = stepMeter(previous, { ...createDefaultControls(), loadAmps: 100, powerFactor: 0.9 }, 1, 2_000, noNoise)
  closeTo(sample.activePower, 21_600)
  closeTo(sample.reactivePower, 24_000 * Math.sqrt(1 - 0.9 ** 2))
  closeTo(sample.importKwh - previous.importKwh, 21_600 / 3_600_000)
  assert.equal(sample.exportKwh, 0)
})

test('separate energy registers and impulse crossings remain correct across import/export', () => {
  const controls = { ...createDefaultControls(), loadAmps: 10, powerFactor: 1 }
  let sample = { ...createInitialTelemetry(0), importKwh: 0 }
  for (let second = 1; second <= 3_600; second++) sample = stepMeter(sample, controls, 1, second * 1_000, noNoise)
  closeTo(sample.importKwh, 2.4)
  assert.equal(sample.pulseCount, 2_400)
  for (let second = 3_601; second <= 7_200; second++) sample = stepMeter(sample, { ...controls, solarExport: true }, 1, second * 1_000, noNoise)
  closeTo(sample.importKwh, 2.4)
  closeTo(sample.exportKwh, 2.4)
  assert.equal(sample.pulseCount, 4_800)
  assert.equal(sample.activePower, -2_400)
  assert.equal(sample.reverseEnergy, true)
})

test('pulse timing follows absolute power and stops at zero load', () => {
  assert.equal(pulseIntervalMs(10_000), 360)
  assert.equal(pulseIntervalMs(-10_000), 360)
  assert.equal(pulseIntervalMs(0), Infinity)
  const previous = createInitialTelemetry()
  const sample = stepMeter(previous, { ...createDefaultControls(), loadAmps: 0 }, 1, Date.now(), noNoise)
  assert.equal(sample.current, 0)
  assert.equal(sample.activePower, 0)
  assert.equal(sample.importKwh, previous.importKwh)
  assert.equal(sample.pulseCount, previous.pulseCount)
})

test('Gaussian voltage jitter is bounded to ±1.5 V', () => {
  let seed = 123456789
  const random = () => {
    seed = (1664525 * seed + 1013904223) >>> 0
    return seed / 2 ** 32
  }
  const previous = createInitialTelemetry()
  const voltages = Array.from({ length: 2_000 }, () => stepMeter(previous, createDefaultControls(), 0.1, Date.now(), random).voltage)
  assert.ok(voltages.every((voltage) => voltage >= 238.5 && voltage <= 241.5))
  assert.ok(Math.min(...voltages) < 239 && Math.max(...voltages) > 241)
  assert.ok(Number.isFinite(boundedGaussian(() => 0)))
  assert.ok(Number.isFinite(boundedGaussian(() => 1)))
})

test('fault injection covers voltage, overcurrent, and independent polarity/tamper diagnostics', () => {
  const previous = createInitialTelemetry()
  const controls = createDefaultControls()
  const sag = stepMeter(previous, { ...controls, faults: ['sag'] }, 1, Date.now(), noNoise)
  const surge = stepMeter(previous, { ...controls, faults: ['surge'] }, 1, Date.now(), noNoise)
  const overload = stepMeter(previous, { ...controls, faults: ['overcurrent'] }, 1, Date.now(), noNoise)
  const polarity = stepMeter(previous, { ...controls, faults: ['reversePolarity', 'tamper'] }, 1, Date.now(), noNoise)
  assert.ok(sag.voltage < 216)
  assert.ok(surge.voltage > 264)
  assert.ok(overload.current > 200)
  assert.equal(polarity.reverseEnergy, false)
  assert.ok(polarity.activePower > 0)
  assert.deepEqual(polarity.alarms, ['reversePolarity', 'tamper'])
})

test('elapsed integration cannot jump after suspension or reverse on invalid dt', () => {
  const previous = createInitialTelemetry()
  const controls = createDefaultControls()
  const maximum = stepMeter(previous, controls, 1, Date.now(), noNoise)
  const resumed = stepMeter(previous, controls, 3_600, Date.now(), noNoise)
  assert.equal(resumed.importKwh, maximum.importKwh)
  for (const dt of [-1, NaN, Infinity]) {
    assert.equal(stepMeter(previous, controls, dt, Date.now(), noNoise).importKwh, previous.importKwh)
  }
})

test('remote packet validation rejects malformed, nonfinite, stale, out-of-order and regressing registers', () => {
  const now = Date.now()
  const valid = createInitialTelemetry(now)
  assert.equal(validateMeterTelemetry(valid, undefined, now).ok, true)
  for (const input of [null, [], {}, { ...valid, current: NaN }, { ...valid, activePower: Infinity }, { ...valid, timestamp: now - 15_001 }, { ...valid, timestamp: now + 5_001 }, { ...valid, pulseCount: 1.5 }, { ...valid, alarms: ['unknown'] }, { ...valid, reverseEnergy: true }]) {
    assert.equal(validateMeterTelemetry(input, undefined, now).ok, false)
  }
  assert.equal(validateMeterTelemetry(valid, valid, now).ok, false)
  assert.equal(validateMeterTelemetry({ ...valid, timestamp: now + 1, importKwh: valid.importKwh - 1 }, valid, now).ok, false)
  assert.equal(validateMeterTelemetry({ ...valid, timestamp: now + 1, pulseCount: 0 }, { ...valid, pulseCount: 1 }, now).ok, false)
  const result = validateMeterTelemetry({ ...valid, unexpectedField: 'discard me' }, undefined, now)
  assert.ok(result.ok)
  assert.ok(!('unexpectedField' in result.telemetry))
})
