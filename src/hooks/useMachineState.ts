import { useState, useEffect, useMemo, useRef } from "react";
import { usePLCContext } from "../context/PLCContext";
import type { MachineState } from "../types";

export interface UseMachineStateResult {
  state: MachineState;
  runTimeSec: number;
  cycleCount: number;
  rejectCount: number;
}

export function useMachineState(): UseMachineStateResult {
  const { outputs, isConnected } = usePLCContext();
  const [runTimeSec, setRunTimeSec] = useState(0);
  const [cycleCount, setCycleCount] = useState(0);
  const [rejectCount, setRejectCount] = useState(0);

  const outputsRef = useRef(outputs);
  const isConnectedRef = useRef(isConnected);
  const prevPhotoE = useRef(false);
  const prevMetal = useRef(false);
  const lastTickRef = useRef(0);

  useEffect(() => {
    outputsRef.current = outputs;
  }, [outputs]);

  useEffect(() => {
    isConnectedRef.current = isConnected;
  }, [isConnected]);

  const state = useMemo<MachineState>(() => {
    if (!isConnected) return "idle";
    const relayOn = outputs.relay?.[0] ?? false;
    return outputs.motorFanOn || relayOn ? "running" : "idle";
  }, [isConnected, outputs.motorFanOn, outputs.relay]);

  useEffect(() => {
    lastTickRef.current = Date.now();
    const interval = setInterval(() => {
      const now = Date.now();
      const currentOutputs = outputsRef.current;
      const relayOn = currentOutputs.relay?.[0] ?? false;
      const running =
        isConnectedRef.current && (currentOutputs.motorFanOn || relayOn);

      if (running) {
        const delta = (now - lastTickRef.current) / 1000;
        setRunTimeSec((prev) => prev + delta);
      }

      const currentPhotoE = currentOutputs.photoESensor;
      if (currentPhotoE && !prevPhotoE.current) {
        setCycleCount((count) => count + 1);
      }

      const currentMetal = currentOutputs.metalSensor;
      if (currentMetal && !prevMetal.current) {
        setRejectCount((count) => count + 1);
      }

      prevPhotoE.current = currentPhotoE;
      prevMetal.current = currentMetal;
      lastTickRef.current = now;
    }, 250);

    return () => clearInterval(interval);
  }, []);

  return { state, runTimeSec, cycleCount, rejectCount };
}
