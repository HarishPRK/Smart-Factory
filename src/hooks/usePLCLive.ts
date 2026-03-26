import { useState, useEffect, useCallback } from "react";
import type { PLCParameter } from "../types";
import type { PLCService, PLCOutputs } from "../services/plcService";
import { DEFAULT_OUTPUTS } from "../services/plcService";
import { plcParameters } from "../data/mockData";

export interface UsePLCLiveResult {
  params: PLCParameter[];
  outputs: PLCOutputs;
  isConnected: boolean;
  error: string | null;
  sendCommand: (deviceId: string, command: Record<string, unknown>) => Promise<void>;
}

export function usePLCLive(service: PLCService): UsePLCLiveResult {
  const [params, setParams] = useState<PLCParameter[]>(plcParameters.map((p) => ({ ...p })));
  const [outputs, setOutputs] = useState<PLCOutputs>({ ...DEFAULT_OUTPUTS });
  const [isConnected, setIsConnected] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setError(null);

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
