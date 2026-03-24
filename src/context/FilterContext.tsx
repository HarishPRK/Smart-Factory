import React, { createContext, useContext, useReducer, useMemo } from "react";
import type { FilterState, ZoneId, TimeRange, Severity, MachineType, KpiId, Machine, Alert } from "../types";
import { getFilteredMachines, getFilteredAlerts } from "../data/mockData";

type FilterAction =
  | { type: "SET_ZONE"; zone: ZoneId | "all" }
  | { type: "SET_TIME_RANGE"; timeRange: TimeRange }
  | { type: "SET_SEVERITY"; severity: Severity | "all" }
  | { type: "SET_MACHINE_TYPE"; machineType: MachineType | "all" }
  | { type: "SET_KPI"; kpi: KpiId | null }
  | { type: "RESET_FILTERS" };

type FilterContextType = {
  state: FilterState;
  dispatch: React.Dispatch<FilterAction>;
  filteredMachines: Machine[];
  filteredAlerts: Alert[];
};

const initialFilterState: FilterState = {
  selectedZone: "all",
  timeRange: "1h",
  severity: "all",
  machineType: "all",
  selectedKpi: null,
};

function filterReducer(state: FilterState, action: FilterAction): FilterState {
  switch (action.type) {
    case "SET_ZONE":
      return { ...state, selectedZone: action.zone };
    case "SET_TIME_RANGE":
      return { ...state, timeRange: action.timeRange };
    case "SET_SEVERITY":
      return { ...state, severity: action.severity };
    case "SET_MACHINE_TYPE":
      return { ...state, machineType: action.machineType };
    case "SET_KPI":
      return { ...state, selectedKpi: state.selectedKpi === action.kpi ? null : action.kpi };
    case "RESET_FILTERS":
      return initialFilterState;
    default:
      return state;
  }
}

const FilterContext = createContext<FilterContextType | null>(null);

export const FilterProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [state, dispatch] = useReducer(filterReducer, initialFilterState);

  const filteredMachines = useMemo(() => getFilteredMachines(state), [state]);
  const filteredAlerts = useMemo(() => getFilteredAlerts(state), [state]);

  const value = useMemo(
    () => ({ state, dispatch, filteredMachines, filteredAlerts }),
    [state, filteredMachines, filteredAlerts]
  );

  return (
    <FilterContext.Provider value={value}>
      {children}
    </FilterContext.Provider>
  );
};

export function useFilters(): FilterContextType {
  const context = useContext(FilterContext);
  if (!context) throw new Error("useFilters must be used within FilterProvider");
  return context;
}
