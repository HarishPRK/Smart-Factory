import React, { useEffect, useState } from "react";
import OEEGauge from "./OEEGauge";
import { useOEE } from "../hooks/useOEE";
import { useTweenedNumber } from "../hooks/useTweenedNumber";
import type { OEETimeRange } from "../types";

interface OEEPanelProps {
  open: boolean;
  onClose: () => void;
}

const TIME_RANGES: { id: OEETimeRange; label: string }[] = [
  { id: "shift", label: "Shift" },
  { id: "24h", label: "24h" },
  { id: "7d", label: "7d" },
  { id: "30d", label: "30d" },
];

/* ── Count-up number ────────────────────────────────────
 * Tweens to `value` and renders it; combined with the panel's reveal gating
 * (0 → real value once mounted) this makes every stat sweep up on open. */
const CountUp: React.FC<{ value: number; decimals?: number; suffix?: string }> = ({
  value, decimals = 0, suffix = "",
}) => {
  const t = useTweenedNumber(value, 750);
  return <>{t.toFixed(decimals)}{suffix}</>;
};

/* ── Trend Chart ────────────────────────────────────── */

const TrendChart: React.FC<{
  data: { timestamp: number; oee: number; availability: number; performance: number; quality: number }[];
  rangeKey: string;
}> = ({ data, rangeKey }) => {
  if (data.length < 2) {
    return <div className="h-[160px] flex items-center justify-center text-sky-200/40 text-[11px]">No trend data</div>;
  }

  const W = 500;
  const H = 160;
  const pad = { top: 16, right: 12, bottom: 24, left: 40 };
  const cw = W - pad.left - pad.right;
  const ch = H - pad.top - pad.bottom;
  const baseY = pad.top + ch;

  const toX = (i: number) => pad.left + (i / (data.length - 1)) * cw;
  const toY = (v: number) => pad.top + ch - v * ch;

  const lines: { key: string; color: string; values: number[] }[] = [
    { key: "OEE", color: "#10b981", values: data.map((d) => d.oee) },
    { key: "Avail", color: "#3b82f6", values: data.map((d) => d.availability) },
    { key: "Perf", color: "#f59e0b", values: data.map((d) => d.performance) },
    { key: "Qual", color: "#8b5cf6", values: data.map((d) => d.quality) },
  ];

  const buildPath = (values: number[]) => {
    const pts = values.map((v, i) => ({ x: toX(i), y: toY(v) }));
    let path = `M${pts[0].x},${pts[0].y}`;
    for (let i = 1; i < pts.length; i++) {
      const p = pts[i - 1], c = pts[i];
      path += ` C${p.x + (c.x - p.x) * 0.4},${p.y} ${p.x + (c.x - p.x) * 0.6},${c.y} ${c.x},${c.y}`;
    }
    return path;
  };

  const oeePath = buildPath(lines[0].values);
  const oeeArea = `${oeePath} L${toX(data.length - 1)},${baseY} L${toX(0)},${baseY} Z`;

  return (
    <div>
      {/* `key` restarts the draw-in animation whenever the range/data changes */}
      <svg key={rangeKey} viewBox={`0 0 ${W} ${H}`} className="w-full" style={{ height: H }}>
        <defs>
          <linearGradient id="oee-area" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#10b981" stopOpacity="0.28" />
            <stop offset="100%" stopColor="#10b981" stopOpacity="0" />
          </linearGradient>
        </defs>

        {/* Grid */}
        {[0, 0.25, 0.5, 0.75, 1].map((frac) => {
          const y = pad.top + ch * (1 - frac);
          return (
            <g key={frac}>
              <line x1={pad.left} y1={y} x2={W - pad.right} y2={y} stroke="rgba(100,160,220,0.08)" strokeWidth="1" />
              <text x={pad.left - 6} y={y + 3} textAnchor="end" fill="rgba(140,180,220,0.55)" fontSize="9" fontFamily="Inter">
                {(frac * 100).toFixed(0)}%
              </text>
            </g>
          );
        })}

        {/* Soft glowing area under the OEE line */}
        <path d={oeeArea} fill="url(#oee-area)" style={{ animation: "oee-area-rise 0.9s ease-out 0.2s both" }} />

        {/* Lines — each draws itself in left-to-right, staggered */}
        {lines.map((line, i) => (
          <path
            key={line.key}
            d={buildPath(line.values)}
            fill="none"
            stroke={line.color}
            strokeWidth={line.key === "OEE" ? 2.2 : 1.5}
            strokeLinecap="round"
            strokeLinejoin="round"
            opacity={line.key === "OEE" ? 1 : 0.75}
            pathLength={1}
            style={{
              strokeDasharray: 1,
              animation: `oee-draw 1.1s ease-out ${0.15 + i * 0.12}s both`,
              filter: line.key === "OEE" ? "drop-shadow(0 0 4px rgba(16,185,129,0.5))" : undefined,
            }}
          />
        ))}
      </svg>

      {/* Legend */}
      <div className="flex items-center justify-center gap-4 mt-1">
        {lines.map((line) => (
          <div key={line.key} className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full" style={{ backgroundColor: line.color, boxShadow: `0 0 6px ${line.color}` }} />
            <span className="text-[9px] text-sky-200/60 font-medium">{line.key}</span>
          </div>
        ))}
      </div>
    </div>
  );
};

