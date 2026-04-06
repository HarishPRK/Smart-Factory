/**
 * PLC Simulation Engine
 *
 * Generates realistic, continuously changing PLC values in mock mode.
 * Also provides scenario playbacks (Normal, Overload, Emergency Shutdown).
 *
 * Writes directly to the Zustand PLC store so the 3D scene reacts instantly.
 */
import { usePLCStore } from "./plcStore";
import type { PLCParameter } from "../types";

/* ── Value generators ─────────────────────────────────── */

function clamp(v: number, min: number, max: number) {
  return Math.max(min, Math.min(max, v));
}

function drift(current: number, nominal: number, min: number, max: number, volatility: number, dt: number) {
  // Mean-reverting random walk
  const pull = (nominal - current) * 0.02 * dt;
  const noise = (Math.random() - 0.5) * volatility * dt;
  return clamp(current + pull + noise, min, max);
}

/* ── Simulation state ─────────────────────────────────── */

interface SimState {
  voltage: number;
  current: number;
  pH: number;
  temperature: number;
  motorOn: boolean;
  emergencyOn: boolean;
  photoE: boolean;
  metal: boolean;
  pushButton: boolean;
  relays: boolean[];
  alerts: boolean[];
  // Scenario
  activeScenario: string | null;
  scenarioStep: number;
  scenarioStartTime: number;
}

const state: SimState = {
  voltage: 5.0,
  current: 6.0,
  pH: 7.0,
  temperature: 25,
  motorOn: false,
  emergencyOn: false,
  photoE: false,
  metal: false,
  pushButton: false,
  relays: [false, false, false, false, false, false, false, false],
  alerts: [false, false, false, false],
  activeScenario: null,
  scenarioStep: 0,
  scenarioStartTime: 0,
};

/* ── Build PLCParameter array from sim state ──────────── */

function statusOf(val: number, low: number, high: number): "normal" | "warning" | "critical" {
  if (val > high * 0.85 || val < low + (high - low) * 0.1) return "critical";
  if (val > high * 0.7 || val < low + (high - low) * 0.15) return "warning";
  return "normal";
}

// Persistent params array — mutated in place to avoid GC churn at 30 Hz
const persistentParams: PLCParameter[] = [
  { id: "voltage", label: "Voltage", kind: "analog", value: 5.0, unit: "V", min: 0, max: 12, nominal: 5.0, decimals: 1, accentHex: "#f59e0b", status: "normal" },
  { id: "current", label: "Current", kind: "analog", value: 6.0, unit: "A", min: 0, max: 10, nominal: 6.0, decimals: 1, accentHex: "#06b6d4", status: "normal" },
  { id: "relay", label: "Relay", kind: "relay", active: false, accentHex: "#10b981", status: "normal" },
  { id: "ph", label: "pH", kind: "analog", value: 7.0, unit: "", min: 0, max: 14, nominal: 7.0, decimals: 1, accentHex: "#8b5cf6", status: "normal" },
  { id: "photoE", label: "Photo-E", kind: "digital", active: false, accentHex: "#10b981", status: "normal" },
  { id: "metal", label: "Metal Det.", kind: "digital", active: false, accentHex: "#f97316", status: "normal" },
];

function updateParams() {
  persistentParams[0].value = state.voltage; persistentParams[0].status = statusOf(state.voltage, 0, 12);
  persistentParams[1].value = state.current; persistentParams[1].status = statusOf(state.current, 0, 10);
  persistentParams[2].active = state.relays[0]; persistentParams[2].accentHex = state.motorOn ? "#ef4444" : "#10b981";
  persistentParams[3].value = state.pH; persistentParams[3].status = statusOf(state.pH, 0, 14);
  persistentParams[4].active = state.photoE;
  persistentParams[5].active = state.metal;
}

/* ── Push state to Zustand store ──────────────────────── */

// History buffers — keep last 100 values for oscilloscope
const MAX_HISTORY = 100;
const hVoltage: number[] = [];
const hCurrent: number[] = [];
const hPH: number[] = [];
const hTemp: number[] = [];

function pushHistory(arr: number[], val: number) {
  arr.push(val);
  if (arr.length > MAX_HISTORY) arr.shift();
}

// Throttle React setState to ~2 Hz while ticking sim at 30 Hz
let plcPushCounter = 0;
const PLC_REACT_EVERY_N = 15; // every ~500ms at 33ms tick

