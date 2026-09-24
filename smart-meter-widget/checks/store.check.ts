import assert from 'node:assert/strict'
import { test } from 'node:test'
import { createMeterStore } from '../src/useMeterStore'
import { createInitialTelemetry } from '../src/meter/physics'

test('simulation controls clamp limits and voltage faults are mutually exclusive', () => {
  const store = createMeterStore()
  store.getState().setLoadAmps(999)
  store.getState().setPowerFactor(0.1)
  assert.equal(store.getState().controls.loadAmps, 200)
  assert.equal(store.getState().controls.powerFactor, 0.85)
  store.getState().setLoadAmps(NaN)
  assert.equal(store.getState().controls.loadAmps, 200)
  store.getState().toggleFault('sag')
  store.getState().toggleFault('surge')
  store.getState().toggleFault('tamper')
  assert.deepEqual(store.getState().controls.faults, ['surge', 'tamper'])
  store.getState().clearFaults()
  assert.deepEqual(store.getState().controls.faults, [])
})

test('remote sources block all simulation controls while permitting inspection controls', () => {
  const store = createMeterStore()
  const controls = store.getState().controls
  store.getState().setSource('mqtt')
  store.getState().setLoadAmps(10)
  store.getState().setPowerFactor(0.85)
  store.getState().setSolarExport(true)
  store.getState().toggleFault('overcurrent')
  store.getState().setPaused(true)
  store.getState().resetSimulation()
  assert.deepEqual(store.getState().controls, controls)
  assert.equal(store.getState().paused, false)
  store.getState().setExploded(true)
  store.getState().setThermal(true)
  store.getState().setCameraPreset('terminals')
  assert.equal(store.getState().exploded, true)
  assert.equal(store.getState().thermal, true)
  assert.equal(store.getState().cameraPreset, 'terminals')
})

test('history stays bounded to 120 seconds at one sample per second', (context) => {
  const start = Date.now()
  context.mock.timers.enable({ apis: ['Date'], now: start })
  const store = createMeterStore()
  for (let tick = 0; tick < 3_000; tick++) {
    context.mock.timers.setTime(start + tick * 100)
    assert.equal(store.getState().ingest(createInitialTelemetry(Date.now())), true)
  }
  const state = store.getState()
  assert.equal(state.history.length, 120)
  assert.ok(state.history.every((sample) => sample.timestamp > state.telemetry.timestamp - 120_000))
  assert.equal(state.history[1].timestamp - state.history[0].timestamp, 1_000)
})

test('invalid packets preserve the last valid readings and the next valid packet clears the error', () => {
  const store = createMeterStore()
  store.getState().setSource('websocket')
  const valid = createInitialTelemetry(Date.now())
  assert.equal(store.getState().ingest(valid), true)
  assert.equal(store.getState().connection, 'connected')
  assert.equal(store.getState().ingest({ ...valid, timestamp: valid.timestamp + 1, voltage: NaN }), false)
  assert.equal(store.getState().telemetry.voltage, valid.voltage)
  assert.match(store.getState().error ?? '', /Invalid voltage/)
  assert.equal(store.getState().ingest({ ...valid, timestamp: valid.timestamp + 2 }), true)
  assert.equal(store.getState().error, null)
})

test('simulation reset clears counters/history/faults without moving the inspection camera', () => {
  const store = createMeterStore()
  store.getState().setCameraPreset('front')
  store.getState().toggleFault('tamper')
  store.getState().setPaused(true)
  store.getState().ingest({ ...createInitialTelemetry(), importKwh: 99_999, pulseCount: 40 })
  store.getState().resetSimulation()
  const state = store.getState()
  assert.equal(state.telemetry.importKwh, 12_847.382)
  assert.equal(state.telemetry.pulseCount, 0)
  assert.equal(state.history.length, 0)
  assert.equal(state.paused, false)
  assert.equal(state.cameraPreset, 'front')
  assert.deepEqual(state.controls.faults, [])
})
