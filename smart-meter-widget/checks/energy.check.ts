import assert from 'node:assert/strict'
import { test } from 'node:test'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { MeterEnergyCounter, integratePower } from '../../scripts/meter-energy.mjs'
import { createMeterFrame } from '../../scripts/meter-wire.mjs'
import { deriveElectrical, readEnergySummary } from '../src/meter/derived'
import { emptyMeterReading } from '../src/meter/live'
import { createMeterStore } from '../src/useMeterStore'

const now = 1_800_000_000_000
const sample = { voltage: 123.599998, current: 0.279, power_factor: 0.909, frequency: 60 }
const watts = sample.voltage * sample.current * sample.power_factor
const close = (actual: number, expected: number) => assert.ok(Math.abs(actual - expected) < 1e-9, `${actual} != ${expected}`)
function setup() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'meter-energy-check-'))
  const file = path.join(dir, 'energy.json')
  return { file, counter: new MeterEnergyCounter({ file }) }
}
function frame(timestamp: number, payload: object = sample) { return { topic: 'meter/data', payload, publishedAt: timestamp, retained: false } }

test('one minute of live samples accumulates Wh independently of browser connections and survives restart', () => {
  const { file, counter } = setup()
  for (let i = 0; i <= 10; i++) counter.accept(frame(now + i * 6000), now + i * 6000)
  const total = counter.summary()!
  close(total.importWh, watts / 60)
  close(total.apparentVAh, sample.voltage * sample.current / 60)
  assert.equal(total.observedMs, 60_000)
  assert.equal(total.samples, 11)
  assert.equal(total.persisted, true)
  const restored = new MeterEnergyCounter({ file })
  assert.deepEqual(restored.summary(), total)
  restored.accept(frame(now + 3_600_000), now + 3_600_000)
  close(restored.summary()!.importWh, total.importWh)
  assert.equal(restored.summary()!.gaps, 1)
  restored.accept(frame(now + 3_606_000), now + 3_606_000)
  close(restored.summary()!.importWh, total.importWh + watts / 600)
})

test('rising and falling power uses trapezoidal integration; sign crossings split import and export', () => {
  const { counter } = setup()
  counter.accept(frame(now, { active_power: 100 }), now)
  counter.accept(frame(now + 6000, { active_power: 200 }), now + 6000)
  close(counter.summary()!.importWh, 0.25)
  counter.accept(frame(now + 12000, { active_power: 0 }), now + 12000)
  close(counter.summary()!.importWh, 0.25 + 1 / 6)
  assert.equal(counter.summary()!.peakW, 200)
  assert.deepEqual(integratePower(100, -100, 1), { importWh: 25, exportWh: 25 })
  assert.deepEqual(integratePower(-100, 100, 1), { importWh: 25, exportWh: 25 })
})

test('stale, retained, malformed, wrong-topic, duplicate and out-of-order packets add no fabricated energy', () => {
  const { counter } = setup()
  counter.accept(frame(now), now)
  counter.accept(frame(now + 6000), now + 6000)
  const total = counter.summary()!.importWh
  counter.accept(frame(now + 6000), now + 6000)
  counter.accept(frame(now + 5000), now + 6000)
  counter.accept({ ...frame(now + 7000), topic: 'plc/data' }, now + 7000)
  close(counter.summary()!.importWh, total)
  for (const bad of [
    { ...frame(now + 12000), retained: true },
    frame(now - 20000),
    frame(now + 12000, { ...sample, current: 'bad' }),
    frame(now + 12000, { ...sample, power_model: 'three_phase' }),
  ]) counter.accept(bad, now + 12000)
  counter.accept(frame(now + 18000), now + 18000)
  close(counter.summary()!.importWh, total)
  counter.accept(frame(now + 40000), now + 40000)
  close(counter.summary()!.importWh, total)
  counter.disconnect()
  counter.accept(frame(now + 46000), now + 46000)
  close(counter.summary()!.importWh, total)
})

test('binary protobuf and JSON produce the same saved energy', () => {
  const wire = Buffer.from('090000000000205f40110000000000004e4019a245b6f3fdd4ec3f210000000000002440', 'hex')
  const { counter } = setup()
  for (const time of [now, now + 6000]) counter.accept(JSON.parse(createMeterFrame('meter/data', wire, time)), time)
  close(counter.summary()!.importWh, 1121.745 / 600)
})

test('corrupt saved totals are preserved; failed writes freeze the last durable total', () => {
  const { file, counter } = setup()
  counter.accept(frame(now), now)
  fs.mkdirSync(file + '.tmp') // Blocks the next atomic file write without changing permissions.
  counter.accept(frame(now + 6000), now + 6000)
  assert.equal(counter.summary()!.importWh, 0)
  assert.equal(counter.summary()!.persisted, false)
  assert.match(counter.error!, /could not be saved/)
  fs.writeFileSync(file, 'broken')
  const restored = new MeterEnergyCounter({ file })
  restored.accept(frame(now + 12000), now + 12000)
  assert.equal(fs.readFileSync(file, 'utf8'), 'broken')
  assert.equal(restored.summary(), null)
  assert.match(restored.error!, /could not be loaded/)
})

test('derived quantities preserve zero/missing cases and do not mislabel non-active power as reactive', () => {
  const t = { ...emptyMeterReading(now), voltage: sample.voltage, current: sample.current, powerFactor: sample.power_factor, activePower: watts, frequency: 60 }
  const d = deriveElectrical(t)
  close(d.apparentVa!, sample.voltage * sample.current)
  close(d.nonActiveVa!, d.apparentVa! * Math.sqrt(1 - sample.power_factor ** 2))
  close(d.cycleMs!, 1000 / 60)
  assert.equal(d.frequencyDeviationHz, 0)
  assert.equal(deriveElectrical({ ...t, current: 0, activePower: 0 }).nonActiveVa, 0)
  assert.equal(deriveElectrical({ ...t, current: null }).apparentVa, null)
  assert.equal(deriveElectrical({ ...t, frequency: 0 }).cycleMs, null)
  assert.equal(deriveElectrical({ ...t, activePower: 999 }).nonActiveVa, null)
})

test('browser consumes saved totals without integrating them again and exports their provenance', (context) => {
  context.mock.timers.enable({ apis: ['Date'], now })
  const { counter } = setup()
  const energy = counter.accept(frame(now), now)!
  const store = createMeterStore('websocket')
  store.getState().ingest(sample, energy)
  assert.deepEqual(store.getState().energy, energy)
  assert.equal(readEnergySummary({ ...energy, importWh: NaN }, now), null)
  assert.equal(readEnergySummary({ ...energy, lastTimestamp: now + 1000 }, now), null)
  store.getState().setSource('mqtt')
  assert.equal(store.getState().energy, null)
})
