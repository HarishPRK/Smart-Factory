import React from "react";
import { useFilters } from "../context/FilterContext";
import { machineTypes } from "../data/mockData";
import type { TimeRange, Severity, MachineType } from "../types";

const timeRanges: TimeRange[] = ["1h", "6h", "24h", "7d"];

const severities: { value: Severity | "all"; label: string }[] = [
  { value: "all", label: "All" },
  { value: "critical", label: "Critical" },
  { value: "warning", label: "Warning" },
  { value: "info", label: "Normal" },
];

const activePill =
  "bg-gradient-to-r from-blue-500 to-blue-600 text-white font-semibold shadow-[0_2px_12px_rgba(59,130,246,0.3),0_0_0_0.5px_rgba(255,255,255,0.1)_inset]";
const inactivePill =
  "text-blue-200/65 font-medium hover:text-white hover:bg-blue-500/[0.08]";

const FilterBar: React.FC = () => {
  const { state, dispatch } = useFilters();

  const hasActiveFilters =
    state.timeRange !== "1h" ||
    state.severity !== "all" ||
    state.machineType !== "all";

  return (
    <div className="flex items-center justify-center gap-3 animate-fade-in delay-2">
      {/* Time Range */}
      <div className="flex glass rounded-full p-0.5 shadow-[0_2px_12px_rgba(0,10,40,0.2)]">
        {timeRanges.map((t) => (
          <button
            key={t}
            onClick={() => dispatch({ type: "SET_TIME_RANGE", timeRange: t })}
            className={`px-3 py-1 rounded-full text-[10px] transition-all duration-300 relative overflow-hidden ${
              state.timeRange === t ? activePill : inactivePill
            }`}
          >
            {state.timeRange === t && (
              <div className="absolute inset-0 bg-gradient-to-t from-transparent to-white/[0.08] pointer-events-none rounded-full"></div>
            )}
            <span className="relative z-10">{t}</span>
          </button>
        ))}
      </div>

      {/* Severity */}
      <div className="flex glass rounded-full p-0.5 shadow-[0_2px_12px_rgba(0,10,40,0.2)]">
        {severities.map((s) => (
          <button
            key={s.value}
            onClick={() =>
              dispatch({ type: "SET_SEVERITY", severity: s.value })
            }
            className={`px-3 py-1 rounded-full text-[10px] transition-all duration-300 relative overflow-hidden ${
              state.severity === s.value ? activePill : inactivePill
            }`}
          >
            {state.severity === s.value && (
              <div className="absolute inset-0 bg-gradient-to-t from-transparent to-white/[0.08] pointer-events-none rounded-full"></div>
            )}
            <span className="relative z-10">{s.label}</span>
          </button>
        ))}
      </div>

      {/* Machine Type Dropdown */}
      <div className="relative">
        <select
          value={state.machineType}
          onChange={(e) =>
            dispatch({
              type: "SET_MACHINE_TYPE",
              machineType: e.target.value as MachineType | "all",
            })
          }
          className="glass rounded-full px-3 py-1 text-[10px] font-medium text-blue-200/75 bg-transparent border-none outline-none cursor-pointer appearance-none pr-6 shadow-[0_2px_12px_rgba(0,10,40,0.2)] hover:text-white transition-colors duration-300"
        >
          <option value="all" className="bg-[#0a1832] text-blue-200">
            All Machines
          </option>
          {machineTypes.map((mt) => (
            <option key={mt} value={mt} className="bg-[#0a1832] text-blue-200">
              {mt}
            </option>
          ))}
        </select>
        <svg
          width="8"
          height="8"
          viewBox="0 0 8 8"
          fill="currentColor"
          className="absolute right-2.5 top-1/2 -translate-y-1/2 text-blue-300/60 pointer-events-none rotate-180"
        >
          <path d="M4 1L7 5H1L4 1Z" />
        </svg>
      </div>

      {/* Reset */}
      {hasActiveFilters && (
        <button
          onClick={() => dispatch({ type: "RESET_FILTERS" })}
          className="glass rounded-full px-3 py-1 text-[10px] font-medium text-blue-200/65 hover:text-white hover:bg-red-500/[0.08] transition-all duration-300 shadow-[0_2px_12px_rgba(0,10,40,0.2)] flex items-center gap-1"
        >
          <svg width="8" height="8" viewBox="0 0 8 8" fill="none" className="opacity-60">
            <path d="M1.5 1.5L6.5 6.5M6.5 1.5L1.5 6.5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
          </svg>
          Reset
        </button>
      )}
    </div>
  );
};

export default FilterBar;
