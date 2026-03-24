import React from "react";
import machineGear from "../assets/icons/machine_gear.svg";
import { useFilters } from "../context/FilterContext";

interface ActiveMachineryProps {
  className?: string;
}

const ActiveMachinery: React.FC<ActiveMachineryProps> = ({
  className = "",
}) => {
  const { filteredMachines, state } = useFilters();
  const hasKpiSelected = state.selectedKpi !== null;

  return (
    <div
      className={`card p-4 flex flex-col gap-3 animate-fade-in delay-1 ${className}`}
    >
      <div className="flex justify-between items-center flex-none">
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 bg-gradient-to-br from-blue-500/[0.12] to-blue-600/[0.06] rounded-lg flex items-center justify-center border border-blue-400/[0.12] shadow-[0_0_10px_rgba(59,130,246,0.08)]">
            <img
              src={machineGear}
              alt="Machinery"
              className="w-3.5 h-3.5 opacity-55 invert"
            />
          </div>
          <h3 className="text-[10px] text-blue-200/60 uppercase tracking-[0.15em] font-semibold">
            Active Machinery
          </h3>
        </div>
        <span className="text-[10px] text-emerald-400/80 bg-gradient-to-r from-emerald-500/[0.10] to-emerald-500/[0.04] px-2.5 py-1 rounded-lg border border-emerald-500/12 font-semibold flex items-center gap-1.5 shadow-[0_0_10px_rgba(16,185,129,0.06)]">
          <span
            className="w-1.5 h-1.5 rounded-full bg-emerald-400 shadow-[0_0_6px_rgba(52,211,153,0.5)] animate-pulse-glow"
            style={{ color: "#34d399" }}
          ></span>
          {filteredMachines.length} Online
        </span>
      </div>
      <div className="flex flex-col gap-0.5 overflow-y-auto pr-1 flex-grow min-h-0">
        {filteredMachines.length === 0 ? (
          <div className="flex items-center justify-center flex-grow text-[11px] text-blue-300/40 font-medium">
            No machines match current filters
          </div>
        ) : (
          filteredMachines.map((machine, index) => (
            <div
              key={machine.id}
              className={`flex flex-col gap-2 group cursor-pointer p-2.5 rounded-xl hover:bg-cyan-400/[0.05] transition-all duration-200 animate-fade-in delay-${index + 1} ${
                hasKpiSelected ? "opacity-60 hover:opacity-100" : ""
              }`}
            >
              <div className="flex justify-between items-center">
                <div className="flex items-center gap-2.5">
                  <div
                    className={`w-7 h-7 ${machine.iconBg} rounded-lg flex items-center justify-center border ${machine.iconBorder} transition-all duration-300 group-hover:scale-105`}
                  >
                    <img
                      src={machineGear}
                      alt="Machine"
                      className="w-3 h-3 opacity-40 invert"
                    />
                  </div>
                  <div className="flex flex-col">
                    <span className="text-[12px] font-medium text-blue-100/75 group-hover:text-white transition-colors duration-200 leading-tight">
                      {machine.name}
                    </span>
                    <span className="text-[9px] text-blue-300/45 font-medium mt-0.5 flex items-center gap-1.5">
                      <span
                        className={`w-1 h-1 rounded-full ${machine.dotColor} ${machine.dotGlow} opacity-60`}
                      ></span>
                      {machine.temp}
                    </span>
                  </div>
                </div>
                <div className="text-right flex flex-col items-end gap-1">
                  <span
                    className={`text-[8px] font-semibold px-2 py-0.5 rounded-md uppercase tracking-[0.1em] ${machine.statusTone}`}
                  >
                    {machine.statusLabel}
                  </span>
                  <div className="text-[13px] font-semibold text-blue-100/90">
                    {machine.value}{" "}
                    <span className="text-[9px] font-medium text-blue-300/40">
                      {machine.unit}
                    </span>
                  </div>
                </div>
              </div>
              {/* Progress bar */}
              <div
                className="flex items-center gap-2 ml-9"
                style={{ width: "calc(100% - 36px)" }}
              >
                <span className="text-[8px] text-blue-300/35 uppercase tracking-[0.12em] font-semibold whitespace-nowrap">
                  Load
                </span>
                <div className="w-full h-[3px] bg-blue-400/[0.06] rounded-full overflow-hidden">
                  <div
                    className={`h-full ${machine.barColor} rounded-full transition-all duration-700 ease-out opacity-40 group-hover:opacity-80`}
                    style={{ width: machine.barWidth }}
                  />
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};

export default ActiveMachinery;
