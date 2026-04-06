import React, { useRef, useState, useEffect } from "react";
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
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);

  const checkScroll = () => {
    const el = scrollRef.current;
    if (!el) return;
    setCanScrollLeft(el.scrollLeft > 5);
    setCanScrollRight(el.scrollLeft < el.scrollWidth - el.clientWidth - 5);
  };

  useEffect(() => {
    checkScroll();
    const el = scrollRef.current;
    if (el) el.addEventListener("scroll", checkScroll);
    window.addEventListener("resize", checkScroll);
    return () => {
      if (el) el.removeEventListener("scroll", checkScroll);
      window.removeEventListener("resize", checkScroll);
    };
  }, []);

  const scroll = (dir: "left" | "right") => {
    scrollRef.current?.scrollBy({ left: dir === "left" ? -180 : 180, behavior: "smooth" });
  };

  return (
    <div className="flex items-center gap-1.5 w-full">
      {/* Left arrow */}
      <button
        onClick={() => scroll("left")}
        className={`flex-shrink-0 h-[96px] w-7 card flex items-center justify-center cursor-pointer hover:border-cyan-400/20 transition-all ${canScrollLeft ? "" : "opacity-20 pointer-events-none"}`}
      >
        <svg width="12" height="12" viewBox="0 0 12 12" fill="none" className="text-cyan-200/70">
          <path d="M7.5 2.5L4 6l3.5 3.5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>

      {/* Scrollable KPI cards + action buttons */}
      <div
        ref={scrollRef}
        className="flex gap-2.5 flex-1 overflow-x-auto min-w-0 scroll-smooth"
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

        {/* Analytics button */}
        {onAnalyticsClick && (
          <button
            onClick={onAnalyticsClick}
            className="flex-shrink-0 h-[96px] px-4 card flex flex-col items-center justify-center gap-1.5 group/analytics cursor-pointer hover:border-cyan-400/20 transition-all duration-300"
          >
            <svg width="16" height="16" viewBox="0 0 20 20" fill="none" className="text-cyan-300/50 group-hover/analytics:text-cyan-300 transition-colors">
              <rect x="2" y="10" width="3" height="8" rx="1" fill="currentColor" />
              <rect x="7" y="6" width="3" height="12" rx="1" fill="currentColor" />
              <rect x="12" y="3" width="3" height="15" rx="1" fill="currentColor" />
              <path d="M3 9L8 5L13 2" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" opacity="0.5" />
            </svg>
            <span className="text-[8px] text-sky-200/50 group-hover/analytics:text-sky-200/80 font-semibold uppercase tracking-[0.1em] transition-colors whitespace-nowrap">Analytics</span>
          </button>
        )}

        {/* Predict button */}
        {onPredictClick && (
          <button
            onClick={onPredictClick}
            className="flex-shrink-0 h-[96px] px-4 card flex flex-col items-center justify-center gap-1.5 group/predict cursor-pointer hover:border-purple-400/20 transition-all duration-300 relative"
          >
            <svg width="16" height="16" viewBox="0 0 20 20" fill="none" className="text-purple-300/50 group-hover/predict:text-purple-300 transition-colors">
              <path d="M2 14L6 10L10 12L14 6L18 3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
              <path d="M14 6L18 3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeDasharray="2 2" opacity="0.5" />
              <circle cx="6" cy="10" r="1.5" fill="currentColor" opacity="0.5" />
              <circle cx="10" cy="12" r="1.5" fill="currentColor" opacity="0.5" />
              <circle cx="14" cy="6" r="1.5" fill="currentColor" />
            </svg>
            <span className="text-[8px] text-sky-200/50 group-hover/predict:text-sky-200/80 font-semibold uppercase tracking-[0.1em] transition-colors whitespace-nowrap">Predict</span>
            {predAlertCount > 0 && (
              <span className="absolute -top-0.5 -right-0.5 min-w-[16px] h-4 bg-gradient-to-r from-amber-500 to-red-500 rounded-full shadow-[0_0_8px_rgba(245,158,11,0.5)] text-[8px] font-bold flex items-center justify-center px-1 text-white border border-[#030b1a]/80">
                {predAlertCount}
              </span>
            )}
          </button>
        )}

        {/* Digital Twin button */}
        {onDigitalTwinClick && (
          <button
            onClick={onDigitalTwinClick}
            className="flex-shrink-0 h-[96px] px-4 card flex flex-col items-center justify-center gap-1.5 group/twin cursor-pointer hover:border-emerald-400/20 transition-all duration-300"
          >
            <svg width="16" height="16" viewBox="0 0 20 20" fill="none" className="text-emerald-300/50 group-hover/twin:text-emerald-300 transition-colors">
              <rect x="2" y="4" width="6" height="5" rx="1" stroke="currentColor" strokeWidth="1.3" />
              <rect x="12" y="4" width="6" height="5" rx="1" stroke="currentColor" strokeWidth="1.3" />
              <rect x="7" y="12" width="6" height="5" rx="1" stroke="currentColor" strokeWidth="1.3" />
              <path d="M5 9v2l5 1M15 9v2l-5 1" stroke="currentColor" strokeWidth="1" strokeLinecap="round" opacity="0.5" />
            </svg>
            <span className="text-[8px] text-sky-200/50 group-hover/twin:text-sky-200/80 font-semibold uppercase tracking-[0.1em] transition-colors whitespace-nowrap">Twin</span>
          </button>
        )}
      </div>

      {/* Right arrow */}
      <button
        onClick={() => scroll("right")}
        className={`flex-shrink-0 h-[96px] w-7 card flex items-center justify-center cursor-pointer hover:border-cyan-400/20 transition-all ${canScrollRight ? "" : "opacity-20 pointer-events-none"}`}
      >
        <svg width="12" height="12" viewBox="0 0 12 12" fill="none" className="text-cyan-200/70">
          <path d="M4.5 2.5L8 6l-3.5 3.5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>
    </div>
  );
};

export default KPIBar;
