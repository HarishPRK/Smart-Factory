import { useState, useEffect, useCallback } from "react";
import type { PLCParameter } from "../types";
import type { PLCService, PLCOutputs } from "../services/plcService";
import { DEFAULT_OUTPUTS } from "../services/plcService";
import { PLC_TELEMETRY_STALE_MS, type TelemetrySource } from "../services/receivedTelemetry";

export interface UsePLCLiveResult {
  params: PLCParameter[];
  outputs: PLCOutputs;
  isConnected: boolean;
  telemetrySource: TelemetrySource;
  lastReceivedAt: number | null;
  error: string | null;
  sendCommand: (deviceId: string, command: Record<string, unknown>) => Promise<void>;
}

export function usePLCLive(service: PLCService): UsePLCLiveResult {
  // Telemetry begins unknown. Mock mode supplies its own samples through the
  // same subscription; hardware modes must never inherit demo nominal values.
  const [params, setParams] = useState<PLCParameter[]>([]);
  const [outputs, setOutputs] = useState<PLCOutputs>({ ...DEFAULT_OUTPUTS });
  const [isConnected, setIsConnected] = useState(false);
  const [telemetrySource, setTelemetrySource] = useState<TelemetrySource>("none");
  const [lastReceivedAt, setLastReceivedAt] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let staleTimer: ReturnType<typeof setTimeout> | null = null;
    const unsubscribe = service.subscribe((state) => {
      const source = state.source ?? service.telemetrySource ?? "none";
      const receivedAt = source === "plc" ? state.receivedAt ?? Date.now() : null;
      setParams(state.params);
      setOutputs(state.outputs);
      setTelemetrySource(source);
      setLastReceivedAt(receivedAt);
      const remainingFreshMs = receivedAt === null ? 0 : PLC_TELEMETRY_STALE_MS - Math.max(0, Date.now() - receivedAt);
      setIsConnected(source === "plc" && remainingFreshMs > 0);
      if (staleTimer !== null) clearTimeout(staleTimer);
      if (source === "plc" && remainingFreshMs > 0) staleTimer = setTimeout(() => setIsConnected(false), remainingFreshMs);
    });

    return () => {
      unsubscribe();
      if (staleTimer !== null) clearTimeout(staleTimer);
      setIsConnected(false);
    };
  }, [service]);

  const sendCommand = useCallback(
    async (deviceId: string, command: Record<string, unknown>) => {
      try {
        setError(null);
        await service.sendCommand(deviceId, command);
      } catch (err) {
        const msg = err instanceof Error ? err.message : "Command failed";
        setError(msg);
        throw err;
      }
    },
    [service]
  );

  return { params, outputs, isConnected, telemetrySource, lastReceivedAt, error, sendCommand };
}
