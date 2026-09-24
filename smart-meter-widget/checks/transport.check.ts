import assert from 'node:assert/strict'
import { EventEmitter } from 'node:events'
import { test } from 'node:test'
import { createMeterStore } from '../src/useMeterStore'
import { createInitialTelemetry } from '../src/meter/physics'
import { reconnectDelayMs, startMeterStream } from '../src/meter/transport'

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
  context.mock.timers.tick(10_000)
  assert.equal(store.getState().connection, 'disconnected')
  assert.match(store.getState().error ?? '', /stale/)
  assert.deepEqual(store.getState().telemetry, lastReadings)
  context.mock.timers.tick(1_000)
  assert.equal(sockets.length, 2)
  stop()
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
