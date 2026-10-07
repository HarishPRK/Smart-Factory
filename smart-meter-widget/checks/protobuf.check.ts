import assert from 'node:assert/strict'
import { test } from 'node:test'
import { createMeterFrame } from '../../scripts/meter-wire.mjs'
import { decodeMeterBase64, decodeMeterBytes, decodeMeterData } from '../src/meter/protobuf'
import { normalizeLiveTelemetry } from '../src/meter/live'

// Independent fixture: Python struct.pack('<d', value), fields 1,2,3,4.
const wire = Buffer.from('090000000000205f40110000000000004e4019a245b6f3fdd4ec3f210000000000002440', 'hex')
const expected = { voltage: 124.5, frequency: 60, power_factor: 0.901, current: 10 }

test('MeterData maps four protobuf doubles, including byte offsets and reordered fields', () => {
  assert.deepEqual(decodeMeterData(wire), expected)
  const padded = Buffer.concat([Buffer.from([255, 255]), wire, Buffer.from([0])])
  assert.deepEqual(decodeMeterData(padded.subarray(2, -1)), expected)
  assert.deepEqual(decodeMeterData(Buffer.concat([wire.subarray(27), wire.subarray(0, 27)])), expected)
  // Singular fields are last-one-wins, per protobuf semantics.
  const duplicate = Buffer.alloc(9); duplicate[0] = 9; duplicate.writeDoubleLE(120, 1)
  assert.equal(decodeMeterData(Buffer.concat([wire, duplicate])).voltage, 120)
})

test('proto3 zero defaults support zero-current loads, zero PF, and an all-zero packet', () => {
  assert.equal(decodeMeterData(wire.subarray(0, 27)).current, 0)
  const noPf = Buffer.concat([wire.subarray(0, 18), wire.subarray(27)])
  assert.equal(decodeMeterData(noPf).power_factor, 0)
  assert.deepEqual(decodeMeterData(new Uint8Array()), { voltage: 0, frequency: 0, power_factor: 0, current: 0 })
  const result = normalizeLiveTelemetry(decodeMeterBytes(wire.subarray(0, 27)))
  assert.ok(result.ok)
  assert.equal(result.telemetry.activePower, 0)
})

test('unknown varint, fixed64, bytes and fixed32 fields are safely skipped', () => {
  const future = Buffer.from('2896013100000000000000003a036162634500000000', 'hex')
  assert.deepEqual(decodeMeterData(Buffer.concat([future, wire])), expected)
})

test('malformed protobuf, wrong double wire types, oversized packets and nonfinite readings fail', () => {
  const invalid = [wire.subarray(0, 35), Buffer.from([8, 1]), Buffer.from([0]), Buffer.from([0x80]), Buffer.alloc(10, 255), Buffer.from([0x2a, 255, 255, 255, 255, 15]), Buffer.from([0x2b]), Buffer.from([0x2d, 1]), Buffer.from([0x28, 1]), Buffer.alloc(65_537)]
  for (const value of [NaN, Infinity]) {
    const packet = Buffer.from(wire); packet.writeDoubleLE(value, 1); invalid.push(packet)
  }
  for (const packet of invalid) assert.throws(() => decodeMeterData(packet))
  assert.throws(() => decodeMeterBase64('***'))
})

test('bridge preserves exact binary bytes and browser derives 1.121745 kW without simulated data', () => {
  const envelope = JSON.parse(createMeterFrame('meter/data', wire, Date.now()))
  assert.equal(envelope.encoding, 'protobuf')
  assert.deepEqual(Buffer.from(envelope.payload, 'base64'), wire)
  const result = normalizeLiveTelemetry(decodeMeterBase64(envelope.payload))
  assert.ok(result.ok)
  assert.equal(result.telemetry.current, 10)
  assert.ok(Math.abs(result.telemetry.activePower! / 1000 - 1.121745) < 1e-10)
  assert.equal(result.telemetry.activePowerSource, 'calculated')
  assert.equal(result.telemetry.importKwh, null)
  assert.equal(result.telemetry.temperature, null)
  assert.equal(result.telemetry.alarms, null)
  assert.throws(() => createMeterFrame('meter/data', Buffer.alloc(65_537)))
})

test('JSON firmware remains compatible and retained protobuf messages keep their retained marker', () => {
  const json = Buffer.from(JSON.stringify(expected))
  assert.deepEqual(decodeMeterBytes(json), expected)
  assert.deepEqual(JSON.parse(createMeterFrame('meter/data', json)).payload, expected)
  assert.equal(JSON.parse(createMeterFrame('meter/data', wire, Date.now(), true)).retained, true)
})
