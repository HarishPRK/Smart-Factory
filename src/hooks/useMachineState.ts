import { useState, useEffect, useRef } from "react";
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
  const [state, setState] = useState<MachineState>("idle");
  const [runTimeSec, setRunTimeSec] = useState(0);
  const [cycleCount, setCycleCount] = useState(0);
  const [rejectCount, setRejectCount] = useState(0);

  const prevPhotoE = useRef(false);
  const prevMetal = useRef(false);
  const lastTickRef = useRef(Date.now());

  // Derive machine state from motor/relay signals
  useEffect(() => {
    if (!isConnected) {
      setState("idle");
      return;
    }

    const motorOn = outputs.motorFanOn;
    const relayOn = outputs.relay?.[0] ?? false;

    if (motorOn || relayOn) {
      setState("running");
    } else {
      setState("idle");
    }
  }, [outputs.motorFanOn, outputs.relay, isConnected]);

  // Track run time when running
  useEffect(() => {
    if (state !== "running") return;

    const interval = setInterval(() => {
      const now = Date.now();
      const delta = (now - lastTickRef.current) / 1000;
      lastTickRef.current = now;
      setRunTimeSec((prev) => prev + delta);
    }, 1000);

    lastTickRef.current = Date.now();
    return () => clearInterval(interval);
  }, [state]);

  // Count photo-electric rising edges (cycle completions)
  useEffect(() => {
    const currentPhotoE = outputs.photoESensor;
    if (currentPhotoE && !prevPhotoE.current) {
      setCycleCount((c) => c + 1);
    }
    prevPhotoE.current = currentPhotoE;
  }, [outputs.photoESensor]);

  // Count metal detector rising edges (rejects)
  useEffect(() => {
    // Metal detector state comes from params, not outputs
    // Check if there's a metal detection active in relay/alert signals
    const metalActive = outputs.alerts?.[0] ?? false;
    if (metalActive && !prevMetal.current) {
      setRejectCount((c) => c + 1);
    }
    prevMetal.current = metalActive;
  }, [outputs.alerts]);

  return { state, runTimeSec, cycleCount, rejectCount };
}
