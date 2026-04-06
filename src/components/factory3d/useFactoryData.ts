import { useMemo } from "react";
import { usePLCContext } from "../../context/PLCContext";
import { useFilters } from "../../context/FilterContext";
import { machines } from "../../data/mockData";
import { MACHINE_POSITIONS, STATUS_MAP, type StatusTier } from "./factoryLayout";
import type { ZoneId, MachineType, PLCParameter } from "../../types";

export interface Machine3DState {
  id: string;
  name: string;
  type: MachineType;
  zoneId: ZoneId;
  position: [number, number, number];
  status: StatusTier;
  powerKW: number;
  temperature: string;
  motorRunning: boolean;
  visible: boolean;
}

export interface FactorySceneData {
  machines: Machine3DState[];
  photoESensorActive: boolean;
  motorFanOn: boolean;
  emergencyLightOn: boolean;
  selectedZone: ZoneId | "all";
  params: PLCParameter[];
}

export function useFactoryData(): FactorySceneData {
  const { outputs, params } = usePLCContext();
  const { state } = useFilters();

  const machine3DStates = useMemo(() => {
    return machines.map((m) => {
      const position = MACHINE_POSITIONS[m.id] ?? [0, 0, 0] as [number, number, number];
      const status = STATUS_MAP[m.status] ?? "normal";
      const visible =
        (state.selectedZone === "all" || m.zoneId === state.selectedZone) &&
        (state.machineType === "all" || m.type === state.machineType);

      // Map motor running to zone: relay[0] → Zone 1, relay[2-3] → Zone 2, relay[4-5] → Zone 3
      let motorRunning = false;
      if (m.zoneId === 1) motorRunning = outputs.motorFanOn || (outputs.relay?.[0] ?? false);
      else if (m.zoneId === 2) motorRunning = outputs.relay?.[2] ?? false;
      else if (m.zoneId === 3) motorRunning = outputs.relay?.[4] ?? false;

      return {
        id: m.id,
        name: m.name,
        type: m.type,
        zoneId: m.zoneId,
        position,
        status,
        powerKW: Number(m.value),
        temperature: m.temp,
        motorRunning,
        visible,
      } as Machine3DState;
    });
  }, [state.selectedZone, state.machineType, outputs.motorFanOn, outputs.relay]);

  return {
    machines: machine3DStates,
    photoESensorActive: outputs.photoESensor,
    motorFanOn: outputs.motorFanOn,
    emergencyLightOn: outputs.emergencyLightOn,
    selectedZone: state.selectedZone,
    params,
  };
}
