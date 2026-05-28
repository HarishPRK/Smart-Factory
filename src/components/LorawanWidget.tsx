import React, { useState } from "react";
import { useLorawanSensors } from "../hooks/useLorawanSensors";
import LorawanDetailDrawer from "./LorawanDetailDrawer";

/**
 * LoRaWAN sensor KPI card. Lives in the KPI bar at the bottom of the row.
 * Shows device count + freshest moisture / temp readings, plus a compact
 * soil-moisture gauge visualization. Click opens the full feed drawer.
 */
const LorawanWidget: React.FC = () => {
  const [drawerOpen, setDrawerOpen] = useState(false);
  const { list, avgMoisture, avgTemp, minBattery, lastReading } = useLorawanSensors();

  const hasData = list.length > 0;
  const moistDisplay = avgMoisture != null ? `${avgMoisture.toFixed(0)}%` : "—";
  const tempDisplay = avgTemp != null ? `${avgTemp.toFixed(1)}°C` : "—";
  const lowBattery = minBattery != null && minBattery < 3.3;

  return (
    <>
      <button
        type="button"
        onClick={() => setDrawerOpen(true)}
        className="card shimmer-border hover:border-emerald-400/30 p-3.5 flex flex-col justify-between h-[96px] min-w-[200px] max-w-[300px] flex-1 basis-[200px] relative overflow-hidden cursor-pointer transition-all duration-300 text-left"
        aria-label="Open LoRaWAN sensor detail"
        title={
          hasData
            ? `${list.length} device${list.length === 1 ? "" : "s"} · avg ${moistDisplay} moisture, ${tempDisplay}\nClick for full LoRaWAN feed →`
            : "Click for full LoRaWAN feed"
        }
      >
        {/* Emerald soil-themed accent gradient */}
        <div className="absolute inset-0 bg-gradient-to-br from-emerald-500/[0.10] to-green-700/[0.02] pointer-events-none" />

        {/* Decorative soil sensor glyph in bottom-right */}
        <div className="absolute bottom-2 right-3 z-0 opacity-55">
          <svg width="48" height="22" viewBox="0 0 48 22" fill="none">
            {/* Soil line */}
            <path d="M2 14 H46" stroke="#34d399" strokeWidth="1" opacity="0.5" />
            {/* Three sensor probes */}
            {[8, 24, 40].map((x, i) => (
              <g key={i}>
                <path d={`M${x} 4 V14`} stroke="#10b981" strokeWidth="1.2" strokeLinecap="round" />
                <circle cx={x} cy="3.5" r="2" fill="#34d399" />
                <path d={`M${x - 3} 14 L${x + 3} 18 L${x + 6} 14`} stroke="#34d399" strokeWidth="0.8" opacity="0.5" fill="none" />
              </g>
            ))}
          </svg>
        </div>

        {/* Header */}
        <div className="flex justify-between items-start relative z-10">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 bg-emerald-500/[0.14] rounded-lg flex items-center justify-center border border-emerald-400/[0.20] shadow-[0_0_10px_rgba(52,211,153,0.16)]">
              <svg width="14" height="14" viewBox="0 0 20 20" fill="none" className="text-emerald-200">
                {/* Antenna */}
                <path d="M10 2 V8" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
                <path d="M7 4 Q10 1 13 4" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" fill="none" opacity="0.7" />
                <path d="M5.5 5.5 Q10 1 14.5 5.5" stroke="currentColor" strokeWidth="1" strokeLinecap="round" fill="none" opacity="0.4" />
                {/* Device body */}
                <rect x="7" y="8" width="6" height="6" rx="1" stroke="currentColor" strokeWidth="1.3" fill="none" />
                {/* Probe in soil */}
                <path d="M10 14 V18" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
                <path d="M3 18 H17" stroke="currentColor" strokeWidth="0.8" opacity="0.5" />
              </svg>
            </div>
            <span className="text-[11px] text-emerald-100/90 uppercase tracking-[0.12em] font-semibold">
              LoRaWAN
            </span>
          </div>
          {hasData && (
            <span
              className={`text-[9px] font-semibold uppercase tracking-[0.08em] px-1.5 py-0.5 rounded-md border ${
                lowBattery
                  ? "text-red-200 bg-red-500/[0.10] border-red-400/30 animate-pulse"
                  : "text-emerald-200 bg-emerald-500/[0.08] border-emerald-400/25"
              }`}
            >
              {lowBattery ? "LOW BAT" : `${list.length}`}
            </span>
          )}
        </div>

        {/* Body */}
        <div className="relative z-10 flex flex-col gap-0.5 mt-auto">
          <div className="text-[13px] font-semibold text-emerald-50 leading-none tracking-tight">
            {hasData ? `Moisture ${moistDisplay}` : "Awaiting packets"}
          </div>
          <div className="flex items-baseline gap-1.5">
            <span className="text-[10px] text-emerald-200/70 font-medium">
              {hasData
                ? `${list.length} device${list.length === 1 ? "" : "s"} · ${tempDisplay}`
                : "lorawan/data"}
            </span>
            {hasData && lastReading?.deviceName && (
              <span
                className="text-[9px] text-emerald-300/50 truncate"
                style={{ maxWidth: "90px" }}
              >
                · {lastReading.deviceName}
              </span>
            )}
          </div>
        </div>

        {/* Moisture mini-gauge at top-right */}
        {hasData && avgMoisture != null && (
          <div className="absolute top-2 right-3 z-10 w-[60px] h-[3px] rounded-full bg-white/[0.05] overflow-hidden">
            <div
              className="h-full rounded-full transition-all duration-500"
              style={{
                width: `${Math.max(2, Math.min(100, avgMoisture))}%`,
                background:
                  avgMoisture < 20
                    ? "linear-gradient(90deg, #ef4444, #f97316)"
                    : avgMoisture > 60
                      ? "linear-gradient(90deg, #34d399, #3b82f6)"
                      : "linear-gradient(90deg, #34d399, #10b981)",
                boxShadow: "0 0 6px rgba(52,211,153,0.5)",
              }}
            />
          </div>
        )}
      </button>
      <LorawanDetailDrawer open={drawerOpen} onClose={() => setDrawerOpen(false)} />
    </>
  );
};

export default LorawanWidget;
