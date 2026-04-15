/**
 * Zustand store for PLC state — enables synchronous reads from
 * both React DOM tree and R3F Canvas reconciler.
 *
 * React context (PLCContext) creates new objects on every update,
 * which causes race conditions with R3F's useFrame. Zustand's
 * getState() is synchronous and always returns the latest value,
 * regardless of React's render batching.
 */
import { create } from "zustand";
import type { PLCParameter } from "../types";

interface PLCStore {
  params: PLCParameter[];
  motorFanOn: boolean;
  emergencyLightOn: boolean;
  photoESensor: boolean;
  metalSensor: boolean;
  pushButton: boolean;
  relays: boolean[];
  alerts: boolean[];

  // Waveform history (updated externally)
  historyVoltage: number[];
  historyCurrent: number[];
  historyPH: number[];
  historyTemp: number[];

  // Actions
  updateFromPLC: (params: PLCParameter[], outputs: {
    motorFanOn: boolean;
    emergencyLightOn: boolean;
    photoESensor: boolean;
    metalSensor: boolean;
    pushButton: boolean;
    relay: boolean[];
    alerts: boolean[];
  }) => void;
  updateHistory: (hV: number[], hC: number[], hP: number[], hT: number[]) => void;
}

export const usePLCStore = create<PLCStore>((set) => ({
  params: [],
  motorFanOn: false,
  emergencyLightOn: false,
  photoESensor: false,
  metalSensor: false,
  pushButton: false,
  relays: [],
  alerts: [],
  historyVoltage: [],
  historyCurrent: [],
  historyPH: [],
  historyTemp: [],

  updateFromPLC: (params, outputs) => set({
    params,
    motorFanOn: outputs.motorFanOn,
    emergencyLightOn: outputs.emergencyLightOn,
    photoESensor: outputs.photoESensor,
    metalSensor: outputs.metalSensor,
    pushButton: outputs.pushButton,
    relays: outputs.relay ?? [],
    alerts: outputs.alerts ?? [],
  }),

  updateHistory: (hV, hC, hP, hT) => set({
    historyVoltage: hV,
    historyCurrent: hC,
    historyPH: hP,
    historyTemp: hT,
  }),
}));
