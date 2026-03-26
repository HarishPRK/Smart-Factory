import React from "react";
import type { PLCParameter } from "../types";
import { usePLCContext } from "../context/PLCContext";

/* ── Status badge ──────────────────────────────────────── */

const statusConfig = {
  normal: { label: "Normal", dot: "bg-emerald-400", glow: "shadow-[0_0_6px_rgba(52,211,153,0.5)]", text: "text-emerald-400" },
  warning: { label: "Warning", dot: "bg-amber-400", glow: "shadow-[0_0_6px_rgba(251,191,36,0.5)]", text: "text-amber-400" },
  critical: { label: "Critical", dot: "bg-red-500", glow: "shadow-[0_0_6px_rgba(239,68,68,0.5)]", text: "text-red-400" },
};

/* ── Analog card ──────────────────────────────────────── */

const AnalogCard: React.FC<{ param: PLCParameter }> = ({ param }) => {
  const cfg = statusConfig[param.status];
  const value = param.value ?? 0;
  const min = param.min ?? 0;
  const max = param.max ?? 100;
  const pct = Math.max(0, Math.min(1, (value - min) / (max - min)));

  return (
    <div className="card-inner p-2.5 flex flex-col justify-between transition-all duration-300 relative overflow-hidden group/card">
      {/* Top row: label + status */}
      <div className="flex justify-between items-center relative z-10">
        <span className="text-[10px] text-blue-300/50 uppercase tracking-[0.14em] font-medium">
          {param.label}
        </span>
        <span className={`text-[9px] font-semibold px-1.5 py-0.5 rounded-md bg-white/[0.03] border border-white/[0.05] flex items-center gap-1 ${cfg.text}`}>
          <span className={`w-1 h-1 rounded-full ${cfg.dot} ${cfg.glow}`} />
          {cfg.label}
        </span>
      </div>

      {/* Center: large value */}
      <div className="flex items-baseline gap-1 relative z-10 my-auto py-1">
        <span className="text-[26px] font-semibold gradient-number leading-none">
          {value.toFixed(param.decimals ?? 1)}
        </span>
        <span
          className="text-[12px] text-blue-300/30 font-medium"
          style={{ WebkitTextFillColor: "rgb(120 160 210 / 0.4)" }}
        >
          {param.unit}
        </span>
      </div>

      {/* Bottom: progress bar + range */}
      <div className="relative z-10">
        <div className="w-full h-1.5 rounded-full bg-white/[0.04] overflow-hidden">
          <div
            className="h-full rounded-full transition-all duration-500"
            style={{
              width: `${pct * 100}%`,
              backgroundColor: param.accentHex,
              boxShadow: `0 0 8px ${param.accentHex}60`,
            }}
          />
        </div>
        <div className="flex justify-between mt-1">
          <span className="text-[9px] text-blue-300/25 font-medium">{min}</span>
          <span className="text-[9px] font-medium" style={{ color: `${param.accentHex}80` }}>
            {param.nominal?.toFixed(param.decimals ?? 1)} nom
          </span>
          <span className="text-[9px] text-blue-300/25 font-medium">{max}</span>
        </div>
      </div>

      {/* Ambient glow */}
      <div
        className="absolute -bottom-6 -right-6 w-16 h-16 blur-[20px] rounded-full pointer-events-none group-hover/card:scale-125 transition-all duration-700"
        style={{ backgroundColor: `${param.accentHex}08` }}
      />
    </div>
  );
};

/* ── Digital card ─────────────────────────────────────── */

