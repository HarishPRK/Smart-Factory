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
import { isReceivedParameter, type TelemetrySource } from "../services/receivedTelemetry";

export interface PLCStore {
  params: PLCParameter[];
  telemetrySource: TelemetrySource;
  lastReceivedAt: number | null;
  /** Histories contain only finite received controller values, never model ticks. */
  receivedHistories: Record<string, number[]>;
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
  }, metadata?: { source: TelemetrySource; receivedAt: number | null }) => void;
  setRfidOverride: (v: boolean | null) => void;
  updateHistory: (hV: number[], hC: number[], hP: number[], hT: number[]) => void;
}

export const usePLCStore = create<PLCStore>((set) => ({
  params: [],
  telemetrySource: "none",
  lastReceivedAt: null,
  receivedHistories: {},
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

  updateFromPLC: (params, outputs, metadata = { source: "plc", receivedAt: Date.now() }) => set((previous) => {
    const sameSource = previous.telemetrySource === metadata.source;
    const receivedHistories = sameSource ? { ...previous.receivedHistories } : {};
    const genuineReceipt = metadata.source === "plc" && metadata.receivedAt !== null &&
      (!sameSource || metadata.receivedAt !== previous.lastReceivedAt || params !== previous.params);
    if (genuineReceipt) {
      for (const param of params) {
        if (!isReceivedParameter(param)) continue;
        const previousParam = sameSource ? previous.params.find((candidate) => candidate.id === param.id) : undefined;
        const channelAt = param.receivedAt ?? metadata.receivedAt;
        const previousAt = previousParam?.receivedAt ?? previous.lastReceivedAt;
        if (previousParam && isReceivedParameter(previousParam) && channelAt === previousAt &&
          previousParam.value === param.value && previousParam.active === param.active) continue;
        const value = param.kind === "analog" ? param.value! : param.active ? 1 : 0;
        receivedHistories[param.id] = [...(receivedHistories[param.id] ?? []), value].slice(-100);
      }
    }
    return {
      params, telemetrySource: metadata.source,
      lastReceivedAt: metadata.source === "plc" ? metadata.receivedAt : null,
      receivedHistories,
      historyVoltage: receivedHistories.voltage ?? [],
      historyCurrent: receivedHistories.current ?? [],
      historyPH: receivedHistories.ph ?? [],
      historyTemp: receivedHistories.temperature ?? [],
      motorFanOn: outputs.motorFanOn,
      emergencyLightOn: outputs.emergencyLightOn,
      photoESensor: outputs.photoESensor,
      metalSensor: outputs.metalSensor,
      rfidAuthorized: outputs.rfidAuthorized,
      pushButton: outputs.pushButton,
      relays: outputs.relay ?? [],
      alerts: outputs.alerts ?? [],
    };
  }),

  setRfidOverride: (v) => set({ rfidOverride: v }),

  updateHistory: (hV, hC, hP, hT) => set({
    historyVoltage: hV,
    historyCurrent: hC,
    historyPH: hP,
    historyTemp: hT,
  }),
}));
