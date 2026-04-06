import React from "react";
import { Html } from "@react-three/drei";
import type { Machine3DState } from "./useFactoryData";
import type { PLCParameter } from "../../types";

interface MachineTooltipProps {
  machine: Machine3DState;
  params: PLCParameter[];
  onClose: () => void;
}

const statusStyles = {
  critical: { bg: "bg-red-500/15", border: "border-red-500/25", text: "text-red-300", dot: "bg-red-500" },
  warning: { bg: "bg-amber-500/15", border: "border-amber-500/25", text: "text-amber-300", dot: "bg-amber-500" },
  normal: { bg: "bg-emerald-500/15", border: "border-emerald-500/25", text: "text-emerald-300", dot: "bg-emerald-500" },
};

const MachineTooltip: React.FC<MachineTooltipProps> = ({ machine, params, onClose }) => {
  const style = statusStyles[machine.status];

  const analogParams = params.filter((p) => p.kind === "analog" && !p.placeholder);

  return (
    <Html
      position={[machine.position[0], 3, machine.position[2]]}
      center
      distanceFactor={12}
      zIndexRange={[100, 0]}
      style={{ pointerEvents: "auto" }}
    >
      <div
        className="glass rounded-xl border border-cyan-300/12 p-4 min-w-[220px] text-white shadow-[0_8px_32px_rgba(0,0,0,0.6)]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between mb-3">
          <div>
            <div className="text-[13px] font-semibold text-cyan-50">{machine.name}</div>
            <div className="text-[10px] text-sky-200/50 mt-0.5">{machine.type}</div>
          </div>
          <button
            onClick={onClose}
            className="w-6 h-6 rounded-md bg-white/[0.04] flex items-center justify-center text-sky-200/50 hover:text-white transition-colors"
          >
            <svg width="10" height="10" viewBox="0 0 10 10">
              <path d="M2 2l6 6M8 2l-6 6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
            </svg>
          </button>
        </div>

        {/* Status badge */}
        <div className={`inline-flex items-center gap-1.5 px-2 py-1 rounded-md ${style.bg} border ${style.border} mb-3`}>
          <span className={`w-1.5 h-1.5 rounded-full ${style.dot}`} />
          <span className={`text-[10px] font-semibold ${style.text} uppercase tracking-wider`}>
            {machine.status}
          </span>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 gap-2 mb-3">
          <div className="bg-white/[0.03] rounded-lg px-2.5 py-1.5">
            <div className="text-[8px] text-sky-200/40 uppercase tracking-wider">Power</div>
            <div className="text-[14px] font-semibold text-cyan-50 mt-0.5">{machine.powerKW} <span className="text-[10px] text-sky-200/40">kW</span></div>
          </div>
          <div className="bg-white/[0.03] rounded-lg px-2.5 py-1.5">
            <div className="text-[8px] text-sky-200/40 uppercase tracking-wider">Temp</div>
            <div className="text-[14px] font-semibold text-cyan-50 mt-0.5">{machine.temperature}</div>
          </div>
        </div>

        {/* Live PLC params */}
        {analogParams.length > 0 && (
          <div className="border-t border-cyan-300/[0.06] pt-2">
            <div className="text-[8px] text-sky-200/40 uppercase tracking-wider mb-1.5">Live Sensors</div>
            <div className="space-y-1">
              {analogParams.map((p) => (
                <div key={p.id} className="flex items-center justify-between text-[11px]">
                  <span className="text-sky-200/60">{p.label}</span>
                  <span className="text-cyan-50 font-medium tabular-nums">
                    {p.value?.toFixed(p.decimals ?? 1)} {p.unit}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Motor status */}
        <div className="mt-2 flex items-center gap-1.5 text-[10px]">
          <span className={`w-1.5 h-1.5 rounded-full ${machine.motorRunning ? "bg-emerald-400 shadow-[0_0_6px_rgba(52,211,153,0.6)]" : "bg-gray-500"}`} />
          <span className="text-sky-200/50">Motor {machine.motorRunning ? "Running" : "Idle"}</span>
        </div>
      </div>
    </Html>
  );
};

export default MachineTooltip;