const DigitalCard: React.FC<{ param: PLCParameter; onToggle?: () => void }> = ({ param, onToggle }) => {
  const active = param.active ?? false;
  const hex = param.accentHex;

  return (
    <div
      className={`card-inner p-2.5 flex flex-col justify-between transition-all duration-500 relative overflow-hidden group/card ${
        onToggle ? "cursor-pointer active:scale-[0.97]" : ""
      }`}
      onClick={onToggle}
      style={{
        borderColor: active ? `${hex}30` : undefined,
        backgroundColor: active ? `${hex}08` : undefined,
      }}
    >
      {/* Top row: label */}
      <div className="flex justify-between items-center relative z-10">
        <span className="text-[10px] text-blue-300/50 uppercase tracking-[0.14em] font-medium">
          {param.label}
        </span>
        <span
          className="text-[9px] font-semibold px-1.5 py-0.5 rounded-md flex items-center gap-1 transition-all duration-500"
          style={{
            color: active ? hex : `${hex}60`,
            backgroundColor: active ? `${hex}12` : "rgba(255,255,255,0.02)",
            borderWidth: 1,
            borderStyle: "solid",
            borderColor: active ? `${hex}25` : "rgba(255,255,255,0.04)",
          }}
        >
          <span
            className="w-1 h-1 rounded-full transition-all duration-500"
            style={{
              backgroundColor: active ? hex : `${hex}40`,
              boxShadow: active ? `0 0 6px ${hex}80` : "none",
            }}
          />
          {active ? "Active" : "Inactive"}
        </span>
      </div>

      {/* Center: large ON/OFF + indicator */}
      <div className="flex items-center justify-center gap-3 relative z-10 my-auto py-1">
        <div
          className="w-9 h-9 rounded-full border-2 flex items-center justify-center transition-all duration-500"
          style={{
            borderColor: active ? hex : `${hex}30`,
            backgroundColor: active ? `${hex}18` : "transparent",
            boxShadow: active ? `0 0 18px ${hex}40, 0 0 6px ${hex}20 inset` : "none",
          }}
        >
          <div
            className="w-4 h-4 rounded-full transition-all duration-500"
            style={{
              backgroundColor: active ? hex : `${hex}15`,
              boxShadow: active ? `0 0 10px ${hex}90` : "none",
            }}
          />
        </div>
        <div>
          <div
            className="text-[22px] font-bold leading-none transition-all duration-500"
            style={{ color: active ? hex : `${hex}40` }}
          >
            {active ? "ON" : "OFF"}
          </div>
          <div className="text-[7px] text-blue-300/25 mt-0.5 uppercase tracking-[0.1em]">
            Digital
          </div>
        </div>
      </div>

      {/* Bottom: signal bar */}
      <div className="relative z-10">
        <div className="w-full h-1.5 rounded-full overflow-hidden" style={{ backgroundColor: `${hex}10` }}>
          <div
            className="h-full rounded-full transition-all duration-500"
            style={{
              width: active ? "100%" : "0%",
              backgroundColor: hex,
              boxShadow: active ? `0 0 8px ${hex}60` : "none",
            }}
          />
        </div>
      </div>

      {/* Ambient glow */}
      {active && (
        <div
          className="absolute -bottom-8 -right-8 w-24 h-24 blur-[25px] rounded-full pointer-events-none transition-all duration-700"
          style={{ backgroundColor: `${hex}12` }}
        />
      )}
    </div>
  );
};

/* ── Relay card (green/yellow/red, no ON/OFF) ─────────── */

const RelayCard: React.FC<{ param: PLCParameter }> = ({ param }) => {
  const hex = param.accentHex;
  const label =
    hex === "#10b981" ? "Healthy" : hex === "#f59e0b" ? "Partial" : "Offline";

  return (
    <div
      className="card-inner p-2.5 flex flex-col justify-between transition-all duration-500 relative overflow-hidden group/card"
      style={{ borderColor: `${hex}30`, backgroundColor: `${hex}06` }}
    >
      {/* Top: label + status */}
      <div className="flex justify-between items-center relative z-10">
        <span className="text-[10px] text-blue-300/50 uppercase tracking-[0.14em] font-medium">
          {param.label}
        </span>
        <span
          className="text-[9px] font-semibold px-1.5 py-0.5 rounded-md flex items-center gap-1"
          style={{
            color: hex,
            backgroundColor: `${hex}15`,
            border: `1px solid ${hex}25`,
          }}
        >
          <span
            className="w-1.5 h-1.5 rounded-full"
            style={{ backgroundColor: hex, boxShadow: `0 0 6px ${hex}80` }}
          />
          {label}
        </span>
      </div>

      {/* Center: relay icon */}
      <div className="flex items-center justify-center relative z-10 my-auto py-1">
        <div
          className="w-12 h-12 rounded-full flex items-center justify-center transition-all duration-500"
          style={{
            backgroundColor: `${hex}15`,
            border: `2px solid ${hex}40`,
            boxShadow: `0 0 20px ${hex}30, 0 0 6px ${hex}15 inset`,
          }}
        >
          <div
            className="w-6 h-6 rounded-full transition-all duration-500"
            style={{
              backgroundColor: hex,
              boxShadow: `0 0 12px ${hex}90`,
            }}
          />
        </div>
      </div>

      {/* Bottom: 8-channel mini dots */}
      <div className="flex justify-center gap-1.5 relative z-10">
        <span className="text-[7px] text-blue-300/25 uppercase tracking-[0.1em]">
          8-ch RS485
        </span>
      </div>

      {/* Glow */}
      <div
        className="absolute -bottom-8 -right-8 w-24 h-24 blur-[25px] rounded-full pointer-events-none"
        style={{ backgroundColor: `${hex}10` }}
      />
    </div>
  );
};