/* ── Stat Card ──────────────────────────────────────── */

const StatCard: React.FC<{
  label: string;
  value: string | number;
  unit?: string;
  color?: string;
  delay: number;
}> = ({ label, value, unit, color = "text-cyan-50", delay }) => (
  <div
    className="flex-1 bg-white/[0.02] border border-cyan-300/[0.06] rounded-xl px-3 py-2.5 animate-fade-in transition-all duration-300 hover:-translate-y-0.5 hover:border-cyan-300/20 hover:bg-white/[0.04]"
    style={{ animationDelay: `${delay}ms` }}
  >
    <div className="text-[9px] text-sky-200/50 uppercase tracking-[0.12em] font-semibold">{label}</div>
    <div className={`text-[18px] font-semibold mt-1 leading-none ${color}`}>
      {typeof value === "number" ? <CountUp value={value} /> : value}
      {unit && <span className="text-[11px] text-sky-200/50 ml-1">{unit}</span>}
    </div>
  </div>
);

/* ── Main Panel ─────────────────────────────────────── */

const OEEPanel: React.FC<OEEPanelProps> = ({ open, onClose }) => {
  const { oee, trend, loading, trendTimeRange, setTrendTimeRange } = useOEE();

  // Reveal gating: start everything at 0 on the first paint, then flip to the
  // real values one frame later so the gauges, bars and numbers all sweep up
  // from zero when the panel opens.
  const [revealed, setRevealed] = useState(false);
  useEffect(() => {
    const id = requestAnimationFrame(() => setRevealed(true));
    return () => cancelAnimationFrame(id);
  }, []);

  if (!open) return null;

  const formatTime = (sec: number) => {
    const h = Math.floor(sec / 3600);
    const m = Math.floor((sec % 3600) / 60);
    return h > 0 ? `${h}h ${m}m` : `${m}m`;
  };

  const r = (v: number) => (revealed ? v : 0);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} style={{ animation: "fadeIn 0.25s ease" }} />

      <div
        className="relative w-[90vw] max-w-[900px] max-h-[85vh] bg-[#0a1628]/95 backdrop-blur-2xl border border-cyan-300/12 rounded-2xl shadow-[0_20px_80px_rgba(0,0,0,0.8)] flex flex-col overflow-hidden"
        style={{ animation: "modalIn 0.32s cubic-bezier(0.16, 1, 0.3, 1)" }}
      >
        {/* Animated accent sweep along the top edge */}
        <div className="absolute top-0 left-0 right-0 h-px overflow-hidden">
          <div className="h-full w-1/3 bg-gradient-to-r from-transparent via-cyan-300/70 to-transparent" style={{ animation: "oee-bar-shimmer 3.5s ease-in-out infinite" }} />
        </div>

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-cyan-300/[0.08]">
          <div>
            <h2 className="text-[16px] font-semibold text-cyan-50 tracking-tight">OEE Dashboard</h2>
            <p className="text-[11px] text-sky-200/60 font-medium mt-0.5">
              Overall Equipment Effectiveness — Availability x Performance x Quality
            </p>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-lg bg-white/[0.04] border border-cyan-300/[0.08] flex items-center justify-center text-sky-200/60 hover:text-white hover:bg-white/[0.08] hover:rotate-90 transition-all duration-300"
          >
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
              <path d="M3 3l8 8M11 3l-8 8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
            </svg>
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5">
          {loading && !oee ? (
            <div className="h-40 flex items-center justify-center text-sky-200/40 text-sm">Loading OEE data...</div>
          ) : (
            <>
              {/* Gauges Row */}
              <div className="flex items-center justify-center gap-8 animate-fade-in" style={{ animationDelay: "40ms" }}>
                <OEEGauge value={r(oee?.oee.value ?? 0)} size={140} label="OEE" />
                <div className="h-16 w-px bg-gradient-to-b from-transparent via-cyan-300/15 to-transparent" />
                <OEEGauge value={r(oee?.availability.value ?? 0)} size={90} label="Availability" />
                <OEEGauge value={r(oee?.performance.value ?? 0)} size={90} label="Performance" />
                <OEEGauge value={r(oee?.quality.value ?? 0)} size={90} label="Quality" />
              </div>

              {/* Stats Row */}
              <div className="flex gap-3">
                <StatCard label="Total Cycles" value={r(oee?.totalCycles ?? 0)} delay={120} />
                <StatCard label="Good Parts" value={r(oee?.goodCycles ?? 0)} color="text-emerald-300" delay={180} />
                <StatCard label="Rejects" value={r(oee?.rejectCycles ?? 0)} color="text-red-300" delay={240} />
                <StatCard label="Run Time" value={formatTime(oee?.runTimeSec ?? 0)} delay={300} />
                <StatCard label="Shift" value={oee?.shiftId ?? "—"} delay={360} />
              </div>

              {/* Trend Chart */}
              <div className="bg-white/[0.02] border border-cyan-300/[0.06] rounded-xl p-4 animate-fade-in" style={{ animationDelay: "300ms" }}>
                <div className="flex items-center justify-between mb-3">
                  <span className="text-[11px] text-sky-200/70 font-semibold uppercase tracking-[0.12em]">OEE Trend</span>
                  <div className="flex gap-1 p-0.5 rounded-lg bg-white/[0.03] border border-cyan-300/[0.06]">
                    {TIME_RANGES.map((tr) => (
                      <button
                        key={tr.id}
                        onClick={() => setTrendTimeRange(tr.id)}
                        className={`px-2.5 py-1 rounded-md text-[10px] font-semibold transition-all ${
                          trendTimeRange === tr.id
                            ? "bg-cyan-400/15 text-cyan-200 border border-cyan-400/20"
                            : "text-sky-200/50 hover:text-sky-200/80 border border-transparent"
                        }`}
                      >
                        {tr.label}
                      </button>
                    ))}
                  </div>
                </div>
                <TrendChart data={trend} rangeKey={trendTimeRange} />
              </div>

              {/* Pillar Breakdown */}
              <div className="grid grid-cols-3 gap-3">
                {[
                  { label: "Availability", value: oee?.availability, color: "#3b82f6", light: "#93c5fd", desc: "Run Time / Planned Time" },
                  { label: "Performance", value: oee?.performance, color: "#f59e0b", light: "#fcd34d", desc: "Actual Output / Ideal Output" },
                  { label: "Quality", value: oee?.quality, color: "#8b5cf6", light: "#c4b5fd", desc: "Good Parts / Total Parts" },
                ].map((pillar, i) => (
                  <div
                    key={pillar.label}
                    className="bg-white/[0.02] border border-cyan-300/[0.06] rounded-xl p-4 animate-fade-in transition-all duration-300 hover:-translate-y-0.5 hover:border-cyan-300/20"
                    style={{ animationDelay: `${380 + i * 70}ms` }}
                  >
                    <div className="flex items-center gap-2 mb-2">
                      <span className="w-2 h-2 rounded-full" style={{ backgroundColor: pillar.color, boxShadow: `0 0 8px ${pillar.color}` }} />
                      <span className="text-[11px] text-sky-200/70 font-semibold uppercase tracking-[0.1em]">{pillar.label}</span>
                    </div>
                    <div className="text-[28px] font-semibold text-cyan-50 leading-none tabular-nums">
                      <CountUp value={r((pillar.value?.value ?? 0) * 100)} decimals={1} suffix="%" />
                    </div>
                    <div className="text-[9px] text-sky-200/40 mt-2">{pillar.desc}</div>
                    {/* Bar — gradient fill + sweeping shimmer */}
                    <div className="mt-3 h-1.5 bg-white/[0.04] rounded-full overflow-hidden">
                      <div
                        className="h-full rounded-full relative overflow-hidden transition-[width] duration-1000 ease-out"
                        style={{
                          width: `${r(pillar.value?.value ?? 0) * 100}%`,
                          background: `linear-gradient(90deg, ${pillar.color}, ${pillar.light})`,
                          boxShadow: `0 0 10px ${pillar.color}66`,
                        }}
                      >
                        <div
                          className="absolute inset-y-0 w-1/3"
                          style={{
                            background: "linear-gradient(90deg, transparent, rgba(255,255,255,0.55), transparent)",
                            animation: `oee-bar-shimmer 2.2s ease-in-out ${0.6 + i * 0.2}s infinite`,
                          }}
                        />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default OEEPanel;
