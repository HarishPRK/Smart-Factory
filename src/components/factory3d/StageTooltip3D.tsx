"use no memo";
import React from "react";
import { Html } from "@react-three/drei";
import type { ManufacturingStage } from "../../types/digitalTwin";

interface StageTooltip3DProps {
  stage: ManufacturingStage;
  position: [number, number, number];
  onClose: () => void;
}

const statusColors: Record<string, string> = {
  running: "#10b981",
  idle: "#6b7280",
  warning: "#f59e0b",
  faulted: "#ef4444",
  blocked: "#8b5cf6",
};

const StageTooltip3D: React.FC<StageTooltip3DProps> = ({ stage, position, onClose }) => {
  return (
    <Html position={[position[0], position[1] + 2.5, position[2]]} center distanceFactor={12} zIndexRange={[100, 0]}>
      <div
        className="rounded-xl p-3 shadow-2xl text-[10px] w-[220px]"
        style={{
          backgroundColor: "rgba(10, 22, 40, 0.95)",
          backdropFilter: "blur(16px)",
          border: "1px solid rgba(0, 220, 255, 0.12)",
          color: "#e8f0fa",
        }}
      >
        {/* Header */}
        <div className="flex items-center justify-between mb-2">
          <div className="font-bold text-[11px]">{stage.label}</div>
          <button
            onClick={(e) => { e.stopPropagation(); onClose(); }}
            className="w-4 h-4 flex items-center justify-center rounded hover:bg-white/10 text-white/50 hover:text-white"
          >
            x
          </button>
        </div>

        {/* Status badge */}
        <div className="flex items-center gap-1.5 mb-2">
          <div
            className="w-2 h-2 rounded-full"
            style={{ backgroundColor: statusColors[stage.status], boxShadow: `0 0 6px ${statusColors[stage.status]}` }}
          />
          <span className="uppercase tracking-wider text-[8px] font-semibold" style={{ color: statusColors[stage.status] }}>
            {stage.status}
          </span>
          <span className="ml-auto text-white/40 text-[8px]">Q: {stage.qualityScore}%</span>
        </div>

        {/* Sensors */}
        <div className="mb-2">
          <div className="text-[8px] text-white/40 uppercase tracking-wider mb-1">Sensors</div>
          <div className="space-y-0.5">
            {stage.sensors.map((s) => (
              <div key={s.sensorId} className="flex items-center justify-between">
                <span className="text-white/70">{s.label}</span>
                <div className="flex items-center gap-1">
                  <span className="font-mono" style={{ color: s.status === "critical" ? "#ef4444" : s.status === "warning" ? "#f59e0b" : "#e8f0fa" }}>
                    {s.value.toFixed(1)}
                  </span>
                  <span className="text-white/30">{s.unit}</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Output Devices */}
        <div>
          <div className="text-[8px] text-white/40 uppercase tracking-wider mb-1">Devices</div>
          <div className="space-y-0.5">
            {stage.outputDevices.map((d) => (
              <div key={d.deviceId} className="flex items-center justify-between">
                <span className="text-white/70">{d.label}</span>
                <span
                  className="text-[8px] font-semibold px-1 rounded"
                  style={{
                    color: d.active ? "#10b981" : "#ef4444",
                    backgroundColor: d.active ? "rgba(16,185,129,0.1)" : "rgba(239,68,68,0.1)",
                  }}
                >
                  {d.active ? (d.rpm ? `${d.rpm} RPM` : "ON") : "OFF"}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </Html>
  );
};

export default StageTooltip3D;
