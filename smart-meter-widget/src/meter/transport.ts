import type { MqttClient } from 'mqtt'
import { useMeterStore, type MeterStore } from '../useMeterStore'
import { MAX_PACKET_AGE_MS, stepMeter } from './physics'
import type { MeterSource, MeterStreamOptions } from './types'

export const SIMULATION_INTERVAL_MS = 100
export const STALE_STREAM_MS = 10_000
export const MAX_PACKET_BYTES = 65_536

type StoreApi = { getState: () => MeterStore }
type Socket = Pick<WebSocket, 'onopen' | 'onmessage' | 'onclose' | 'onerror' | 'close' | 'readyState'>

/** Dependency seam for transport tests and alternate browser runtimes. */
export interface StreamDependencies {
  createSocket?: (url: string) => Socket
  loadMqtt?: () => Promise<Pick<typeof import('mqtt'), 'connect'>>
  random?: () => number
}

export function reconnectDelayMs(attempt: number, random = Math.random): number {
  // Capped exponential backoff with ±20% jitter avoids synchronized reconnect storms.
  return Math.round(Math.min(30_000, 1_000 * 2 ** Math.min(Math.max(attempt, 0), 5)) * (0.8 + random() * 0.4))
}

function resolveOptions(overrides: Partial<MeterStreamOptions>): MeterStreamOptions | string {
  const env = import.meta.env ?? {}
  const source = overrides.source ?? env.VITE_METER_TRANSPORT ?? 'simulation'
  if (!['simulation', 'websocket', 'mqtt'].includes(source)) {
    return 'VITE_METER_TRANSPORT must be simulation, websocket, or mqtt.'
  }
  return {
    source: source as MeterSource,
    url: overrides.url ?? env.VITE_METER_URL,
    topic: overrides.topic ?? env.VITE_METER_TOPIC ?? 'meters/aituzero-2s/telemetry',
  }
}

/**
 * Start exactly one lifecycle-owned stream. Call once from a React effect and return
 * its cleanup. No network access or timers run merely by importing this module.
 */