/* ── Main widget ───────────────────────────────────────── */

const PLCParametersWidget: React.FC<{ className?: string }> = ({ className = "" }) => {
  const { params, isConnected, sendCommand } = usePLCContext();

  return (
    <div className={`card p-4 flex flex-col gap-2.5 animate-fade-in delay-2 ${className}`}>
      {/* Header */}
      <div className="flex justify-between items-center flex-none">
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 bg-gradient-to-br from-cyan-500/[0.12] to-blue-500/[0.06] rounded-lg flex items-center justify-center border border-cyan-400/[0.12] shadow-[0_0_10px_rgba(6,182,212,0.08)]">
            <svg width="12" height="12" viewBox="0 0 16 16" fill="none" className="opacity-55">
              <rect x="4" y="4" width="8" height="8" rx="1" stroke="white" strokeWidth="1.2" />
              <line x1="2" y1="6" x2="4" y2="6" stroke="white" strokeWidth="1" />
              <line x1="2" y1="10" x2="4" y2="10" stroke="white" strokeWidth="1" />
              <line x1="12" y1="6" x2="14" y2="6" stroke="white" strokeWidth="1" />
              <line x1="12" y1="10" x2="14" y2="10" stroke="white" strokeWidth="1" />
              <line x1="6" y1="2" x2="6" y2="4" stroke="white" strokeWidth="1" />
              <line x1="10" y1="2" x2="10" y2="4" stroke="white" strokeWidth="1" />
              <line x1="6" y1="12" x2="6" y2="14" stroke="white" strokeWidth="1" />
              <line x1="10" y1="12" x2="10" y2="14" stroke="white" strokeWidth="1" />
            </svg>
          </div>
          <h3 className="text-[12px] font-semibold text-blue-200/60 uppercase tracking-[0.15em]">
            PLC Parameters
          </h3>
        </div>
        <span className="text-[10px] text-blue-200/50 font-medium flex items-center gap-1.5 bg-blue-500/[0.04] px-2 py-0.5 rounded-md border border-blue-400/[0.06]">
          <span
            className="w-1.5 h-1.5 rounded-full bg-blue-400/60 animate-pulse-glow"
            style={{ color: "#60a5fa" }}
          />
          Live
        </span>
      </div>

      {/* 2×3 grid */}
      <div className="grid grid-cols-2 gap-2 flex-grow overflow-hidden">
        {params.map((p) =>
          p.kind === "analog" ? (
            <AnalogCard key={p.id} param={p} />
          ) : p.kind === "relay" ? (
            <RelayCard key={p.id} param={p} />
          ) : (
            <DigitalCard
              key={p.id}
              param={p}
              onToggle={
                !p.placeholder
                  ? () => sendCommand(p.id, { action: "toggle" })
                  : undefined
              }
            />
          )
        )}
      </div>

      {/* Footer */}
      <div className="flex items-center justify-between flex-none pt-1">
        <span className="text-[10px] text-blue-300/30 uppercase tracking-[0.12em] font-medium">
          Modbus RTU · RS485 · 8-ch relay
        </span>
        <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-md ${
          isConnected
            ? "bg-emerald-500/[0.06] border border-emerald-500/[0.10] text-emerald-400/80"
            : "bg-amber-500/[0.06] border border-amber-500/[0.10] text-amber-400/80"
        }`}>
          {isConnected ? "Online" : "Connecting..."}
        </span>
      </div>
    </div>
  );
};

export default PLCParametersWidget;
