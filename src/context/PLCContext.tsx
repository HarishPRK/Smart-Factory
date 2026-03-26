import React, { createContext, useContext, useMemo } from "react";
import { createPLCService } from "../services/plcService";
import { usePLCLive } from "../hooks/usePLCLive";
import type { UsePLCLiveResult } from "../hooks/usePLCLive";
import type { PLCService } from "../services/plcService";

const PLCServiceContext = createContext<PLCService | null>(null);
const PLCLiveContext = createContext<UsePLCLiveResult | null>(null);

export const PLCProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const service = useMemo(() => createPLCService(), []);
  const live = usePLCLive(service);

  return (
    <PLCServiceContext.Provider value={service}>
      <PLCLiveContext.Provider value={live}>
        {children}
      </PLCLiveContext.Provider>
    </PLCServiceContext.Provider>
  );
};

export function usePLCContext(): UsePLCLiveResult {
  const ctx = useContext(PLCLiveContext);
  if (!ctx) throw new Error("usePLCContext must be used within PLCProvider");
  return ctx;
}
