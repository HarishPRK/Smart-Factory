import React, { useRef } from "react";
import { useFilters } from "../context/FilterContext";
import { kpis, getKpiForZone } from "../data/mockData";

const MiniSparkline: React.FC<{ data: number[]; color: string }> = ({
  data,
  color,
}) => {
  const max = Math.max(...data);
  const min = Math.min(...data);
  const range = max - min || 1;
  const width = 60;
  const height = 24;

  const points = data.map((v, i) => ({
    x: (i / (data.length - 1)) * width,
    y: height - ((v - min) / range) * height,
  }));

  let pathD = `M${points[0].x},${points[0].y}`;
  for (let i = 1; i < points.length; i++) {
    const prev = points[i - 1];
    const curr = points[i];
    const cpx1 = prev.x + (curr.x - prev.x) * 0.4;
    const cpx2 = prev.x + (curr.x - prev.x) * 0.6;
    pathD += ` C${cpx1},${prev.y} ${cpx2},${curr.y} ${curr.x},${curr.y}`;
  }

  const areaD = `${pathD} L${width},${height} L0,${height} Z`;

  return (
    <svg
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      className="opacity-50 group-hover:opacity-75 transition-opacity duration-500"
    >
      <defs>
        <linearGradient
          id={`spark-fill-${color.replace("#", "")}`}
          x1="0"
          y1="0"
          x2="0"
          y2="1"
        >
          <stop offset="0%" stopColor={color} stopOpacity="0.35" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={areaD} fill={`url(#spark-fill-${color.replace("#", "")})`} />
      <path
        d={pathD}
        fill="none"
        stroke={color}
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle
        cx={points[points.length - 1].x}
        cy={points[points.length - 1].y}
        r="2"
        fill={color}
        opacity="0.8"
        className="group-hover:opacity-100 transition-opacity duration-300"
      >
        <animate
          attributeName="r"
          values="1.5;2.5;1.5"
          dur="2s"
          repeatCount="indefinite"
        />
      </circle>
    </svg>
  );
};

interface KPIBarProps {
  onOeeClick?: () => void;
  onAnalyticsClick?: () => void;
  onPredictClick?: () => void;
  onDigitalTwinClick?: () => void;
  predAlertCount?: number;
}

