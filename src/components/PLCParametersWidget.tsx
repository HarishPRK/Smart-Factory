import React from "react";
import type { PLCParameter } from "../types";
import { usePLCContext } from "../context/PLCContext";
import { usePLCStore } from "../stores/plcStore";

/* ── Status badge ──────────────────────────────────────── */

const statusConfig = {
  normal: {
    label: "Normal",
    dot: "bg-emerald-400",
    glow: "shadow-[0_0_6px_rgba(52,211,153,0.5)]",
    text: "text-emerald-400",
  },
  warning: {
    label: "Warning",
    dot: "bg-amber-400",
    glow: "shadow-[0_0_6px_rgba(251,191,36,0.5)]",
    text: "text-amber-400",
  },
  critical: {
    label: "Critical",
    dot: "bg-red-500",
    glow: "shadow-[0_0_6px_rgba(239,68,68,0.5)]",
    text: "text-red-400",
  },
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
        <span className="text-[11px] text-blue-200/80 uppercase tracking-[0.14em] font-medium">
          {param.label}
        </span>
        <span
          className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-md bg-white/[0.03] border border-white/[0.05] flex items-center gap-1 ${cfg.text}`}
        >
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
          className="text-[13px] text-blue-200/70 font-medium"
          style={{ WebkitTextFillColor: "rgb(120 160 210 / 0.6)" }}
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
          <span className="text-[10px] text-blue-200/65 font-medium">
            {min}
          </span>
          <span
            className="text-[9px] font-medium"
            style={{ color: `${param.accentHex}80` }}
          >
            {param.nominal?.toFixed(param.decimals ?? 1)} nom
          </span>
          <span className="text-[10px] text-blue-200/65 font-medium">
            {max}
          </span>
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

const DigitalCard: React.FC<{ param: PLCParameter; onToggle?: () => void }> = ({
  param,
  onToggle,
}) => {
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
        <span className="text-[11px] text-blue-200/80 uppercase tracking-[0.14em] font-medium">
          {param.label}
        </span>
        <span
          className="text-[10px] font-semibold px-1.5 py-0.5 rounded-md flex items-center gap-1 transition-all duration-500"
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
            boxShadow: active
              ? `0 0 18px ${hex}40, 0 0 6px ${hex}20 inset`
              : "none",
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
          <div className="text-[9px] text-blue-200/60 mt-0.5 uppercase tracking-[0.1em]">
            Digital
          </div>
        </div>
      </div>

      {/* Bottom: signal bar */}
      <div className="relative z-10">
        <div
          className="w-full h-1.5 rounded-full overflow-hidden"
          style={{ backgroundColor: `${hex}10` }}
        >
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
        <span className="text-[11px] text-blue-200/80 uppercase tracking-[0.14em] font-medium">
          {param.label}
        </span>
        <span
          className="text-[10px] font-semibold px-1.5 py-0.5 rounded-md flex items-center gap-1"
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
        <span className="text-[9px] text-blue-200/60 uppercase tracking-[0.1em]">
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

const PLCParametersWidget: React.FC<{ className?: string }> = ({
  className = "",
}) => {
  const params = usePLCStore((s) => s.params);
  const liveRfid = usePLCStore((s) => s.rfidAuthorized);
  const rfidOverride = usePLCStore((s) => s.rfidOverride);
  const setRfidOverride = usePLCStore((s) => s.setRfidOverride);
  // What the simulation actually uses — override wins when set.
  const rfidAuthorized = rfidOverride === null ? liveRfid : rfidOverride;
  const isOverridden = rfidOverride !== null;
  const { isConnected, sendCommand } = usePLCContext(false);
  // Surface the full board-A sensor set from the latest payload so operators
  // can see every live value, not just the core six.
  const DISPLAY_ORDER = React.useMemo(
    () => [
      "voltage",           // boardA_voltage_pot_1
      "current",           // boardA_current_pot
      "relay",             // aggregate alert-relay state
      "ph",                // boardA_ph_sensor
      "forming_pressure",  // boardA_pressure_sensor
      "curing_mq",         // boardA_metaloxide_sensor (also mixing_mq)
      "mixing_turbidity",  // boardA_turbidity_sensor
      "forming_light",     // boardA_light_sensor
      "mixing_orp",        // boardA_orp_sensor
      "photoE",            // boardA_photoelectric_sensor
      "metal",             // boardA_metal_sensor
    ],
    [],
  );
  const displayParams = React.useMemo(() => {
    const byId = new Map(params.map((p) => [p.id, p]));
    return DISPLAY_ORDER.map((id) => byId.get(id)).filter(
      (p): p is NonNullable<typeof p> => !!p,
    );
  }, [params, DISPLAY_ORDER]);

  return (
    <div
      className={`card p-4 flex flex-col gap-2.5 animate-fade-in delay-2 ${className}`}
    >
      {/* Header */}
      <div className="flex justify-between items-center flex-none">
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 bg-gradient-to-br from-cyan-500/[0.12] to-blue-500/[0.06] rounded-lg flex items-center justify-center border border-cyan-400/[0.12] shadow-[0_0_10px_rgba(6,182,212,0.08)]">
            <svg
              width="12"
              height="12"
              viewBox="0 0 16 16"
              fill="none"
              className="opacity-70"
            >
              <rect
                x="4"
                y="4"
                width="8"
                height="8"
                rx="1"
                stroke="white"
                strokeWidth="1.2"
              />
              <line
                x1="2"
                y1="6"
                x2="4"
                y2="6"
                stroke="white"
                strokeWidth="1"
              />
              <line
                x1="2"
                y1="10"
                x2="4"
                y2="10"
                stroke="white"
                strokeWidth="1"
              />
              <line
                x1="12"
                y1="6"
                x2="14"
                y2="6"
                stroke="white"
                strokeWidth="1"
              />
              <line
                x1="12"
                y1="10"
                x2="14"
                y2="10"
                stroke="white"
                strokeWidth="1"
              />
              <line
                x1="6"
                y1="2"
                x2="6"
                y2="4"
                stroke="white"
                strokeWidth="1"
              />
              <line
                x1="10"
                y1="2"
                x2="10"
                y2="4"
                stroke="white"
                strokeWidth="1"
              />
              <line
                x1="6"
                y1="12"
                x2="6"
                y2="14"
                stroke="white"
                strokeWidth="1"
              />
              <line
                x1="10"
                y1="12"
                x2="10"
                y2="14"
                stroke="white"
                strokeWidth="1"
              />
            </svg>
          </div>
          <h3 className="text-[13px] font-semibold text-blue-100/90 uppercase tracking-[0.15em]">
            PLC Parameters
          </h3>
        </div>
        <div className="flex items-center gap-2">
          {/* RFID operator-badge indicator — gates the intake stage */}
          <span
            className={`text-[10px] font-semibold flex items-center gap-1.5 px-2 py-0.5 rounded-md border ${
              rfidAuthorized
                ? "bg-emerald-500/[0.08] border-emerald-500/30 text-emerald-300"
                : "bg-amber-500/[0.08] border-amber-500/30 text-amber-300"
            }`}
            title={
              rfidAuthorized
                ? "Authorized operator badge present — intake unlocked"
                : "No authorized badge — intake stage is locked"
            }
          >
            <svg width="10" height="10" viewBox="0 0 16 16" fill="none">
              <rect
                x="2"
                y="3"
                width="12"
                height="10"
                rx="1.5"
                stroke="currentColor"
                strokeWidth="1.3"
              />
              <path
                d="M5 8a3 3 0 0 1 3 0M5.5 9.5a4 4 0 0 1 5 0M6 11a2 2 0 0 1 4 0"
                stroke="currentColor"
                strokeWidth="1.1"
                strokeLinecap="round"
                fill="none"
              />
            </svg>
            RFID {rfidAuthorized ? "Auth" : "Locked"}
          </span>
          <span className="text-[11px] text-blue-100/80 font-medium flex items-center gap-1.5 bg-blue-500/[0.04] px-2 py-0.5 rounded-md border border-blue-400/[0.06]">
            <span
              className="w-1.5 h-1.5 rounded-full bg-blue-400/60 animate-pulse-glow"
              style={{ color: "#60a5fa" }}
            />
            Live
          </span>
        </div>
      </div>

      {/* RFID operator-gate strip — prominent status row */}
      <div
        className={`flex items-center justify-between px-3 py-2 rounded-md border transition-colors ${
          rfidAuthorized
            ? "bg-emerald-500/[0.06] border-emerald-500/25"
            : "bg-amber-500/[0.10] border-amber-500/35"
        }`}
      >
        <div className="flex items-center gap-2.5">
          <svg
            width="16"
            height="16"
            viewBox="0 0 16 16"
            fill="none"
            className={rfidAuthorized ? "text-emerald-300" : "text-amber-300"}
          >
            <rect
              x="1.5"
              y="3"
              width="13"
              height="10"
              rx="1.8"
              stroke="currentColor"
              strokeWidth="1.3"
            />
            <path
              d="M4.5 8a3.5 3.5 0 0 1 3.5 0M5 9.5a4.5 4.5 0 0 1 5 0M5.5 11a2.5 2.5 0 0 1 4 0"
              stroke="currentColor"
              strokeWidth="1.1"
              strokeLinecap="round"
              fill="none"
            />
          </svg>
          <div className="flex flex-col leading-tight">
            <span className="text-[10px] uppercase tracking-[0.16em] font-semibold text-slate-400">
              RFID Operator Gate
            </span>
            <span
              className={`text-[12px] font-semibold ${
                rfidAuthorized ? "text-emerald-300" : "text-amber-300"
              }`}
            >
              {rfidAuthorized
                ? "Authorized · Line Active"
                : "Locked · Awaiting Badge"}
            </span>
          </div>
        </div>
        <div className="flex items-center gap-1.5">
          {/* Test / reset control — cycles: LIVE → TEST ON → TEST OFF → LIVE */}
          <button
            onClick={() => {
              // null (LIVE) → true (force ON) → false (force OFF) → null
              if (rfidOverride === null) setRfidOverride(true);
              else if (rfidOverride === true) setRfidOverride(false);
              else setRfidOverride(null);
            }}
            title={
              isOverridden
                ? "Click to cycle test state (next: OFF or LIVE)"
                : "Override the RFID state for testing"
            }
            className={`text-[9px] font-bold px-2 py-0.5 rounded border uppercase tracking-[0.1em] transition-colors ${
              isOverridden
                ? "bg-sky-500/[0.14] border-sky-500/50 text-sky-200 hover:bg-sky-500/[0.24]"
                : "bg-slate-500/[0.08] border-slate-500/40 text-slate-300 hover:bg-slate-500/[0.18]"
            }`}
          >
            {isOverridden ? `Test: ${rfidOverride ? "On" : "Off"}` : "Reset"}
          </button>
          <span
            className={`text-[10px] font-bold px-2 py-0.5 rounded border flex items-center gap-1 ${
              rfidAuthorized
                ? "bg-emerald-500/[0.10] border-emerald-500/40 text-emerald-300"
                : "bg-amber-500/[0.10] border-amber-500/40 text-amber-300"
            }`}
          >
            <span
              className={`w-1.5 h-1.5 rounded-full ${
                rfidAuthorized ? "bg-emerald-400" : "bg-amber-400 animate-pulse"
              }`}
            />
            {rfidAuthorized ? "ON" : "OFF"}
          </span>
        </div>
      </div>

      {/* Sensor grid — 3 cols now that we surface the full board-A set */}
      <div className="grid grid-cols-3 gap-2 flex-grow overflow-y-auto pr-1">
        {displayParams.map((p) =>
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
          ),
        )}
      </div>

      {/* Footer */}
      <div className="flex items-center justify-between flex-none pt-1">
        <span className="text-[11px] text-blue-200/65 uppercase tracking-[0.12em] font-medium">
          Modbus RTU · RS485 · 8-ch relay
        </span>
        <span
          className={`text-[10px] font-semibold px-2 py-0.5 rounded-md ${
            isConnected
              ? "bg-emerald-500/[0.06] border border-emerald-500/[0.10] text-emerald-400/80"
              : "bg-amber-500/[0.06] border border-amber-500/[0.10] text-amber-400/80"
          }`}
        >
          {isConnected ? "Online" : "Connecting..."}
        </span>
      </div>
    </div>
  );
};

export default PLCParametersWidget;