function pushToStore() {
  updateParams();
  plcPushCounter++;
  const writeHistory = plcPushCounter % PLC_REACT_EVERY_N === 0;

  if (writeHistory) {
    pushHistory(hVoltage, state.voltage);
    pushHistory(hCurrent, state.current);
    pushHistory(hPH, state.pH);
    pushHistory(hTemp, state.temperature);
  }

  // During scenarios, simulation controls motor/emergency.
  // Otherwise, preserve whatever the user set via buttons.
  const currentStore = usePLCStore.getState();
  const isScenarioActive = state.activeScenario !== null;

  if (!isScenarioActive) {
    state.motorOn = currentStore.motorFanOn;
    state.emergencyOn = currentStore.emergencyLightOn;
  }

  // Always write params (3D reads via getState() — no React overhead).
  // Only spread histories on the slow path to avoid GC churn.
  if (writeHistory) {
    usePLCStore.setState({
      params: persistentParams,
      motorFanOn: state.motorOn,
      emergencyLightOn: state.emergencyOn,
      photoESensor: state.photoE,
      metalSensor: state.metal,
      pushButton: state.pushButton,
      relays: [...state.relays],
      alerts: [...state.alerts],
      historyVoltage: [...hVoltage],
      historyCurrent: [...hCurrent],
      historyPH: [...hPH],
      historyTemp: [...hTemp],
    });
  } else {
    // Fast path: only update what 3D scene reads via getState()
    usePLCStore.setState({
      params: persistentParams,
      motorFanOn: state.motorOn,
      emergencyLightOn: state.emergencyOn,
      photoESensor: state.photoE,
      metalSensor: state.metal,
      pushButton: state.pushButton,
    });
  }
}

/* ── Normal tick — continuous drift ───────────────────── */

function tickNormal(dt: number) {
  state.voltage = drift(state.voltage, 5.0, 2, 10, 0.8, dt);
  state.current = drift(state.current, 6.0, 1, 9, 0.6, dt);
  state.pH = drift(state.pH, 7.0, 5.5, 8.5, 0.3, dt);
  state.temperature = drift(state.temperature, 25, 18, 45, 0.5, dt);

  // Random sensor blips
  if (state.motorOn) {
    // Photo-E triggers periodically when motor running (simulating parts passing)
    state.photoE = Math.random() < 0.05;
    // Metal detector rarely triggers
    state.metal = Math.random() < 0.008;
  } else {
    state.photoE = false;
    state.metal = false;
  }
}

/* ── Scenarios ────────────────────────────────────────── */

type ScenarioFn = (elapsed: number, dt: number) => boolean; // returns true when done

