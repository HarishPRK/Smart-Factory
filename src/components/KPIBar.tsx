import React, { useEffect, useRef, useState } from "react";
import { useFilters } from "../context/FilterContext";
import { kpis, getKpiForZone } from "../data/mockData";
import { useTweenedNumber } from "../hooks/useTweenedNumber";
import KOSDispenseWidget from "./KOSDispenseWidget";
import LorawanWidget from "./LorawanWidget";

/* ── Count-up KPI value ─────────────────────────────────
 * KPI values arrive as preformatted strings ("2,041", "128.1", "75.2"). This
 * parses the number, sweeps to it (from 0 on first mount, from the current
 * value on zone switches), and re-formats preserving the original grouping
 * and decimal places. Non-numeric values fall through unchanged. */
function parseKpiValue(s: string) {
  const cleaned = s.replace(/,/g, "");
  const num = parseFloat(cleaned);
  const dot = cleaned.indexOf(".");
  const decimals = dot >= 0 ? cleaned.length - dot - 1 : 0;
  return { num, decimals, group: s.includes(",") || num >= 1000, ok: Number.isFinite(num) };
}

const KpiCountUp: React.FC<{ value: string }> = ({ value }) => {
  const { num, decimals, group, ok } = parseKpiValue(value);
  const [revealed, setRevealed] = useState(false);
  useEffect(() => {
    const id = requestAnimationFrame(() => setRevealed(true));
    return () => cancelAnimationFrame(id);
  }, []);
  const tweened = useTweenedNumber(ok && revealed ? num : 0, 900);
  if (!ok) return <>{value}</>;
  return (
    <>
      {tweened.toLocaleString("en-US", {
        minimumFractionDigits: decimals,
        maximumFractionDigits: decimals,
        useGrouping: group,
      })}
    </>
  );
};

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
  onDpsClick?: () => void;
  onRoutingClick?: () => void;
  onGatewayTwinClick?: () => void;
  onVideoClick?: () => void;
  predAlertCount?: number;
}

