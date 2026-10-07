import assert from 'node:assert/strict'
import { EventEmitter } from 'node:events'
import { test } from 'node:test'
import { createMeterStore } from '../src/useMeterStore'
import { createInitialTelemetry } from '../src/meter/physics'
import { defaultMeterBridgeUrl, reconnectDelayMs, STALE_STREAM_MS, startMeterStream } from '../src/meter/transport'
import { createMeterFrame } from '../../scripts/meter-wire.mjs'

class FakeSocket {
  onopen: WebSocket['onopen'] = null
  onmessage: WebSocket['onmessage'] = null
  onclose: WebSocket['onclose'] = null
  onerror: WebSocket['onerror'] = null
  readyState: WebSocket['readyState'] = 1
  closed = false
  close() { this.closed = true; this.readyState = 3 }
  message(data: unknown) { this.onmessage?.call(this as unknown as WebSocket, { data } as MessageEvent) }
  disconnect() { this.onclose?.call(this as unknown as WebSocket, {} as CloseEvent) }
}

test('protobuf traverses the actual bridge envelope and binary socket path, rejects stale/retained/invalid data and recovers', (context) => {
  context.mock.timers.enable({ apis: ['setInterval', 'setTimeout', 'Date'], now: Date.now() })
  const wire = Buffer.from('090000000000205f40110000000000004e4019a245b6f3fdd4ec3f210000000000002440', 'hex')
  const store = createMeterStore('websocket')
  const socket = new FakeSocket()
  const stop = startMeterStream({ source: 'websocket', url: 'ws://localhost/ws' }, store, { createSocket: () => socket })
  try {
    socket.message(createMeterFrame('other/topic', wire))
    assert.equal(store.getState().lastPacketAt, null)
    socket.message(createMeterFrame('meter/data', wire, Date.now(), true))
    assert.equal(store.getState().lastPacketAt, null)
    socket.message(createMeterFrame('meter/data', wire, Date.now() - 20_000))
    assert.equal(store.getState().lastPacketAt, null)
    socket.message(createMeterFrame('meter/data', wire))
    assert.equal(store.getState().connection, 'connected')
    assert.ok(Math.abs(store.getState().telemetry.activePower! - 1121.745) < 1e-8)
    const previous = store.getState().telemetry
    context.mock.timers.tick(1000)
    socket.message(createMeterFrame('meter/data', wire.subarray(0, 35)))
    assert.equal(store.getState().telemetry, previous)
    socket.message(Uint8Array.from(wire).buffer)
    assert.equal(store.getState().connection, 'connected')
    assert.equal(store.getState().error, null)
    assert.equal(store.getState().telemetry.activePowerSource, 'calculated')
    assert.equal(store.getState().history.length, 2)
  } finally { stop() }
})

test('simulation pause stops energy and resume does not accumulate paused time', (context) => {
  context.mock.timers.enable({ apis: ['setInterval', 'setTimeout', 'Date'], now: Date.now() })
  let elapsed = 0
  context.mock.method(performance, 'now', () => elapsed)
  const store = createMeterStore()
  const stop = startMeterStream({ source: 'simulation' }, store, { random: () => 0.25 })
  elapsed = 100
  context.mock.timers.tick(100)
  const first = store.getState().telemetry.importKwh
  store.getState().setPaused(true)
  elapsed += 10_000
  context.mock.timers.tick(10_000)
  assert.equal(store.getState().telemetry.importKwh, first)
  store.getState().setPaused(false)
  elapsed += 100
  context.mock.timers.tick(100)
  const second = store.getState().telemetry.importKwh
  assert.ok(Math.abs((second - first) - (240 * 42 * 0.96 * 0.1 / 3_600_000)) < 1e-9)
  stop()
  elapsed += 100
  context.mock.timers.tick(100)
  assert.equal(store.getState().telemetry.importKwh, second)
})