const KPIBar: React.FC<KPIBarProps> = ({ onOeeClick, onAnalyticsClick, onPredictClick, onDigitalTwinClick, predAlertCount = 0 }) => {
  const { state, dispatch } = useFilters();
  const scrollRef = useRef<HTMLDivElement>(null);

  return (
    <div className="flex items-center justify-center w-full">
      {/* KPI cards + action buttons (centered) */}
      <div
        ref={scrollRef}
        className="flex gap-2.5 overflow-x-auto scroll-smooth justify-center flex-wrap"
        style={{ scrollbarWidth: "none", msOverflowStyle: "none" }}
      >
        {kpis.map((kpi, i) => {
          const isSelected = state.selectedKpi === kpi.id;
          const zoneData = getKpiForZone(kpi, state.selectedZone);

          return (
            <div
              key={kpi.id}
              onClick={() => {
                if (kpi.id === "oee" && onOeeClick) {
                  onOeeClick();
                } else {
                  dispatch({ type: "SET_KPI", kpi: kpi.id });
                }
              }}
              className={`card shimmer-border ${kpi.hoverBorder} p-3.5 flex flex-col justify-between h-[96px] min-w-[145px] flex-shrink-0 relative overflow-hidden animate-fade-in delay-${i + 1} group cursor-pointer transition-all duration-300 ${
                isSelected
                  ? "ring-1 ring-white/20 shadow-[0_0_20px_rgba(59,130,246,0.15)] scale-[1.02]"
                  : ""
              }`}
            >
              <div
                className={`absolute inset-0 bg-gradient-to-br ${kpi.accent} ${
                  isSelected ? "opacity-100" : "opacity-0 group-hover:opacity-100"
                } transition-opacity duration-500 pointer-events-none`}
              ></div>

              <div className="absolute bottom-2 right-3 z-0">
                <MiniSparkline data={zoneData.sparkData} color={kpi.sparkColor} />
              </div>

              <div className="flex justify-between items-start relative z-10">
                <div className="flex items-center gap-2">
                  <div
                    className={`w-7 h-7 ${kpi.iconBg} rounded-lg flex items-center justify-center border ${kpi.iconBorder} ${kpi.iconGlow} transition-all duration-300 group-hover:scale-105`}
                  >
                    <img
                      src={kpi.icon}
                      alt={kpi.label}
                      className="w-3.5 h-3.5 opacity-75 invert"
                    />
                  </div>
                  <span className="text-[11px] text-blue-100/85 uppercase tracking-[0.12em] font-semibold">
                    {kpi.label}
                  </span>
                </div>
                <div
                  className={`flex items-center gap-0.5 text-[10px] font-semibold ${kpi.trendColor} bg-white/[0.03] px-2 py-0.5 rounded-md border border-white/[0.04]`}
                >
                  <svg
                    width="8"
                    height="8"
                    viewBox="0 0 8 8"
                    fill="currentColor"
                    className={zoneData.trendUp ? "" : "rotate-180"}
                  >
                    <path d="M4 1L7 5H1L4 1Z" />
                  </svg>
                  {zoneData.trend}
                </div>
              </div>
              <div className="flex items-baseline gap-1.5 mt-auto relative z-10">
                <span className="text-[26px] font-semibold gradient-number leading-none tracking-tight">
                  {zoneData.value}
                </span>
                <span className="text-[11px] text-blue-200/70 font-medium">
                  {kpi.unit}
                </span>
              </div>

              {isSelected && (
                <div className="absolute top-1.5 right-1.5 w-1.5 h-1.5 rounded-full bg-blue-400 shadow-[0_0_6px_rgba(59,130,246,0.6)] z-20"></div>
              )}
            </div>
          );
        })}

        {/* Analytics button — styled as KPI card */}
        {onAnalyticsClick && (
          <button
            onClick={onAnalyticsClick}
            className="card shimmer-border hover:border-cyan-400/30 p-3.5 flex flex-col justify-between h-[96px] min-w-[145px] flex-shrink-0 relative overflow-hidden group/analytics cursor-pointer transition-all duration-300 text-left"
          >
            <div className="absolute inset-0 bg-gradient-to-br from-cyan-500/[0.12] to-blue-500/[0.04] opacity-0 group-hover/analytics:opacity-100 transition-opacity duration-500 pointer-events-none"></div>
            <div className="absolute bottom-2 right-3 z-0 opacity-50 group-hover/analytics:opacity-75 transition-opacity duration-500">
              <svg width="60" height="24" viewBox="0 0 60 24" fill="none">
                <rect x="2"  y="14" width="6" height="8"  rx="1" fill="#22d3ee" opacity="0.9" />
                <rect x="12" y="9"  width="6" height="13" rx="1" fill="#38bdf8" opacity="0.85" />
                <rect x="22" y="5"  width="6" height="17" rx="1" fill="#60a5fa" opacity="0.8" />
                <rect x="32" y="11" width="6" height="11" rx="1" fill="#38bdf8" opacity="0.75" />
                <rect x="42" y="2"  width="6" height="20" rx="1" fill="#22d3ee" />
              </svg>
            </div>
            <div className="flex justify-between items-start relative z-10">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 bg-cyan-500/[0.12] rounded-lg flex items-center justify-center border border-cyan-400/[0.15] shadow-[0_0_10px_rgba(34,211,238,0.10)] transition-all duration-300 group-hover/analytics:scale-105">
                  <svg width="14" height="14" viewBox="0 0 20 20" fill="none" className="text-cyan-200">
                    <rect x="2" y="10" width="3" height="8"  rx="1" fill="currentColor" />
                    <rect x="7" y="6"  width="3" height="12" rx="1" fill="currentColor" />
                    <rect x="12" y="3" width="3" height="15" rx="1" fill="currentColor" />
                    <path d="M3 9L8 5L13 2" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" opacity="0.6" />
                  </svg>
                </div>
                <span className="text-[11px] text-cyan-100/90 uppercase tracking-[0.12em] font-semibold">Analytics</span>
              </div>
            </div>
            <div className="flex items-baseline gap-1.5 mt-auto relative z-10">
              <span className="text-[14px] font-semibold text-cyan-200/90 leading-none tracking-tight">Open</span>
              <span className="text-[10px] text-cyan-300/60 font-medium">trends</span>
            </div>
          </button>
        )}

        {/* Predict button — styled as KPI card */}
        {onPredictClick && (
          <button
            onClick={onPredictClick}
            className="card shimmer-border hover:border-purple-400/30 p-3.5 flex flex-col justify-between h-[96px] min-w-[145px] flex-shrink-0 relative overflow-hidden group/predict cursor-pointer transition-all duration-300 text-left"
          >
            <div className="absolute inset-0 bg-gradient-to-br from-purple-500/[0.14] to-fuchsia-500/[0.04] opacity-0 group-hover/predict:opacity-100 transition-opacity duration-500 pointer-events-none"></div>
            <div className="absolute bottom-2 right-3 z-0 opacity-55 group-hover/predict:opacity-80 transition-opacity duration-500">
              <svg width="60" height="24" viewBox="0 0 60 24" fill="none">
                <path d="M2 18L14 12L28 15L44 4L58 8" stroke="#c084fc" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                <path d="M44 4L58 8" stroke="#e879f9" strokeWidth="1.5" strokeDasharray="2 2" strokeLinecap="round" />
                <circle cx="14" cy="12" r="1.6" fill="#c084fc" opacity="0.7" />
                <circle cx="28" cy="15" r="1.6" fill="#c084fc" opacity="0.7" />
                <circle cx="44" cy="4"  r="1.8" fill="#e879f9" />
              </svg>
            </div>
            <div className="flex justify-between items-start relative z-10">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 bg-purple-500/[0.12] rounded-lg flex items-center justify-center border border-purple-400/[0.16] shadow-[0_0_10px_rgba(168,85,247,0.12)] transition-all duration-300 group-hover/predict:scale-105">
                  <svg width="14" height="14" viewBox="0 0 20 20" fill="none" className="text-purple-200">
                    <path d="M2 14L6 10L10 12L14 6L18 3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                    <path d="M14 6L18 3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeDasharray="2 2" opacity="0.5" />
                    <circle cx="14" cy="6" r="1.5" fill="currentColor" />
                  </svg>
                </div>
                <span className="text-[11px] text-purple-100/90 uppercase tracking-[0.12em] font-semibold">Predict</span>
              </div>
              {predAlertCount > 0 && (
                <div className="flex items-center gap-0.5 text-[10px] font-semibold text-amber-300 bg-amber-500/[0.10] px-2 py-0.5 rounded-md border border-amber-400/20">
                  {predAlertCount}
                </div>
              )}
            </div>
            <div className="flex items-baseline gap-1.5 mt-auto relative z-10">
              <span className="text-[14px] font-semibold text-purple-200/90 leading-none tracking-tight">Forecast</span>
              <span className="text-[10px] text-purple-300/60 font-medium">risks</span>
            </div>
          </button>
        )}

        {/* Digital Twin button — styled as KPI card */}
        {onDigitalTwinClick && (
          <button
            onClick={onDigitalTwinClick}
            className="card shimmer-border hover:border-emerald-400/30 p-3.5 flex flex-col justify-between h-[96px] min-w-[145px] flex-shrink-0 relative overflow-hidden group/twin cursor-pointer transition-all duration-300 text-left"
          >
            <div className="absolute inset-0 bg-gradient-to-br from-emerald-500/[0.12] to-teal-500/[0.04] opacity-0 group-hover/twin:opacity-100 transition-opacity duration-500 pointer-events-none"></div>
            <div className="absolute bottom-2 right-3 z-0 opacity-55 group-hover/twin:opacity-80 transition-opacity duration-500">
              <svg width="60" height="24" viewBox="0 0 60 24" fill="none">
                <rect x="2"  y="4"  width="14" height="10" rx="1.5" stroke="#34d399" strokeWidth="1.3" fill="none" />
                <rect x="32" y="4"  width="14" height="10" rx="1.5" stroke="#34d399" strokeWidth="1.3" fill="none" />
                <rect x="17" y="15" width="14" height="7" rx="1.5" stroke="#6ee7b7" strokeWidth="1.3" fill="none" />
                <path d="M9 14v3l12 1M39 14v3l-12 1" stroke="#34d399" strokeWidth="1" strokeLinecap="round" opacity="0.6" />
              </svg>
            </div>
            <div className="flex justify-between items-start relative z-10">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 bg-emerald-500/[0.12] rounded-lg flex items-center justify-center border border-emerald-400/[0.16] shadow-[0_0_10px_rgba(16,185,129,0.12)] transition-all duration-300 group-hover/twin:scale-105">
                  <svg width="14" height="14" viewBox="0 0 20 20" fill="none" className="text-emerald-200">
                    <rect x="2" y="4" width="6" height="5" rx="1" stroke="currentColor" strokeWidth="1.3" fill="none" />
                    <rect x="12" y="4" width="6" height="5" rx="1" stroke="currentColor" strokeWidth="1.3" fill="none" />
                    <rect x="7" y="12" width="6" height="5" rx="1" stroke="currentColor" strokeWidth="1.3" fill="none" />
                    <path d="M5 9v2l5 1M15 9v2l-5 1" stroke="currentColor" strokeWidth="1" strokeLinecap="round" opacity="0.6" />
                  </svg>
                </div>
                <span className="text-[11px] text-emerald-100/90 uppercase tracking-[0.12em] font-semibold">Twin</span>
              </div>
            </div>
            <div className="flex items-baseline gap-1.5 mt-auto relative z-10">
              <span className="text-[14px] font-semibold text-emerald-200/90 leading-none tracking-tight">Simulate</span>
              <span className="text-[10px] text-emerald-300/60 font-medium">live</span>
            </div>
          </button>
        )}
      </div>

    </div>
  );
};

export default KPIBar;
