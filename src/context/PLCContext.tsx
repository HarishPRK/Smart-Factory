/* eslint-disable react-refresh/only-export-components */
import React, {
  createContext,
  useContext,
  useMemo,
  useEffect,
  useLayoutEffect,
  useRef,
} from "react";
import { createPLCService } from "../services/plcService";
import { usePLCLive } from "../hooks/usePLCLive";
import type { UsePLCLiveResult } from "../hooks/usePLCLive";
import type { PLCService } from "../services/plcService";
import { useMqttBuffer, type MqttBuffer } from "../hooks/useMqttBuffer";
import { usePLCStore } from "../stores/plcStore";
import { usePredictions } from "../hooks/usePredictions";
import {
  setDigitalTwinPLCFeed,
  startDigitalTwinSim,
  stopDigitalTwinSim,
} from "../stores/digitalTwinSimulation";

type PLCContextMeta = Pick<
  UsePLCLiveResult,
  "isConnected" | "error" | "sendCommand"
>;

const PLCServiceContext = createContext<PLCService | null>(null);
const PLCLiveContext = createContext<PLCContextMeta | null>(null);
const MqttBufferContext = createContext<MqttBuffer | null>(null);

const EMPTY_PARAMS: UsePLCLiveResult["params"] = [];
const EMPTY_RELAYS: boolean[] = [];
const EMPTY_ALERTS: boolean[] = [];

const selectParams = (s: ReturnType<typeof usePLCStore.getState>) => s.params;
const selectEmptyParams = () => EMPTY_PARAMS;
const selectMotorFanOn = (s: ReturnType<typeof usePLCStore.getState>) =>
  s.motorFanOn;
const selectEmergencyLightOn = (s: ReturnType<typeof usePLCStore.getState>) =>
  s.emergencyLightOn;
const selectPhotoESensor = (s: ReturnType<typeof usePLCStore.getState>) =>
  s.photoESensor;
const selectMetalSensor = (s: ReturnType<typeof usePLCStore.getState>) =>
  s.metalSensor;
const selectRfidAuthorized = (s: ReturnType<typeof usePLCStore.getState>) =>
  s.rfidAuthorized;
const selectPushButton = (s: ReturnType<typeof usePLCStore.getState>) =>
  s.pushButton;
const selectRelays = (s: ReturnType<typeof usePLCStore.getState>) => s.relays;
const selectAlerts = (s: ReturnType<typeof usePLCStore.getState>) => s.alerts;
const selectFalse = () => false;
const selectEmptyRelays = () => EMPTY_RELAYS;
const selectEmptyAlerts = () => EMPTY_ALERTS;

export const PLCProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const service = useMemo(() => createPLCService(), []);
  const live = usePLCLive(service);
  const buffer = useMqttBuffer();
  const liveContextValue = useMemo<PLCContextMeta>(
    () => ({
      isConnected: live.isConnected,
      error: live.error,
      sendCommand: live.sendCommand,
    }),
    [live.isConnected, live.error, live.sendCommand],
  );

  // Sync PLC data into Zustand right before paint, but coalesce bursts of MQTT
  // messages into a single store write per animation frame. This prevents
  // rapid MQTT traffic from triggering a cascade of React re-renders on every
  // message and is the main lever for holding 120fps under live load.
  const pendingRef = useRef<{
    params: typeof live.params;
    outputs: typeof live.outputs;
  } | null>(null);
  const rafRef = useRef<number | null>(null);
  useLayoutEffect(() => {
    pendingRef.current = { params: live.params, outputs: live.outputs };
    if (rafRef.current != null) return;
    rafRef.current = requestAnimationFrame(() => {
      rafRef.current = null;
      const latest = pendingRef.current;
      if (!latest) return;
      pendingRef.current = null;
      usePLCStore.setState({
        params: latest.params,
        motorFanOn: latest.outputs.motorFanOn,
        emergencyLightOn: latest.outputs.emergencyLightOn,
        photoESensor: latest.outputs.photoESensor,
        metalSensor: latest.outputs.metalSensor,
        rfidAuthorized: latest.outputs.rfidAuthorized,
        pushButton: latest.outputs.pushButton,
        relays: latest.outputs.relay ?? [],
        alerts: latest.outputs.alerts ?? [],
      });
    });
  }, [
    live.params,
    live.outputs.motorFanOn,
    live.outputs.emergencyLightOn,
    live.outputs.photoESensor,
    live.outputs.metalSensor,
    live.outputs.pushButton,
    live.outputs.relay,
    live.outputs.alerts,
    live.outputs,
  ]);
  useEffect(
    () => () => {
      if (rafRef.current != null) cancelAnimationFrame(rafRef.current);
    },
    [],
  );

  // Apply the UI's RFID override (if any) to the outputs before handing them
  // to the digital twin. Subscribing to the override value here makes the
  // effect re-fire whenever the test button flips it.
  const rfidOverride = usePLCStore((s) => s.rfidOverride);
  useEffect(() => {
    const effectiveOutputs =
      rfidOverride === null
        ? live.outputs
        : { ...live.outputs, rfidAuthorized: rfidOverride };
    setDigitalTwinPLCFeed(live.params, effectiveOutputs);
  }, [live.params, live.outputs, rfidOverride]);

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
      <PLCLiveContext.Provider value={liveContextValue}>
        <MqttBufferContext.Provider value={buffer}>
          {children}
        </MqttBufferContext.Provider>
      </PLCLiveContext.Provider>
    </PLCServiceContext.Provider>
  );
};

export function usePLCContext(active = true): UsePLCLiveResult {
  const ctx = useContext(PLCLiveContext);
  if (!ctx) throw new Error("usePLCContext must be used within PLCProvider");

  const params = usePLCStore(active ? selectParams : selectEmptyParams);
  const motorFanOn = usePLCStore(active ? selectMotorFanOn : selectFalse);
  const emergencyLightOn = usePLCStore(
    active ? selectEmergencyLightOn : selectFalse,
  );
  const photoESensor = usePLCStore(active ? selectPhotoESensor : selectFalse);
  const metalSensor = usePLCStore(active ? selectMetalSensor : selectFalse);
  const rfidAuthorized = usePLCStore(active ? selectRfidAuthorized : selectFalse);
  const pushButton = usePLCStore(active ? selectPushButton : selectFalse);
  const relay = usePLCStore(active ? selectRelays : selectEmptyRelays);
  const alerts = usePLCStore(active ? selectAlerts : selectEmptyAlerts);

  const outputs = useMemo(
    () => ({
      motorFanOn,
      emergencyLightOn,
      photoESensor,
      metalSensor,
      rfidAuthorized,
      relay,
      pushButton,
      alerts,
    }),
    [
      motorFanOn,
      emergencyLightOn,
      photoESensor,
      metalSensor,
      rfidAuthorized,
      relay,
      pushButton,
      alerts,
    ],
  );

  return useMemo(
    () => ({
      params,
      outputs,
      isConnected: ctx.isConnected,
      error: ctx.error,
      sendCommand: ctx.sendCommand,
    }),
    [params, outputs, ctx.isConnected, ctx.error, ctx.sendCommand],
  );
}

export function useMqttBufferContext(): MqttBuffer {
  const ctx = useContext(MqttBufferContext);
  if (!ctx)
    throw new Error("useMqttBufferContext must be used within PLCProvider");
  return ctx;
}