const KPIBar: React.FC<KPIBarProps> = ({
  onOeeClick,
  onAnalyticsClick,
  onPredictClick,
  onDigitalTwinClick,
  onDpsClick,
  onRoutingClick,
  onGatewayTwinClick,
  onVideoClick,
  predAlertCount = 0,
}) => {
  const { state, dispatch } = useFilters();
  const scrollRef = useRef<HTMLDivElement>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);

  const updateScrollState = () => {
    const el = scrollRef.current;
    if (!el) return;
    const maxScroll = el.scrollWidth - el.clientWidth;
    setCanScrollLeft(el.scrollLeft > 4);
    setCanScrollRight(el.scrollLeft < maxScroll - 4);
  };

  useEffect(() => {
    updateScrollState();
    const el = scrollRef.current;
    if (!el) return;
    el.addEventListener("scroll", updateScrollState, { passive: true });
    const ro = new ResizeObserver(updateScrollState);
    ro.observe(el);
    return () => {
      el.removeEventListener("scroll", updateScrollState);
      ro.disconnect();
    };
  }, []);

  const scrollByAmount = (dir: 1 | -1) => {
    const el = scrollRef.current;
    if (!el) return;
    const step = Math.max(240, Math.round(el.clientWidth * 0.7));
    el.scrollBy({ left: dir * step, behavior: "smooth" });
  };

  return (
    <div className="flex items-center gap-2 w-full">
      <button
        type="button"
        onClick={() => scrollByAmount(-1)}
        aria-label="Scroll KPIs left"
        disabled={!canScrollLeft}
        className={`flex-none w-7 h-7 rounded-lg glass flex items-center justify-center text-white/70 hover:text-white transition-all duration-200 ${
          canScrollLeft ? "opacity-100" : "opacity-25 cursor-not-allowed"
        }`}
      >
        <svg width="12" height="12" viewBox="0 0 16 16" fill="none">
          <path d="M10 3L5 8l5 5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>

      {/* KPI cards + action buttons — single-row carousel.
          Edge-fade mask only on the side(s) with hidden cards, so the cut-off
          card fades out instead of hard-clipping — a clear "scroll for more"
          affordance that pairs with the chevron buttons. */}
      <div
        ref={scrollRef}
        className="flex gap-2.5 overflow-x-auto scroll-smooth flex-nowrap flex-1 min-w-0"
        style={{
          scrollbarWidth: "none",
          msOverflowStyle: "none",
          maskImage: `linear-gradient(90deg, ${canScrollLeft ? "transparent 0, #000 40px" : "#000 0"}, ${canScrollRight ? "#000 calc(100% - 48px), transparent 100%" : "#000 100%"})`,
          WebkitMaskImage: `linear-gradient(90deg, ${canScrollLeft ? "transparent 0, #000 40px" : "#000 0"}, ${canScrollRight ? "#000 calc(100% - 48px), transparent 100%" : "#000 100%"})`,
        }}
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
              className={`card ${kpi.hoverBorder} px-4 py-3.5 flex flex-col h-[100px] min-w-[200px] max-w-[320px] flex-1 basis-[200px] relative overflow-hidden animate-fade-in delay-${i + 1} group cursor-pointer transition-all duration-300 rounded-2xl ${
                isSelected
                  ? "ring-1 ring-white/10 scale-[1.02]"
                  : ""
              }`}
            >
              <div
                className={`absolute inset-0 bg-gradient-to-br ${kpi.accent} ${
                  isSelected ? "opacity-100" : "opacity-0 group-hover:opacity-100"
                } transition-opacity duration-500 pointer-events-none`}
              ></div>

              {/* Row 1: Icon + Label + Trend — vertically centered */}
              <div className="flex items-center justify-between relative z-10">
                <div className="flex items-center gap-2.5">
                  <div
                    className={`w-8 h-8 ${kpi.iconBg} rounded-[10px] flex items-center justify-center border ${kpi.iconBorder} transition-all duration-300 group-hover:scale-105`}
                  >
                    <img
                      src={kpi.icon}
                      alt={kpi.label}
                      className="w-4 h-4 opacity-85 invert"
                    />
                  </div>
                  <span className="text-[11px] text-white/60 uppercase tracking-[0.08em] font-semibold">
                    {kpi.label}
                  </span>
                </div>
                <div
                  className={`flex items-center gap-1 text-[10px] font-semibold ${kpi.trendColor}`}
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

              {/* Row 2: Value + Unit + Sparkline — pushed to bottom */}
              <div className="flex items-end justify-between mt-auto relative z-10">
                <div className="flex items-baseline gap-1.5">
                  <span className="text-[22px] font-medium gradient-number leading-none">
                    <KpiCountUp value={zoneData.value} />
                  </span>
                  <span className="text-[11px] text-white/35 font-medium">
                    {kpi.unit}
                  </span>
                </div>
                <MiniSparkline data={zoneData.sparkData} color={kpi.sparkColor} />
              </div>

              {isSelected && (
                <div className="absolute top-2.5 right-2.5 w-1.5 h-1.5 rounded-full bg-indigo-400 shadow-[0_0_6px_rgba(122,180,238,0.5)] z-20"></div>
              )}
            </div>
          );
        })}

        {/* Analytics */}
        {onAnalyticsClick && (
          <button
            onClick={onAnalyticsClick}
            className="card hover:border-cyan-400/25 px-4 py-3.5 flex flex-col h-[100px] min-w-[200px] max-w-[320px] flex-1 basis-[200px] relative overflow-hidden group/analytics cursor-pointer transition-all duration-300 text-left rounded-2xl"
          >
            <div className="absolute inset-0 bg-gradient-to-br from-cyan-500/[0.08] to-transparent opacity-0 group-hover/analytics:opacity-100 transition-opacity duration-500 pointer-events-none"></div>
            <div className="flex items-center gap-2.5 relative z-10">
              <div className="w-8 h-8 bg-cyan-500/[0.10] rounded-[10px] flex items-center justify-center border border-cyan-400/[0.12] transition-all duration-300 group-hover/analytics:scale-105">
                <svg width="15" height="15" viewBox="0 0 20 20" fill="none" className="text-cyan-300">
                  <rect x="2" y="11" width="3" height="7" rx="1" fill="currentColor" opacity="0.6" />
                  <rect x="7" y="7" width="3" height="11" rx="1" fill="currentColor" opacity="0.8" />
                  <rect x="12" y="3" width="3" height="15" rx="1" fill="currentColor" />
                  <path d="M3.5 10L8.5 6L13.5 2" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" opacity="0.5" />
                </svg>
              </div>
              <span className="text-[11px] text-white/60 uppercase tracking-[0.08em] font-semibold">Analytics</span>
            </div>
            <div className="flex items-end justify-between mt-auto relative z-10">
              <div className="flex items-baseline gap-1.5">
                <span className="text-[13px] font-medium text-cyan-300/80 leading-none">Open</span>
                <span className="text-[11px] text-white/30">trends</span>
              </div>
              <svg width="60" height="24" viewBox="0 0 60 24" fill="none" className="opacity-50 group-hover/analytics:opacity-75 transition-opacity">
                <rect x="2" y="14" width="6" height="8" rx="1.5" fill="#22d3ee" opacity="0.9" />
                <rect x="12" y="9" width="6" height="13" rx="1.5" fill="#38bdf8" opacity="0.85" />
                <rect x="22" y="5" width="6" height="17" rx="1.5" fill="#60a5fa" opacity="0.8" />
                <rect x="32" y="11" width="6" height="11" rx="1.5" fill="#38bdf8" opacity="0.75" />
                <rect x="42" y="2" width="6" height="20" rx="1.5" fill="#22d3ee" />
              </svg>
            </div>
          </button>
        )}

        {/* Predict */}
        {onPredictClick && (
          <button
            onClick={onPredictClick}
            className="card hover:border-purple-400/25 px-4 py-3.5 flex flex-col h-[100px] min-w-[200px] max-w-[320px] flex-1 basis-[200px] relative overflow-hidden group/predict cursor-pointer transition-all duration-300 text-left rounded-2xl"
          >
            <div className="absolute inset-0 bg-gradient-to-br from-purple-500/[0.08] to-transparent opacity-0 group-hover/predict:opacity-100 transition-opacity duration-500 pointer-events-none"></div>
            <div className="flex items-center justify-between relative z-10">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 bg-purple-500/[0.10] rounded-[10px] flex items-center justify-center border border-purple-400/[0.12] transition-all duration-300 group-hover/predict:scale-105">
                  <svg width="15" height="15" viewBox="0 0 20 20" fill="none" className="text-purple-300">
                    <path d="M2 14L6 10L10 12L14 6L18 3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                    <path d="M14 6L18 3" strokeDasharray="2 2" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" opacity="0.5" />
                    <circle cx="14" cy="6" r="1.5" fill="currentColor" />
                  </svg>
                </div>
                <span className="text-[11px] text-white/60 uppercase tracking-[0.08em] font-semibold">Predict</span>
              </div>
              {predAlertCount > 0 && (
                <span className="text-[9px] font-bold text-amber-300 bg-amber-500/[0.12] px-1.5 py-0.5 rounded-md">{predAlertCount}</span>
              )}
            </div>
            <div className="flex items-end justify-between mt-auto relative z-10">
              <div className="flex items-baseline gap-1.5">
                <span className="text-[13px] font-medium text-purple-300/80 leading-none">Forecast</span>
                <span className="text-[11px] text-white/30">risks</span>
              </div>
              <svg width="60" height="24" viewBox="0 0 60 24" fill="none" className="opacity-50 group-hover/predict:opacity-75 transition-opacity">
                <path d="M2 18L14 12L28 15L44 4L58 8" stroke="#c084fc" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                <path d="M44 4L58 8" stroke="#e879f9" strokeWidth="1.5" strokeDasharray="2 2" strokeLinecap="round" />
                <circle cx="14" cy="12" r="1.6" fill="#c084fc" opacity="0.7" />
                <circle cx="44" cy="4" r="1.8" fill="#e879f9" />
              </svg>
            </div>
          </button>
        )}

        {/* Digital Twin */}
        {onDigitalTwinClick && (
          <button
            onClick={onDigitalTwinClick}
            className="card hover:border-emerald-400/25 px-4 py-3.5 flex flex-col h-[100px] min-w-[200px] max-w-[320px] flex-1 basis-[200px] relative overflow-hidden group/twin cursor-pointer transition-all duration-300 text-left rounded-2xl"
          >
            <div className="absolute inset-0 bg-gradient-to-br from-emerald-500/[0.08] to-transparent opacity-0 group-hover/twin:opacity-100 transition-opacity duration-500 pointer-events-none"></div>
            <div className="flex items-center gap-2.5 relative z-10">
              <div className="w-8 h-8 bg-emerald-500/[0.10] rounded-[10px] flex items-center justify-center border border-emerald-400/[0.12] transition-all duration-300 group-hover/twin:scale-105">
                <svg width="15" height="15" viewBox="0 0 20 20" fill="none" className="text-emerald-300">
                  <rect x="2" y="3" width="6" height="5" rx="1.5" stroke="currentColor" strokeWidth="1.2" fill="none" />
                  <rect x="12" y="3" width="6" height="5" rx="1.5" stroke="currentColor" strokeWidth="1.2" fill="none" />
                  <rect x="7" y="12" width="6" height="5" rx="1.5" stroke="currentColor" strokeWidth="1.2" fill="none" />
                  <path d="M5 8v3l5 1M15 8v3l-5 1" stroke="currentColor" strokeWidth="1" strokeLinecap="round" opacity="0.6" />
                </svg>
              </div>
              <span className="text-[11px] text-white/60 uppercase tracking-[0.08em] font-semibold">Twin</span>
            </div>
            <div className="flex items-end justify-between mt-auto relative z-10">
              <div className="flex items-baseline gap-1.5">
                <span className="text-[13px] font-medium text-emerald-300/80 leading-none">Simulate</span>
                <span className="text-[11px] text-white/30">live</span>
              </div>
              <svg width="60" height="24" viewBox="0 0 60 24" fill="none" className="opacity-50 group-hover/twin:opacity-75 transition-opacity">
                <rect x="2" y="4" width="14" height="10" rx="2" stroke="#34d399" strokeWidth="1.3" fill="none" />
                <rect x="32" y="4" width="14" height="10" rx="2" stroke="#34d399" strokeWidth="1.3" fill="none" />
                <rect x="17" y="15" width="14" height="7" rx="2" stroke="#6ee7b7" strokeWidth="1.3" fill="none" />
                <path d="M9 14v3l12 1M39 14v3l-12 1" stroke="#34d399" strokeWidth="1" strokeLinecap="round" opacity="0.6" />
              </svg>
            </div>
          </button>
        )}

        {/* DPS */}
        {onDpsClick && (
          <button
            onClick={onDpsClick}
            className="card hover:border-blue-400/25 px-4 py-3.5 flex flex-col h-[100px] min-w-[200px] max-w-[320px] flex-1 basis-[200px] relative overflow-hidden group/dps cursor-pointer transition-all duration-300 text-left rounded-2xl"
          >
            <div className="absolute inset-0 bg-gradient-to-br from-blue-500/[0.08] to-transparent opacity-0 group-hover/dps:opacity-100 transition-opacity duration-500 pointer-events-none"></div>
            <div className="flex items-center gap-2.5 relative z-10">
              <div className="w-8 h-8 bg-blue-500/[0.10] rounded-[10px] flex items-center justify-center border border-blue-400/[0.12] transition-all duration-300 group-hover/dps:scale-105">
                <svg width="15" height="15" viewBox="0 0 20 20" fill="none" className="text-blue-300">
                  <path d="M2 5Q8 5 10 10Q12 15 18 15" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" fill="none" />
                  <path d="M2 15Q8 15 10 10Q12 5 18 5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeDasharray="2 2" fill="none" opacity="0.5" />
                  <circle cx="10" cy="10" r="2" fill="currentColor" />
                </svg>
              </div>
              <span className="text-[11px] text-white/60 uppercase tracking-[0.08em] font-semibold">DPS</span>
            </div>
            <div className="flex items-end justify-between mt-auto relative z-10">
              <div className="flex items-baseline gap-1.5">
                <span className="text-[13px] font-medium text-blue-300/80 leading-none">Paths</span>
                <span className="text-[11px] text-white/30">fiber · 5G</span>
              </div>
              <svg width="60" height="24" viewBox="0 0 60 24" fill="none" className="opacity-50 group-hover/dps:opacity-75 transition-opacity">
                <path d="M2 6Q14 6 22 12Q34 18 56 18" stroke="#60a5fa" strokeWidth="1.5" strokeLinecap="round" fill="none" />
                <path d="M2 18Q14 18 22 12Q34 6 56 6" stroke="#3b82f6" strokeWidth="1.5" strokeLinecap="round" strokeDasharray="3 2" fill="none" />
                <circle cx="22" cy="12" r="2.2" fill="#ffffff" />
              </svg>
            </div>
          </button>
        )}

        {/* Application Traffic Routing */}
        {onRoutingClick && (
          <button
            onClick={onRoutingClick}
            className="card hover:border-violet-400/25 px-4 py-3.5 flex flex-col h-[100px] min-w-[200px] max-w-[320px] flex-1 basis-[200px] relative overflow-hidden group/routing cursor-pointer transition-all duration-300 text-left rounded-2xl"
          >
            <div className="absolute inset-0 bg-gradient-to-br from-violet-500/[0.08] to-transparent opacity-0 group-hover/routing:opacity-100 transition-opacity duration-500 pointer-events-none"></div>
            <div className="flex items-center gap-2.5 relative z-10">
              <div className="w-8 h-8 bg-violet-500/[0.10] rounded-[10px] flex items-center justify-center border border-violet-400/[0.12] transition-all duration-300 group-hover/routing:scale-105">
                <svg width="15" height="15" viewBox="0 0 20 20" fill="none" className="text-violet-300">
                  <circle cx="4" cy="5" r="2" stroke="currentColor" strokeWidth="1.3" />
                  <circle cx="4" cy="15" r="2" stroke="currentColor" strokeWidth="1.3" />
                  <circle cx="16" cy="5" r="2" stroke="currentColor" strokeWidth="1.3" />
                  <circle cx="16" cy="15" r="2" stroke="currentColor" strokeWidth="1.3" />
                  <path d="M6 5h8M6 15h8M10 5v10" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
                </svg>
              </div>
              <span className="text-[11px] text-white/60 uppercase tracking-[0.08em] font-semibold">App Routing</span>
            </div>
            <div className="flex items-end justify-between mt-auto relative z-10">
              <div className="flex items-baseline gap-1.5">
                <span className="text-[13px] font-medium text-violet-300/80 leading-none">Steer</span>
                <span className="text-[11px] text-white/30">apps · tunnels</span>
              </div>
              <svg width="60" height="24" viewBox="0 0 60 24" fill="none" className="opacity-50 group-hover/routing:opacity-75 transition-opacity">
                <path d="M3 5h14c8 0 8 14 16 14h23" stroke="#a78bfa" strokeWidth="1.5" strokeLinecap="round" />
                <path d="M3 19h14c8 0 8-14 16-14h23" stroke="#c084fc" strokeWidth="1.5" strokeLinecap="round" strokeDasharray="3 2" />
                <circle cx="33" cy="19" r="2.2" fill="#ddd6fe" />
              </svg>
            </div>
          </button>
        )}

        {/* Gateway Twin — opens the external gateway digital twin. */}
        {onGatewayTwinClick && (
          <button
            onClick={onGatewayTwinClick}
            title="Open Gateway Twin"
            className="card hover:border-cyan-400/25 px-4 py-3.5 flex flex-col h-[100px] min-w-[200px] max-w-[320px] flex-1 basis-[200px] relative overflow-hidden group/gateway-twin cursor-pointer transition-all duration-300 text-left rounded-2xl"
          >
            <div className="absolute inset-0 bg-gradient-to-br from-cyan-500/[0.08] to-transparent opacity-0 group-hover/gateway-twin:opacity-100 transition-opacity duration-500 pointer-events-none"></div>
            <div className="flex items-center gap-2.5 relative z-10">
              <div className="w-8 h-8 bg-cyan-500/[0.10] rounded-[10px] flex items-center justify-center border border-cyan-400/[0.12] transition-all duration-300 group-hover/gateway-twin:scale-105">
                <svg width="16" height="16" viewBox="0 0 20 20" fill="none" className="text-cyan-300">
                  <rect x="2.5" y="4" width="6" height="12" rx="1.5" stroke="currentColor" strokeWidth="1.25" />
                  <rect x="11.5" y="4" width="6" height="12" rx="1.5" stroke="currentColor" strokeWidth="1.25" opacity="0.72" />
                  <path d="M8.5 7h3M8.5 13h3" stroke="currentColor" strokeWidth="1.15" strokeLinecap="round" />
                  <circle cx="5.5" cy="7" r="0.8" fill="currentColor" />
                  <circle cx="14.5" cy="13" r="0.8" fill="currentColor" opacity="0.8" />
                </svg>
              </div>
              <span className="text-[11px] text-white/60 uppercase tracking-[0.08em] font-semibold">Gateway Twin</span>
            </div>
            <div className="flex items-end justify-between mt-auto relative z-10">
              <div className="flex items-baseline gap-1.5">
                <span className="text-[13px] font-medium text-cyan-300/80 leading-none">Open</span>
                <span className="text-[11px] text-white/30">digital gateway</span>
              </div>
              <svg width="60" height="24" viewBox="0 0 60 24" fill="none" className="opacity-50 group-hover/gateway-twin:opacity-80 transition-opacity">
                <rect x="3" y="4" width="16" height="16" rx="3" stroke="#67e8f9" strokeWidth="1.4" />
                <rect x="41" y="4" width="16" height="16" rx="3" stroke="#22d3ee" strokeWidth="1.4" opacity="0.75" />
                <path d="M19 8h11l4 4-4 4-11 0M41 8H30" stroke="#67e8f9" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
                <circle cx="11" cy="12" r="2" fill="#cffafe" />
                <circle cx="49" cy="12" r="2" fill="#67e8f9" />
              </svg>
            </div>
          </button>
        )}

        {/* Video */}
        {onVideoClick && (
          <button
            onClick={onVideoClick}
            className="card hover:border-rose-400/25 px-4 py-3.5 flex flex-col h-[100px] min-w-[200px] max-w-[320px] flex-1 basis-[200px] relative overflow-hidden group/video cursor-pointer transition-all duration-300 text-left rounded-2xl"
          >
            <div className="absolute inset-0 bg-gradient-to-br from-rose-500/[0.08] to-transparent opacity-0 group-hover/video:opacity-100 transition-opacity duration-500 pointer-events-none"></div>
            <div className="flex items-center gap-2.5 relative z-10">
              <div className="w-8 h-8 bg-rose-500/[0.10] rounded-[10px] flex items-center justify-center border border-rose-400/[0.12] transition-all duration-300 group-hover/video:scale-105">
                <svg width="15" height="15" viewBox="0 0 20 20" fill="none" className="text-rose-300">
                  <rect x="2" y="4" width="11" height="8" rx="1.5" stroke="currentColor" strokeWidth="1.3" fill="none" />
                  <path d="M13 7L17 5V11L13 9V7Z" fill="currentColor" opacity="0.8" />
                  <circle cx="7.5" cy="8" r="1.5" fill="currentColor" opacity="0.6" />
                </svg>
              </div>
              <span className="text-[11px] text-white/60 uppercase tracking-[0.08em] font-semibold">Video</span>
            </div>
            <div className="flex items-end justify-between mt-auto relative z-10">
              <div className="flex items-baseline gap-1.5">
                <span className="text-[13px] font-medium text-rose-300/80 leading-none">Streams</span>
                <span className="text-[11px] text-white/30">edge · AI</span>
              </div>
              <svg width="60" height="24" viewBox="0 0 60 24" fill="none" className="opacity-50 group-hover/video:opacity-75 transition-opacity">
                <rect x="2" y="3" width="12" height="8" rx="2" fill="#fb7185" opacity="0.8" />
                <rect x="17" y="3" width="12" height="8" rx="2" fill="#f43f5e" opacity="0.65" />
                <rect x="2" y="13" width="12" height="8" rx="2" fill="#f43f5e" opacity="0.65" />
                <rect x="17" y="13" width="12" height="8" rx="2" fill="#fb7185" opacity="0.8" />
                <circle cx="42" cy="12" r="3" stroke="#ef4444" strokeWidth="1.2" fill="none" />
                <circle cx="42" cy="12" r="1" fill="#ef4444" />
              </svg>
            </div>
          </button>
        )}

        {/* KOS dispenser feed — AWS IoT-forwarded pour + recommendation events.
            Sits at the end of the KPI row so it doesn't push the existing
            cards around when no data is flowing yet. */}
        <KOSDispenseWidget />

        {/* LoRaWAN soil/irrigation sensors — local MQTT-bridged feed.
            Click opens a drawer with per-device soil temp / moisture /
            conductivity / battery readings and sparklines. */}
        <LorawanWidget />
      </div>

      <button
        type="button"
        onClick={() => scrollByAmount(1)}
        aria-label="Scroll KPIs right"
        disabled={!canScrollRight}
        className={`flex-none w-7 h-7 rounded-lg glass flex items-center justify-center text-white/70 hover:text-white transition-all duration-200 ${
          canScrollRight ? "opacity-100" : "opacity-25 cursor-not-allowed"
        }`}
      >
        <svg width="12" height="12" viewBox="0 0 16 16" fill="none">
          <path d="M6 3l5 5-5 5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>
    </div>
  );
};

export default KPIBar;
