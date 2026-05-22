/**
 * Digital Twin Zustand Store — Performance-Optimized
 *
 * CRITICAL PATTERN: 3D components read via getState() inside useFrame.
 * Only the 2D panel subscribes via React hooks, and only to `tick`.
 *
 * The simulation mutates stages/products arrays IN PLACE and bumps `tick`.
 * This avoids creating new object references every 500ms.
 */
import { create } from "zustand";
import type {
  ManufacturingStage,
  ProductOnBelt,
} from "../types/digitalTwin";

const MAX_HISTORY = 100;

export interface DigitalTwinStore {
  /** Monotonically increasing counter — bumped every sim tick.
   *  2D UI subscribes to this to know when to re-read. */
  tick: number;

  /** Mutable arrays — simulation writes in place, 3D reads via getState() */
  stages: ManufacturingStage[];
  products: ProductOnBelt[];
  conveyorSpeedMultiplier: number;

  /** User-controlled speed override from the controls panel (0-3x) */
  userSpeedMultiplier: number;

  simulationActive: boolean;
  activeScenario: string | null;

  totalProduced: number;
  totalRejected: number;
  throughputPerMin: number;

  /** Ring-buffer histories — mutated in place by simulation */
  sensorHistories: Record<string, number[]>;
}

export const useDigitalTwinStore = create<DigitalTwinStore>(() => ({
  tick: 0,
  stages: [],
  products: [],
  conveyorSpeedMultiplier: 1,
  userSpeedMultiplier: 1,
  simulationActive: false,
  activeScenario: null,
  totalProduced: 0,
  totalRejected: 0,
  throughputPerMin: 0,
  sensorHistories: {},
}));

/* ── Imperative helpers (called by simulation, no React overhead) ── */

/** Push a sensor value into its ring buffer — mutates in place */
export function pushSensorHistory(sensorId: string, value: number) {
  const histories = useDigitalTwinStore.getState().sensorHistories;
  let arr = histories[sensorId];
  if (!arr) {
    arr = [];
    histories[sensorId] = arr;
  }
  arr.push(value);
  if (arr.length > MAX_HISTORY) arr.shift();
}

/**
 * Called every sim tick (~33ms). Updates scalar values that 3D reads
 * via getState(). Only bumps `tick` (which triggers React UI re-render)
 * every UI_THROTTLE_MS to keep the 2D panel at a sane refresh rate.
 *
 * Lowered from 500 ms → 120 ms so the SensorHUD, ControlBoard3D banners,
 * and PLC widgets feel like they're tracking live MQTT data rather than
 * updating twice a second. 120 ms gives ~8 Hz React refresh, well below
 * the 30 Hz sim tick and cheap for the subscriber set we have today.
 */
const UI_THROTTLE_MS = 120;
let lastUiTick = 0;

export function commitTick(
  conveyorSpeed: number,
  throughput: number,
  produced: number,
  rejected: number,
) {
  const now = Date.now();
  const bumpUi = now - lastUiTick >= UI_THROTTLE_MS;
  if (bumpUi) lastUiTick = now;

  // Combine simulation conveyor speed with user speed override
  // Always update scalars (3D reads these via getState() every frame)
  // Only bump tick when the 2D panel should refresh
  useDigitalTwinStore.setState((s) => ({
    conveyorSpeedMultiplier: conveyorSpeed * s.userSpeedMultiplier,
    throughputPerMin: throughput,
    totalProduced: produced,
    totalRejected: rejected,
    ...(bumpUi ? { tick: s.tick + 1 } : {}),
  }));
}