const scenarios: Record<string, ScenarioFn> = {
  normal_operation: (elapsed, dt) => {
    // 0-5s: motor starts, values stabilize
    if (elapsed < 2) {
      state.motorOn = true;
      state.relays[0] = true;
      state.voltage = drift(state.voltage, 5.0, 4, 6, 0.3, dt);
      state.current = drift(state.current, 6.0, 5, 7, 0.2, dt);
    }
    // 2-15s: steady operation with periodic photo-E triggers
    else if (elapsed < 15) {
      state.voltage = drift(state.voltage, 5.0, 4.5, 5.5, 0.15, dt);
      state.current = drift(state.current, 6.0, 5.5, 6.5, 0.1, dt);
      state.pH = drift(state.pH, 7.0, 6.8, 7.2, 0.05, dt);
      state.temperature = drift(state.temperature, 28, 25, 32, 0.2, dt);
      state.photoE = Math.sin(elapsed * 3) > 0.8;
      state.metal = false;
    }
    // 15-20s: wind down
    else if (elapsed < 20) {
      state.photoE = false;
      state.temperature = drift(state.temperature, 25, 20, 30, 0.3, dt);
    }
    else {
      state.motorOn = false;
      state.relays[0] = false;
      return true;
    }
    return false;
  },

  overload_event: (elapsed, dt) => {
    // 0-3s: normal start
    if (elapsed < 3) {
      state.motorOn = true;
      state.relays[0] = true;
      state.voltage = drift(state.voltage, 5.0, 4, 6, 0.3, dt);
      state.current = drift(state.current, 6.0, 5, 7, 0.3, dt);
    }
    // 3-8s: voltage drops, current spikes — OVERLOAD
    else if (elapsed < 8) {
      state.voltage = drift(state.voltage, 3.0, 1.5, 4, 1.5, dt);
      state.current = drift(state.current, 9.0, 7, 10, 1.0, dt);
      state.temperature = drift(state.temperature, 70, 50, 90, 3, dt);
      state.pH = drift(state.pH, 5.5, 4, 7, 0.8, dt);
      state.alerts[0] = true;
      state.alerts[1] = elapsed > 5;
      state.photoE = Math.random() < 0.3;
      state.metal = Math.random() < 0.15;
    }
    // 8-12s: emergency triggers, motor stops
    else if (elapsed < 12) {
      state.emergencyOn = true;
      state.alerts[2] = true;
      state.voltage = drift(state.voltage, 2.0, 1, 3, 0.5, dt);
      state.current = drift(state.current, 8.5, 7, 10, 0.5, dt);
      state.temperature = drift(state.temperature, 85, 75, 95, 1, dt);
    }
    // 12-18s: recovery
    else if (elapsed < 18) {
      state.motorOn = false;
      state.relays[0] = false;
      state.emergencyOn = elapsed < 15;
      state.voltage = drift(state.voltage, 5.0, 3, 7, 0.8, dt);
      state.current = drift(state.current, 3.0, 1, 5, 0.5, dt);
      state.temperature = drift(state.temperature, 40, 30, 60, 1.5, dt);
      state.alerts = [elapsed < 14, elapsed < 15, elapsed < 16, false];
      state.photoE = false;
      state.metal = false;
    }
    else {
      state.alerts = [false, false, false, false];
      state.emergencyOn = false;
      return true;
    }
    return false;
  },

  emergency_shutdown: (elapsed, dt) => {
    // 0-2s: everything running
    if (elapsed < 2) {
      state.motorOn = true;
      state.relays = [true, true, true, false, false, false, false, false];
      state.voltage = drift(state.voltage, 5.0, 4, 6, 0.3, dt);
      state.current = drift(state.current, 7.0, 6, 8, 0.3, dt);
      state.photoE = true;
    }
    // 2-4s: EMERGENCY — everything flashes
    else if (elapsed < 4) {
      state.emergencyOn = true;
      state.alerts = [true, true, true, true];
      state.voltage = drift(state.voltage, 1.0, 0, 3, 3, dt);
      state.current = drift(state.current, 9.5, 8, 10, 2, dt);
      state.temperature = drift(state.temperature, 90, 70, 100, 5, dt);
    }
    // 4-6s: shutdown sequence
    else if (elapsed < 6) {
      state.motorOn = false;
      state.relays = [false, false, false, false, false, false, false, false];
      state.photoE = false;
      state.metal = false;
      state.current = drift(state.current, 0.5, 0, 2, 1, dt);
      state.voltage = drift(state.voltage, 0.5, 0, 2, 1, dt);
    }
    // 6-12s: cooldown
    else if (elapsed < 12) {
      state.emergencyOn = Math.sin(elapsed * 4) > 0;
      state.alerts = [elapsed < 8, elapsed < 9, elapsed < 10, elapsed < 11];
      state.temperature = drift(state.temperature, 30, 20, 50, 2, dt);
      state.voltage = drift(state.voltage, 5.0, 3, 7, 0.5, dt);
      state.current = drift(state.current, 1.0, 0, 3, 0.3, dt);
    }
    else {
      state.emergencyOn = false;
      state.alerts = [false, false, false, false];
      state.voltage = 5.0;
      state.current = 1.0;
      return true;
    }
    return false;
  },
};

/* ── Main simulation loop ─────────────────────────────── */

let intervalId: ReturnType<typeof setInterval> | null = null;
let lastTime = Date.now();

function tick() {
  const now = Date.now();
  const dt = (now - lastTime) / 1000;
  lastTime = now;

  if (state.activeScenario && scenarios[state.activeScenario]) {
    const elapsed = (now - state.scenarioStartTime) / 1000;
    const done = scenarios[state.activeScenario](elapsed, dt);
    if (done) {
      state.activeScenario = null;
    }
  } else {
    tickNormal(dt);
  }

  pushToStore();
}

/* ── Public API ───────────────────────────────────────── */

export function startSimulation() {
  if (intervalId) return;
  lastTime = Date.now();
  intervalId = setInterval(tick, 33); // ~30 Hz — smooth sensor drift visible in 3D useFrame
}

export function stopSimulation() {
  if (intervalId) {
    clearInterval(intervalId);
    intervalId = null;
  }
}

export function runScenario(name: string) {
  state.activeScenario = name;
  state.scenarioStartTime = Date.now();
}

export function isSimulationRunning() {
  return intervalId !== null;
}

export function getActiveScenario() {
  return state.activeScenario;
}

export const SCENARIOS = [
  { id: "normal_operation", label: "Normal Operation", duration: "20s", color: "#22c55e", description: "Motor start → steady production → wind down" },
  { id: "overload_event", label: "Overload Event", duration: "18s", color: "#f59e0b", description: "Normal → voltage drop → current spike → emergency → recovery" },
  { id: "emergency_shutdown", label: "Emergency Shutdown", duration: "12s", color: "#ef4444", description: "Running → full emergency → shutdown → cooldown" },
];
