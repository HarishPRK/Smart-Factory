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
  /** True when an authorized operator badge is presented to Board A's RFID
   *  reader. Gates the intake stage via applyPLCOperationalOverrides. */
  rfidAuthorized: boolean;
  /** UI override for RFID testing — null = use live MQTT value, true/false =
   *  force that value into the simulation. */
  rfidOverride: boolean | null;
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
    rfidAuthorized: boolean;
    pushButton: boolean;
    relay: boolean[];
    alerts: boolean[];
  }) => void;
  setRfidOverride: (v: boolean | null) => void;
  updateHistory: (hV: number[], hC: number[], hP: number[], hT: number[]) => void;
}

export const usePLCStore = create<PLCStore>((set) => ({
  params: [],
  motorFanOn: false,
  emergencyLightOn: false,
  photoESensor: false,
  metalSensor: false,
  rfidAuthorized: false,
  rfidOverride: null,
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
    rfidAuthorized: outputs.rfidAuthorized,
    pushButton: outputs.pushButton,
    relays: outputs.relay ?? [],
    alerts: outputs.alerts ?? [],
  }),

  setRfidOverride: (v) => set({ rfidOverride: v }),

  updateHistory: (hV, hC, hP, hT) => set({
    historyVoltage: hV,
    historyCurrent: hC,
    historyPH: hP,
    historyTemp: hT,
  }),
}));
