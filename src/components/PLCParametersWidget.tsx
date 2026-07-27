import React, { useEffect, useRef, useState } from "react";
import type { PLCParameter } from "../types";
import { usePLCContext } from "../context/PLCContext";
import { usePLCStore } from "../stores/plcStore";
import { useTweenedNumber } from "../hooks/useTweenedNumber";
import ThreePhaseMotorWidget from "./ThreePhaseMotorWidget";

/**
 * Direction of a meaningful value change — drives the flash colour.
 *   "up"   → value rose      (green flash)
 *   "down" → value fell       (amber flash)
 *   null   → no active flash
 */
type FlashDir = "up" | "down" | null;

/**
 * Returns the direction of the most recent meaningful change so the card can
 * flash a colour. A change counts only if it exceeds `threshold` fraction of
 * the parameter's range — this filters out sensor micro-jitter (which would
 * otherwise strobe the whole panel) so only deliberate changes — an operator
 * turning a pot, a relay toggling — light up the box. Reusable for analog
 * (numeric) and digital (boolean) parameters.
 */
function useChangeFlash(value: number, range: number, threshold = 0.03): FlashDir {
  const [flash, setFlash] = useState<FlashDir>(null);
  const prevRef = useRef(value);
  useEffect(() => {
    const delta = value - prevRef.current;
    const significant = range > 0 ? Math.abs(delta) / range > threshold : Math.abs(delta) > 0.5;
    if (significant) {
      const dir: FlashDir = delta > 0 ? "up" : "down";
      prevRef.current = value;
      setFlash(null);
      // rAF so removing → re-adding the class restarts the CSS animation even
      // on rapid successive changes.
      const raf = requestAnimationFrame(() => setFlash(dir));
      const t = setTimeout(() => setFlash(null), 850);
      return () => {
        cancelAnimationFrame(raf);
        clearTimeout(t);
      };
    }
    prevRef.current = value;
  }, [value, range, threshold]);
  return flash;
}

/** Maps a flash direction to the paired CSS classes (base + colour modifier). */
function flashClass(dir: FlashDir): string {
  if (dir === "up") return "plc-value-flash plc-value-flash-up";
  if (dir === "down") return "plc-value-flash plc-value-flash-down";
  return "";
}

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

/* ── Label rendering ──────────────────────────────────── */

// Cramped sensor cells use abbreviated display labels so the readable
// metadata role can survive fit-to-width scaling without wrapping. The full
// name remains available on hover.
const SHORT_LABELS: Record<string, string> = {
  forming_pressure: "Pressure",
  forming_light: "Light",
  mixing_turbidity: "Turbidity",
  mixing_orp: "ORP",
  curing_mq: "MQ Gas",
  photoE: "Photo-E",
  metal: "Metal Det.",
};

const SensorLabel: React.FC<{ param: PLCParameter; className?: string }> = ({
  param,
  className = "",
}) => {
  const display = SHORT_LABELS[param.id] ?? param.label;
  return (
    <span
      className={`text-blue-200/80 uppercase tracking-[0.06em] font-medium whitespace-nowrap ${className}`}
      title={param.label}
      style={{ fontSize: "calc(11px + var(--fit-text-boost, 0px))" }}
    >
      {display}
    </span>
  );
};

const StatusBadge: React.FC<{
  cfg: { label: string; dot: string; glow: string; text: string };
}> = ({ cfg }) => (
  <span
    className={`font-semibold px-1.5 py-0.5 rounded-md bg-white/[0.03] border border-white/[0.05] flex items-center gap-1 whitespace-nowrap ${cfg.text}`}
    style={{ fontSize: "calc(11px + var(--fit-text-boost, 0px))" }}
  >
    <span className={`w-1 h-1 rounded-full ${cfg.dot} ${cfg.glow}`} />
    {cfg.label}
  </span>
);

/* ── Analog card ──────────────────────────────────────── */