test('WebSocket accepts valid data, recovers from bad frames, and fully releases on cleanup', (context) => {
  context.mock.timers.enable({ apis: ['setInterval', 'setTimeout', 'Date'], now: Date.now() })
  const store = createMeterStore()
  const sockets: FakeSocket[] = []
  const stop = startMeterStream({ source: 'websocket', url: 'ws://localhost:4000/meter' }, store, {
    createSocket: () => { const socket = new FakeSocket(); sockets.push(socket); return socket },
    random: () => 0.5,
  })
  assert.equal(store.getState().connection, 'connecting')
  sockets[0].message('{malformed')
  assert.equal(store.getState().connection, 'error')
  sockets[0].message(JSON.stringify(createInitialTelemetry()))
  assert.equal(store.getState().connection, 'connected')
  sockets[0].disconnect()
  assert.equal(store.getState().connection, 'disconnected')
  assert.equal(sockets[0].closed, true)
  context.mock.timers.tick(1_000)
  assert.equal(sockets.length, 2)
  stop()
  stop()
  assert.equal(sockets[1].closed, true)
  assert.equal(sockets[1].onmessage, null)
  context.mock.timers.tick(120_000)
  assert.equal(sockets.length, 2)
})

test('quiet remote stream becomes stale, holds its readings, and reconnects', (context) => {
  context.mock.timers.enable({ apis: ['setInterval', 'setTimeout', 'Date'], now: Date.now() })
  const store = createMeterStore()
  const sockets: FakeSocket[] = []
  const stop = startMeterStream({ source: 'websocket', url: 'ws://localhost/meter' }, store, {
    createSocket: () => { const socket = new FakeSocket(); sockets.push(socket); return socket },
    random: () => 0.5,
  })
  sockets[0].message(JSON.stringify(createInitialTelemetry()))
  const lastReadings = store.getState().telemetry
  context.mock.timers.tick(STALE_STREAM_MS)
  assert.equal(store.getState().connection, 'disconnected')
  assert.match(store.getState().error ?? '', /stale/)
  assert.deepEqual(store.getState().telemetry, lastReadings)
  context.mock.timers.tick(1_000)
  assert.equal(sockets.length, 2)
  stop()
})

test('factory bridge filters topics, uses bridge time, rejects stale replay, and never retains simulated fields', (context) => {
  context.mock.timers.enable({ apis: ['setInterval', 'setTimeout', 'Date'], now: Date.now() })
  const store = createMeterStore()
  const socket = new FakeSocket()
  const stop = startMeterStream({ source: 'websocket', url: 'ws://localhost/ws' }, store, { createSocket: () => socket })
  try {
    assert.equal(store.getState().telemetry.activePower, null)
    socket.message(JSON.stringify({ topic: 'plc/data', payload: { voltage: 999 } }))
    assert.equal(store.getState().lastPacketAt, null)
    socket.message(JSON.stringify({ topic: 'meter/data', retained: true, publishedAt: Date.now(), payload: { voltage: 124.5 } }))
    assert.equal(store.getState().lastPacketAt, null)
    assert.match(store.getState().error ?? '', /Retained/)
    socket.message(JSON.stringify({ topic: 'meter/data', publishedAt: Date.now(), payload: { voltage: 124.5, frequency: 60, power_factor: 0.901 } }))
    assert.equal(store.getState().connection, 'connected')
    assert.equal(store.getState().telemetry.voltage, 124.5)
    assert.equal(store.getState().telemetry.powerFactor, 0.901)
    assert.equal(store.getState().telemetry.activePower, null)
    assert.equal(store.getState().telemetry.importKwh, null)
    const lastPacket = store.getState().lastPacketAt
    context.mock.timers.tick(6_000)
    socket.message(JSON.stringify({ topic: 'meter/data', publishedAt: Date.now() - 20_000, payload: { voltage: 200 } }))
    assert.equal(store.getState().lastPacketAt, lastPacket)
    socket.message(JSON.stringify({ topic: 'meter/data', publishedAt: Date.now(), payload: JSON.stringify({ voltage: 124.4, power_factor: 0.9, frequency: 60 }) }))
    assert.equal(store.getState().telemetry.voltage, 124.4)
    assert.equal(store.getState().history.length, 2)
    context.mock.timers.tick(14_000)
    socket.message(JSON.stringify({ topic: 'plc/data', payload: { voltage: 123 } }))
    context.mock.timers.tick(1_000)
    assert.equal(store.getState().connection, 'disconnected')
    assert.equal(store.getState().telemetry.voltage, 124.4)
    assert.equal(store.getState().source, 'websocket')
  } finally { stop() }
})

