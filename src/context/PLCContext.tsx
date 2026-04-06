import React, { createContext, useContext, useMemo, useEffect } from "react";
import { createPLCService } from "../services/plcService";
import { usePLCLive } from "../hooks/usePLCLive";
import type { UsePLCLiveResult } from "../hooks/usePLCLive";
import type { PLCService } from "../services/plcService";
import { useMqttBuffer, type MqttBuffer } from "../hooks/useMqttBuffer";
import { usePLCStore } from "../stores/plcStore";
import { usePredictions } from "../hooks/usePredictions";
import { startDigitalTwinSim, stopDigitalTwinSim } from "../stores/digitalTwinSimulation";

const PLCServiceContext = createContext<PLCService | null>(null);
const PLCLiveContext = createContext<UsePLCLiveResult | null>(null);
const MqttBufferContext = createContext<MqttBuffer | null>(null);

export const PLCProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const service = useMemo(() => createPLCService(), []);
  const live = usePLCLive(service);
  const buffer = useMqttBuffer();

  // Sync PLC data into Zustand store SYNCHRONOUSLY on every render.
  // This ensures R3F useFrame callbacks always read the latest values
  // via usePLCStore.getState(), bypassing React's async render batching.
  usePLCStore.setState({
    params: live.params,
    motorFanOn: live.outputs.motorFanOn,
    emergencyLightOn: live.outputs.emergencyLightOn,
    photoESensor: live.outputs.photoESensor,
    pushButton: live.outputs.pushButton,
    relays: live.outputs.relay ?? [],
    alerts: live.outputs.alerts ?? [],
  });

  // Run prediction engine continuously
  usePredictions();

  // Start digital twin simulation alongside PLC simulation
  useEffect(() => {
    startDigitalTwinSim();
    return () => stopDigitalTwinSim();
  }, []);

  // Push every PLC update into the ring buffer
  useEffect(() => {
    if (live.isConnected) {
      buffer.push(live.params, live.outputs);
    }
  }, [live.params, live.outputs, live.isConnected, buffer]);

  return (
    <PLCServiceContext.Provider value={service}>
      <PLCLiveContext.Provider value={live}>
        <MqttBufferContext.Provider value={buffer}>
          {children}
        </MqttBufferContext.Provider>
      </PLCLiveContext.Provider>
    </PLCServiceContext.Provider>
  );
};

export function usePLCContext(): UsePLCLiveResult {
  const ctx = useContext(PLCLiveContext);
  if (!ctx) throw new Error("usePLCContext must be used within PLCProvider");
  return ctx;
}

export function useMqttBufferContext(): MqttBuffer {
  const ctx = useContext(MqttBufferContext);
  if (!ctx) throw new Error("useMqttBufferContext must be used within PLCProvider");
  return ctx;
}
