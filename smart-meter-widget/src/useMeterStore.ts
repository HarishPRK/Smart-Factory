import { create } from 'zustand'
import { clamp, createDefaultControls, createInitialTelemetry, DEFAULT_IMP_PER_KWH, HISTORY_WINDOW_MS, validateMeterTelemetry } from './meter/physics'
import type { CameraPreset, MeterConnection, MeterControls, MeterFault, MeterSource, MeterTelemetry } from './meter/types'

export interface MeterStore {
  telemetry: MeterTelemetry
  history: MeterTelemetry[]
  controls: MeterControls
  paused: boolean
  connection: MeterConnection
  source: MeterSource
  error: string | null
  lastPacketAt: number | null
  pulseOnUntil: number
  exploded: boolean
  thermal: boolean
  cameraPreset: CameraPreset
  annotations: boolean
  impPerKwh: number
  setLoadAmps: (amps: number) => void
  setPowerFactor: (powerFactor: number) => void
  setSolarExport: (enabled: boolean) => void
  toggleFault: (fault: MeterFault) => void
  clearFaults: () => void
  setPaused: (paused: boolean) => void
  setExploded: (enabled: boolean) => void
  setThermal: (enabled: boolean) => void
  setCameraPreset: (preset: CameraPreset) => void
  setAnnotations: (enabled: boolean) => void
  resetSimulation: () => void
  ingest: (packet: unknown) => boolean
  setConnection: (connection: MeterConnection, error?: string | null) => void
  setSource: (source: MeterSource) => void
}

/** Factory is exported so independent sessions and tests never share mutable state. */
export function createMeterStore() {
  return create<MeterStore>()((set, get) => ({
    telemetry: createInitialTelemetry(),
    history: [],
    controls: createDefaultControls(),
    paused: false,
    connection: 'simulated',
    source: 'simulation',
    error: null,
    lastPacketAt: null,
    pulseOnUntil: 0,
    exploded: false,
    thermal: false,
    cameraPreset: 'isometric',
    annotations: true,
    impPerKwh: DEFAULT_IMP_PER_KWH,
    setLoadAmps: (amps) => {
      if (get().source !== 'simulation' || !Number.isFinite(amps)) return
      set((state) => ({ controls: { ...state.controls, loadAmps: clamp(amps, 0, 200) } }))
    },
    setPowerFactor: (powerFactor) => {
      if (get().source !== 'simulation' || !Number.isFinite(powerFactor)) return
      set((state) => ({ controls: { ...state.controls, powerFactor: clamp(powerFactor, 0.85, 1) } }))
    },
    setSolarExport: (solarExport) => {
      if (get().source !== 'simulation') return
      set((state) => ({ controls: { ...state.controls, solarExport } }))
    },
    toggleFault: (fault) => {
      if (get().source !== 'simulation') return
      set((state) => {
        const otherVoltageFault = fault === 'sag' ? 'surge' : fault === 'surge' ? 'sag' : null
        const faults = state.controls.faults.includes(fault)
          ? state.controls.faults.filter((active) => active !== fault)
          : [...state.controls.faults.filter((active) => active !== otherVoltageFault), fault]
        return { controls: { ...state.controls, faults } }
      })
    },
    clearFaults: () => {
      if (get().source !== 'simulation') return
      set((state) => ({ controls: { ...state.controls, faults: [] } }))
    },
    setPaused: (paused) => { if (get().source === 'simulation') set({ paused }) },
    setExploded: (exploded) => set({ exploded }),
    setThermal: (thermal) => set({ thermal }),
    setCameraPreset: (cameraPreset) => set({ cameraPreset }),
    setAnnotations: (annotations) => set({ annotations }),
    resetSimulation: () => {
      if (get().source !== 'simulation') return
      set({
        telemetry: createInitialTelemetry(),
        history: [],
        controls: createDefaultControls(),
        paused: false,
        connection: 'simulated',
        error: null,
        lastPacketAt: null,
        pulseOnUntil: 0,
      })
    },
    ingest: (packet) => {
      const state = get()
      const now = Date.now()
      const result = validateMeterTelemetry(packet, state.lastPacketAt === null ? undefined : state.telemetry, now)
      if (!result.ok) {
        set({ error: `Telemetry rejected: ${result.error}` })
        return false
      }
      const telemetry = result.telemetry
      const recentHistory = state.history.filter((sample) => sample.timestamp > telemetry.timestamp - HISTORY_WINDOW_MS)
      const lastHistoryPoint = recentHistory.at(-1)
      // Keep fixed samples at 1 Hz; use telemetry directly for the fast-updating readouts.
      const history = !lastHistoryPoint || telemetry.timestamp - lastHistoryPoint.timestamp >= 1_000
        ? [...recentHistory, telemetry]
        : recentHistory
      set({
        telemetry,
        history,
        lastPacketAt: now,
        pulseOnUntil: telemetry.pulseCount > state.telemetry.pulseCount ? now + 45 : state.pulseOnUntil,
        connection: state.source === 'simulation' ? 'simulated' : 'connected',
        error: null,
      })
      return true
    },
    setConnection: (connection, error = null) => set({ connection, error }),
    setSource: (source) => {
      if (get().source === source) return
      set({
        source,
        paused: false,
        connection: source === 'simulation' ? 'simulated' : 'connecting',
        history: [],
        lastPacketAt: null,
        error: null,
        pulseOnUntil: 0,
      })
    },
  }))
}

export const useMeterStore = createMeterStore()