test('production uses the existing same-origin bridge and local development uses port 9001', () => {
  assert.equal(defaultMeterBridgeUrl({ protocol: 'http:', hostname: '3.239.12.96', host: '3.239.12.96' }), 'ws://3.239.12.96/ws')
  assert.equal(defaultMeterBridgeUrl({ protocol: 'https:', hostname: 'factory.example', host: 'factory.example' }), 'wss://factory.example/ws')
  assert.equal(defaultMeterBridgeUrl({ protocol: 'http:', hostname: 'localhost', host: 'localhost:5173' }), 'ws://localhost:9001')
})

test('bad endpoints fail clearly without silently starting simulated data', () => {
  for (const url of ['https://example.test/meter', 'mqtt://localhost:1883', 'ws://user:secret@localhost/meter', 'invalid']) {
    const store = createMeterStore()
    const stop = startMeterStream({ source: 'mqtt', url }, store)
    assert.equal(store.getState().source, 'mqtt')
    assert.equal(store.getState().connection, 'error')
    assert.equal(store.getState().lastPacketAt, null)
    stop()
  }
})

test('MQTT dynamic import completing after unmount never opens a connection', async (context) => {
  context.mock.timers.enable({ apis: ['setInterval', 'setTimeout'] })
  const store = createMeterStore()
  let resolveModule!: (module: Pick<typeof import('mqtt'), 'connect'>) => void
  const loadMqtt = () => new Promise<Pick<typeof import('mqtt'), 'connect'>>((resolve) => { resolveModule = resolve })
  let connections = 0
  const stop = startMeterStream({ source: 'mqtt', url: 'wss://example.test/mqtt' }, store, { loadMqtt })
  stop()
  resolveModule({ connect: (() => { connections++; throw new Error('Must not connect') }) as typeof import('mqtt')['connect'] })
  await Promise.resolve()
  assert.equal(connections, 0)
  context.mock.timers.tick(60_000)
  assert.equal(connections, 0)
})

test('MQTT subscribes to the exact device topic, ingests packets, and ends its client on cleanup', async (context) => {
  context.mock.timers.enable({ apis: ['setInterval', 'setTimeout'] })
  class FakeMqtt extends EventEmitter {
    ended = false
    topic = ''
    qos = -1
    connect() { this.emit('connect'); return this }
    subscribe(topic: string, options: { qos: number }, callback: (error: null, granted: { qos: number }[]) => void) {
      this.topic = topic
      this.qos = options.qos
      callback(null, [{ qos: 1 }])
      return this
    }
    end() { this.ended = true; return this }
  }
  const client = new FakeMqtt()
  const store = createMeterStore()
  const stop = startMeterStream({ source: 'mqtt', url: 'wss://example.test/mqtt', topic: 'meters/one/telemetry' }, store, {
    loadMqtt: async () => ({ connect: (() => client) as unknown as typeof import('mqtt')['connect'] }),
  })
  await Promise.resolve()
  assert.equal(client.topic, 'meters/one/telemetry')
  assert.equal(client.qos, 1)
  client.emit('message', 'meters/two/telemetry', Buffer.from(JSON.stringify(createInitialTelemetry())))
  assert.equal(store.getState().lastPacketAt, null)
  client.emit('message', client.topic, Buffer.from(JSON.stringify(createInitialTelemetry())))
  assert.equal(store.getState().connection, 'connected')
  const wire = Buffer.from('090000000000205f40110000000000004e4019a245b6f3fdd4ec3f210000000000002440', 'hex')
  store.getState().setSource('simulation')
  store.getState().setSource('mqtt')
  client.emit('message', client.topic, wire, { retain: true })
  assert.equal(store.getState().lastPacketAt, null)
  client.emit('message', client.topic, wire, { retain: false })
  assert.equal(store.getState().telemetry.current, 10)
  assert.ok(Math.abs(store.getState().telemetry.activePower! - 1121.745) < 1e-8)
  client.emit('message', client.topic, Buffer.alloc(65_537))
  assert.equal(store.getState().connection, 'error')
  assert.match(store.getState().error ?? '', /64 KiB/)
  stop()
  assert.equal(client.ended, true)
  assert.equal(client.listenerCount('message'), 0)
})

test('reconnect backoff grows exponentially and stays capped with jitter', () => {
  assert.equal(reconnectDelayMs(0, () => 0.5), 1_000)
  assert.equal(reconnectDelayMs(1, () => 0.5), 2_000)
  assert.equal(reconnectDelayMs(2, () => 0.5), 4_000)
  assert.equal(reconnectDelayMs(99, () => 0.5), 30_000)
  assert.equal(reconnectDelayMs(99, () => 1), 36_000)
})