export function startMeterStream(
  overrides: Partial<MeterStreamOptions> = {},
  store: StoreApi = useMeterStore,
  dependencies: StreamDependencies = {},
): () => void {
  const options = resolveOptions(overrides)
  if (typeof options === 'string') {
    store.getState().setConnection('error', options)
    return () => {}
  }
  store.getState().setSource(options.source)
  if (options.source === 'simulation') {
    store.getState().setConnection('simulated')
    let previousTick = performance.now()
    const interval = setInterval(() => {
      const monotonicNow = performance.now()
      const elapsedSeconds = Math.max(0, (monotonicNow - previousTick) / 1_000)
      previousTick = monotonicNow
      const state = store.getState()
      if (state.paused) return
      state.ingest(stepMeter(state.telemetry, state.controls, elapsedSeconds, Date.now(), dependencies.random, state.impPerKwh))
    }, SIMULATION_INTERVAL_MS)
    return () => clearInterval(interval)
  }

  let url: URL
  try {
    if (!options.url) throw new Error('Missing VITE_METER_URL. Configure a WebSocket endpoint.')
    url = new URL(options.url)
    if (url.protocol !== 'ws:' && url.protocol !== 'wss:') throw new Error('Browser connections require a ws:// or wss:// URL.')
    if (typeof location !== 'undefined' && location.protocol === 'https:' && url.protocol !== 'wss:') {
      throw new Error('Use wss:// for a dashboard served over HTTPS.')
    }
    if (url.username || url.password) throw new Error('Do not place broker credentials in browser connection URLs.')
  } catch (error) {
    store.getState().setConnection('error', error instanceof Error ? error.message : 'Invalid meter endpoint URL.')
    return () => {}
  }
  if (options.source === 'mqtt' && (!options.topic || options.topic.includes('#') || options.topic.includes('+'))) {
    store.getState().setConnection('error', 'Use a single device MQTT topic without wildcards.')
    return () => {}
  }

  let disposed = false
  let generation = 0
  let attempt = 0
  let attemptStartedAt = Date.now()
  let lastValidPacketAt: number | null = null
  let retryTimer: ReturnType<typeof setTimeout> | undefined
  let connectionTimer: ReturnType<typeof setTimeout> | undefined
  let closeCurrent = () => {}

  const clearConnectionTimer = () => {
    if (connectionTimer !== undefined) clearTimeout(connectionTimer)
    connectionTimer = undefined
  }

  const scheduleReconnect = (message: string) => {
    if (disposed || retryTimer !== undefined) return
    generation += 1
    clearConnectionTimer()
    closeCurrent()
    closeCurrent = () => {}
    store.getState().setConnection('disconnected', message)
    const delay = reconnectDelayMs(attempt++, dependencies.random)
    retryTimer = setTimeout(() => {
      retryTimer = undefined
      void connect()
    }, delay)
  }

  const receive = (text: string, token: number) => {
    if (disposed || token !== generation) return
    if (text.length > MAX_PACKET_BYTES || new TextEncoder().encode(text).byteLength > MAX_PACKET_BYTES) {
      store.getState().setConnection('error', 'Telemetry packet exceeds the 64 KiB limit.')
      return
    }
    let packet: unknown
    try {
      packet = JSON.parse(text)
    } catch {
      store.getState().setConnection('error', 'Rejected malformed JSON telemetry.')
      return
    }
    if (store.getState().ingest(packet)) {
      lastValidPacketAt = Date.now()
      attempt = 0
      clearConnectionTimer()
    }
  }

  const connect = async () => {
    if (disposed) return
    const token = ++generation
    attemptStartedAt = Date.now()
    lastValidPacketAt = null
    store.getState().setConnection('connecting')
    connectionTimer = setTimeout(() => scheduleReconnect('Meter connection timed out. Retrying…'), 8_000)
    try {
      if (options.source === 'websocket') {
        const socket = (dependencies.createSocket ?? ((address: string) => new WebSocket(address)))(url.href)
        closeCurrent = () => {
          socket.onopen = null
          socket.onmessage = null
          socket.onclose = null
          socket.onerror = null
          socket.close()
        }
        socket.onopen = () => {
          // A live socket alone is insufficient: wait for a valid meter packet.
          if (!disposed && token === generation) store.getState().setConnection('connecting')
        }
        socket.onmessage = (event) => {
          if (typeof event.data !== 'string') {
            if (!disposed && token === generation) store.getState().setConnection('error', 'Expected a UTF-8 JSON text frame.')
            return
          }
          receive(event.data, token)
        }
        socket.onclose = () => { if (token === generation) scheduleReconnect('Meter connection closed. Retrying…') }
        socket.onerror = () => { if (token === generation) scheduleReconnect('Unable to reach the meter gateway. Retrying…') }
      } else {
        const mqtt = await (dependencies.loadMqtt ?? (() => import('mqtt')))()
        if (disposed || token !== generation) return
        const client: MqttClient = mqtt.connect(url.href, {
          clean: true,
          manualConnect: true,
          reconnectPeriod: 0, // One shared, bounded retry policy owns reconnection.
          connectTimeout: 8_000,
          keepalive: 15,
          resubscribe: false,
          queueQoSZero: false,
        })
        closeCurrent = () => {
          client.removeAllListeners()
          // A late shutdown error must not become an unhandled EventEmitter error.
          client.on('error', () => {})
          client.end(true)
        }
        client.on('connect', () => {
          if (disposed || token !== generation) return
          client.subscribe(options.topic!, { qos: 1 }, (error, granted) => {
            if (disposed || token !== generation) return
            if (error || granted?.some((entry) => entry.qos > 2)) scheduleReconnect('MQTT telemetry subscription was rejected. Retrying…')
          })
        })
        client.on('message', (topic, payload) => {
          if (topic !== options.topic || disposed || token !== generation) return
          if (payload.byteLength > MAX_PACKET_BYTES) {
            store.getState().setConnection('error', 'Telemetry packet exceeds the 64 KiB limit.')
            return
          }
          receive(payload.toString('utf8'), token)
        })
        client.on('close', () => { if (token === generation) scheduleReconnect('MQTT connection closed. Retrying…') })
        client.on('error', () => { if (token === generation) scheduleReconnect('MQTT connection failed. Retrying…') })
        client.connect()
      }
    } catch (error) {
      if (!disposed && token === generation) {
        scheduleReconnect(error instanceof Error ? error.message : 'Meter transport failed. Retrying…')
      }
    }
  }

  const staleWatchdog = setInterval(() => {
    if (disposed || retryTimer !== undefined) return
    const now = Date.now()
    const sinceLastPacket = now - (lastValidPacketAt ?? attemptStartedAt)
    const staleTimestamp = lastValidPacketAt !== null && now - store.getState().telemetry.timestamp > MAX_PACKET_AGE_MS
    if (sinceLastPacket >= STALE_STREAM_MS || staleTimestamp) {
      scheduleReconnect('Telemetry is stale. Last readings are held while reconnecting…')
    }
  }, 1_000)
  void connect()

  return () => {
    if (disposed) return
    disposed = true
    generation += 1
    clearInterval(staleWatchdog)
    if (retryTimer !== undefined) clearTimeout(retryTimer)
    clearConnectionTimer()
    closeCurrent()
  }
}