const AnalogCard: React.FC<{ param: PLCParameter }> = ({ param }) => {
  const cfg = statusConfig[param.status];
  const rawValue = param.value ?? 0;
  const min = param.min ?? 0;
  const max = param.max ?? 100;
  const value = useTweenedNumber(rawValue, 280);
  const pct = Math.max(0, Math.min(1, (value - min) / (max - min)));
  const flash = useChangeFlash(rawValue, max - min);
  const glowClass =
    param.status === "warning"
      ? "status-warn-glow"
      : param.status === "critical"
        ? "status-alarm-glow"
        : "";

  return (
    <div
      className={`card-inner p-2.5 flex flex-col justify-between transition-all duration-300 relative overflow-hidden group/card rounded-xl ${glowClass} ${flashClass(flash)}`}
    >
      {/* Top row: label + status */}
      <div className="flex justify-between items-center gap-1 relative z-10">
        <SensorLabel param={param} />
        <StatusBadge cfg={cfg} />
      </div>

      {/* Center: large value */}
      <div className="flex items-baseline gap-1 relative z-10 my-auto py-1">
        <span className="text-[24px] font-semibold gradient-number leading-none">
          {value.toFixed(param.decimals ?? 1)}
        </span>
        <span className="text-[11px] text-white/40 font-medium">
          {param.unit}
        </span>
      </div>

      {/* Bottom: progress bar + range */}
      <div className="relative z-10">
        <div className="w-full h-[5px] rounded-full bg-white/[0.04] overflow-hidden">
          <div
            className="h-full rounded-full"
            style={{
              width: `${pct * 100}%`,
              backgroundColor: param.accentHex,
              boxShadow: `0 0 6px ${param.accentHex}50`,
            }}
          />
        </div>
        <div className="flex justify-between items-center mt-1 gap-1">
          <span className="text-white/55 font-medium" style={{ fontSize: "calc(11px + var(--fit-text-boost, 0px))" }}>
            {min}
          </span>
          <span
            className="font-medium whitespace-nowrap"
            style={{ fontSize: "calc(10.5px + var(--fit-text-boost, 0px))", color: `${param.accentHex}90` }}
          >
            {param.nominal?.toFixed(param.decimals ?? 1)} nom
          </span>
          <span className="text-white/55 font-medium" style={{ fontSize: "calc(11px + var(--fit-text-boost, 0px))" }}>
            {max}
          </span>
        </div>
      </div>

      {/* Ambient glow */}
      <div
        className="absolute -bottom-6 -right-6 w-14 h-14 blur-[18px] rounded-full pointer-events-none group-hover/card:scale-125 transition-all duration-700"
        style={{ backgroundColor: `${param.accentHex}06` }}
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
  // Range of 1 so any boolean flip (0↔1) exceeds the 3% threshold and flashes.
  const flash = useChangeFlash(active ? 1 : 0, 1);

  return (
    <div
      className={`card-inner p-2 flex flex-col justify-between transition-all duration-500 relative overflow-hidden group/card ${
        onToggle ? "cursor-pointer active:scale-[0.97]" : ""
      } ${flashClass(flash)}`}
      onClick={onToggle}
      style={{
        borderColor: active ? `${hex}30` : undefined,
        backgroundColor: active ? `${hex}08` : undefined,
      }}
    >
      {/* Top row: label */}
      <div className="flex justify-between items-center gap-1 relative z-10">
        <SensorLabel param={param} />
        <span
          className="font-semibold px-1.5 py-0.5 rounded-md flex items-center gap-1 transition-all duration-500 whitespace-nowrap"
          style={{
            fontSize: "9.5px",
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
  const glowClass =
    hex === "#f59e0b"
      ? "status-warn-glow"
      : hex === "#ef4444" || label === "Offline"
        ? "status-alarm-glow"
        : "";
  // Health rank (healthy=2 / partial=1 / offline=0) so a state transition
  // flashes green when it improves and amber when it degrades.
  const healthRank = hex === "#10b981" ? 2 : hex === "#f59e0b" ? 1 : 0;
  const flash = useChangeFlash(healthRank, 1);

  return (
    <div
      className={`card-inner p-2 flex flex-col justify-between transition-all duration-500 relative overflow-hidden group/card ${glowClass} ${flashClass(flash)}`}
      style={{ borderColor: `${hex}30`, backgroundColor: `${hex}06` }}
    >
      {/* Top: label + status */}
      <div className="flex justify-between items-center gap-1 relative z-10">
        <SensorLabel param={param} />
        <span
          className="font-semibold px-1.5 py-0.5 rounded-md flex items-center gap-1 whitespace-nowrap"
          style={{
            fontSize: "9.5px",
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
      className={`card p-3.5 flex flex-col gap-2.5 animate-fade-in delay-2 rounded-2xl ${className}`}
    >
      {/* Header */}
      <div className="flex justify-between items-center flex-none">
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 bg-gradient-to-br from-indigo-500/[0.12] to-blue-500/[0.06] rounded-lg flex items-center justify-center border border-indigo-400/[0.12]">
            <svg width="11" height="11" viewBox="0 0 16 16" fill="none" className="opacity-65">
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
          <h3 className="text-[12px] font-semibold text-white/80 uppercase tracking-[0.16em]">
            PLC Parameters
          </h3>
        </div>
        <div className="flex items-center gap-1.5">
          <span
            className={`text-[9px] font-semibold flex items-center gap-1 px-2 py-0.5 rounded-lg border ${
              rfidAuthorized
                ? "bg-emerald-500/[0.06] border-emerald-500/25 text-emerald-300"
                : "bg-amber-500/[0.06] border-amber-500/25 text-amber-300"
            }`}
            title={
              rfidAuthorized
                ? "Authorized operator badge present — intake unlocked"
                : "No authorized badge — intake stage is locked"
            }
          >
            <svg width="9" height="9" viewBox="0 0 16 16" fill="none">
              <rect x="2" y="3" width="12" height="10" rx="1.5" stroke="currentColor" strokeWidth="1.3" />
              <path d="M5 8a3 3 0 0 1 3 0M5.5 9.5a4 4 0 0 1 5 0M6 11a2 2 0 0 1 4 0" stroke="currentColor" strokeWidth="1.1" strokeLinecap="round" fill="none" />
            </svg>
            RFID {rfidAuthorized ? "Auth" : "Locked"}
          </span>
          <span className="text-[9px] text-white/60 font-medium flex items-center gap-1 bg-white/[0.03] px-2 py-0.5 rounded-lg border border-white/[0.05]">
            <span className="w-1.5 h-1.5 rounded-full bg-indigo-400/60 animate-pulse-glow" style={{ color: "#7ab4ee" }} />
            Live
          </span>
        </div>
      </div>

      {/* RFID operator-gate strip */}
      <div
        className={`flex items-center justify-between px-3 py-2 rounded-xl border transition-colors ${
          rfidAuthorized
            ? "bg-emerald-500/[0.04] border-emerald-500/20"
            : "bg-amber-500/[0.06] border-amber-500/25"
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

      {/* Sensor grid — 3 cols. Adding more columns on wide screens just
          makes each cell narrower, which forces multi-word labels like
          "Forming Pressure" / "Curing MQ Gas" to wrap. Keep 3 always and
          let the cards expand horizontally with the right column instead. */}
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
        {/* 3-Phase motor — a clickable tile that opens the per-phase detail
            drawer (same widget that used to sit as a strip below). */}
        <ThreePhaseMotorWidget />
      </div>

      {/* Footer */}
      <div className="flex items-center justify-between flex-none pt-1">
        <span className="text-[9px] text-white/40 uppercase tracking-[0.14em] font-medium">
          Modbus RTU · RS485 · 8-ch relay
        </span>
        <span
          className={`text-[9px] font-semibold px-2 py-0.5 rounded-lg ${
            isConnected
              ? "bg-emerald-500/[0.05] border border-emerald-500/[0.12] text-emerald-400/75"
              : "bg-amber-500/[0.05] border border-amber-500/[0.12] text-amber-400/75"
          }`}
        >
          {isConnected ? "Online" : "Connecting..."}
        </span>
      </div>
    </div>
  );
};

export default PLCParametersWidget;
