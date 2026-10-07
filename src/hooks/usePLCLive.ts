import { useState, useEffect, useCallback } from "react";
import type { PLCParameter } from "../types";
import type { PLCService, PLCOutputs } from "../services/plcService";
import { DEFAULT_OUTPUTS } from "../services/plcService";

export interface UsePLCLiveResult {
  params: PLCParameter[];
  outputs: PLCOutputs;
  isConnected: boolean;
  error: string | null;
  sendCommand: (deviceId: string, command: Record<string, unknown>) => Promise<void>;
}

export function usePLCLive(service: PLCService): UsePLCLiveResult {
  // Telemetry begins unknown. Mock mode supplies its own samples through the
  // same subscription; hardware modes must never inherit demo nominal values.
  const [params, setParams] = useState<PLCParameter[]>([]);
  const [outputs, setOutputs] = useState<PLCOutputs>({ ...DEFAULT_OUTPUTS });
  const [isConnected, setIsConnected] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const unsubscribe = service.subscribe((state) => {
      setParams(state.params);
      setOutputs(state.outputs);
      setIsConnected(true);
    });

    return () => {
      unsubscribe();
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

  return { params, outputs, isConnected, error, sendCommand };
}
