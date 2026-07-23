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
        className="card hover:border-emerald-400/25 px-4 py-3.5 flex flex-col h-[100px] min-w-[200px] max-w-[320px] flex-1 basis-[200px] relative overflow-hidden cursor-pointer transition-all duration-300 text-left rounded-2xl"
        aria-label="Open LoRaWAN sensor detail"
        title={
          hasData
            ? `${list.length} device${list.length === 1 ? "" : "s"} · avg ${moistDisplay} moisture, ${tempDisplay}\nClick for full LoRaWAN feed →`
            : "Click for full LoRaWAN feed"
        }
      >
        <div className="absolute inset-0 bg-gradient-to-br from-emerald-500/[0.08] to-transparent pointer-events-none" />

        {/* Row 1: Icon + Label + Badge */}
        <div className="flex items-center justify-between relative z-10">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 bg-emerald-500/[0.10] rounded-[10px] flex items-center justify-center border border-emerald-400/[0.12] transition-all duration-300">
              <svg width="15" height="15" viewBox="0 0 20 20" fill="none" className="text-emerald-300">
                <path d="M10 2 V8" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
                <path d="M7 4 Q10 1 13 4" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" fill="none" opacity="0.7" />
                <path d="M5.5 5.5 Q10 1 14.5 5.5" stroke="currentColor" strokeWidth="1" strokeLinecap="round" fill="none" opacity="0.4" />
                <rect x="7" y="8" width="6" height="6" rx="1" stroke="currentColor" strokeWidth="1.3" fill="none" />
                <path d="M10 14 V18" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
                <path d="M3 18 H17" stroke="currentColor" strokeWidth="0.8" opacity="0.5" />
              </svg>
            </div>
            <span className="text-[11px] text-white/60 uppercase tracking-[0.08em] font-semibold">
              LoRaWAN
            </span>
          </div>
          {hasData && (
            <span
              className={`text-[9px] font-semibold uppercase px-1.5 py-0.5 rounded-md border ${
                lowBattery
                  ? "text-red-300 bg-red-500/[0.10] border-red-400/25 animate-pulse"
                  : "text-emerald-300 bg-emerald-500/[0.06] border-emerald-400/20"
              }`}
            >
              {lowBattery ? "LOW BAT" : `${list.length}`}
            </span>
          )}
        </div>

        {/* Row 2: Value + Illustration */}
        <div className="flex items-end justify-between mt-auto relative z-10">
          <div className="flex flex-col gap-0.5">
            <span className="text-[13px] font-medium text-emerald-300/80 leading-none">
              {hasData ? `Moisture ${moistDisplay}` : "Awaiting packets"}
            </span>
            <span className="text-[10px] text-white/30">
              {hasData
                ? `${list.length} device${list.length === 1 ? "" : "s"} · ${tempDisplay}`
                : "lorawan/data"}
            </span>
          </div>
          <svg width="48" height="22" viewBox="0 0 48 22" fill="none" className="opacity-50">
            <path d="M2 14 H46" stroke="#34d399" strokeWidth="1" opacity="0.5" />
            {[8, 24, 40].map((x, i) => (
              <g key={i}>
                <path d={`M${x} 4 V14`} stroke="#10b981" strokeWidth="1.2" strokeLinecap="round" />
                <circle cx={x} cy="3.5" r="2" fill="#34d399" />
              </g>
            ))}
          </svg>
        </div>
      </button>
      <LorawanDetailDrawer open={drawerOpen} onClose={() => setDrawerOpen(false)} />
    </>
  );
};

export default LorawanWidget;
