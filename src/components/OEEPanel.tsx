import React from "react";
import OEEGauge from "./OEEGauge";
import { useOEE } from "../hooks/useOEE";
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

/* ── Trend Chart ────────────────────────────────────── */

const TrendChart: React.FC<{
  data: { timestamp: number; oee: number; availability: number; performance: number; quality: number }[];
}> = ({ data }) => {
  if (data.length < 2) {
    return <div className="h-[160px] flex items-center justify-center text-sky-200/40 text-[11px]">No trend data</div>;
  }

  const W = 500;
  const H = 160;
  const pad = { top: 16, right: 12, bottom: 24, left: 40 };
  const cw = W - pad.left - pad.right;
  const ch = H - pad.top - pad.bottom;

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

  return (
    <div>
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full" style={{ height: H }}>
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

        {/* Lines */}
        {lines.map((line) => (
          <path
            key={line.key}
            d={buildPath(line.values)}
            fill="none"
            stroke={line.color}
            strokeWidth="1.5"
            strokeLinecap="round"
            opacity="0.8"
          />
        ))}
      </svg>

      {/* Legend */}
      <div className="flex items-center justify-center gap-4 mt-1">
        {lines.map((line) => (
          <div key={line.key} className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full" style={{ backgroundColor: line.color }} />
            <span className="text-[9px] text-sky-200/60 font-medium">{line.key}</span>
          </div>
        ))}
      </div>
    </div>
  );
};

/* ── Stat Card ──────────────────────────────────────── */

const StatCard: React.FC<{ label: string; value: string | number; unit?: string; color?: string }> = ({
  label, value, unit, color = "text-cyan-50",
}) => (
  <div className="flex-1 bg-white/[0.02] border border-cyan-300/[0.06] rounded-xl px-3 py-2.5">
    <div className="text-[9px] text-sky-200/50 uppercase tracking-[0.12em] font-semibold">{label}</div>
    <div className={`text-[18px] font-semibold mt-1 leading-none ${color}`}>
      {value}
      {unit && <span className="text-[11px] text-sky-200/50 ml-1">{unit}</span>}
    </div>
  </div>
);

/* ── Main Panel ─────────────────────────────────────── */

const OEEPanel: React.FC<OEEPanelProps> = ({ open, onClose }) => {
  const { oee, trend, loading, trendTimeRange, setTrendTimeRange } = useOEE();

  if (!open) return null;

  const formatTime = (sec: number) => {
    const h = Math.floor(sec / 3600);
    const m = Math.floor((sec % 3600) / 60);
    return h > 0 ? `${h}h ${m}m` : `${m}m`;
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />

      <div className="relative w-[90vw] max-w-[900px] max-h-[85vh] bg-[#0a1628]/95 backdrop-blur-2xl border border-cyan-300/12 rounded-2xl shadow-[0_20px_80px_rgba(0,0,0,0.8)] flex flex-col overflow-hidden">
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
            className="w-8 h-8 rounded-lg bg-white/[0.04] border border-cyan-300/[0.08] flex items-center justify-center text-sky-200/60 hover:text-white hover:bg-white/[0.08] transition-all"
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
              <div className="flex items-center justify-center gap-8">
                <OEEGauge value={oee?.oee.value ?? 0} size={140} label="OEE" />
                <div className="h-16 w-px bg-gradient-to-b from-transparent via-cyan-300/15 to-transparent" />
                <OEEGauge value={oee?.availability.value ?? 0} size={90} label="Availability" />
                <OEEGauge value={oee?.performance.value ?? 0} size={90} label="Performance" />
                <OEEGauge value={oee?.quality.value ?? 0} size={90} label="Quality" />
              </div>

              {/* Stats Row */}
              <div className="flex gap-3">
                <StatCard label="Total Cycles" value={oee?.totalCycles ?? 0} />
                <StatCard label="Good Parts" value={oee?.goodCycles ?? 0} color="text-emerald-300" />
                <StatCard label="Rejects" value={oee?.rejectCycles ?? 0} color="text-red-300" />
                <StatCard label="Run Time" value={formatTime(oee?.runTimeSec ?? 0)} />
                <StatCard label="Shift" value={oee?.shiftId ?? "—"} />
              </div>

              {/* Trend Chart */}
              <div className="bg-white/[0.02] border border-cyan-300/[0.06] rounded-xl p-4">
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
                <TrendChart data={trend} />
              </div>

              {/* Pillar Breakdown */}
              <div className="grid grid-cols-3 gap-3">
                {[
                  { label: "Availability", value: oee?.availability, color: "#3b82f6", desc: "Run Time / Planned Time" },
                  { label: "Performance", value: oee?.performance, color: "#f59e0b", desc: "Actual Output / Ideal Output" },
                  { label: "Quality", value: oee?.quality, color: "#8b5cf6", desc: "Good Parts / Total Parts" },
                ].map((pillar) => (
                  <div key={pillar.label} className="bg-white/[0.02] border border-cyan-300/[0.06] rounded-xl p-4">
                    <div className="flex items-center gap-2 mb-2">
                      <span className="w-2 h-2 rounded-full" style={{ backgroundColor: pillar.color }} />
                      <span className="text-[11px] text-sky-200/70 font-semibold uppercase tracking-[0.1em]">{pillar.label}</span>
                    </div>
                    <div className="text-[28px] font-semibold text-cyan-50 leading-none">
                      {pillar.value?.percentage ?? "—"}
                    </div>
                    <div className="text-[9px] text-sky-200/40 mt-2">{pillar.desc}</div>
                    {/* Bar */}
                    <div className="mt-3 h-1.5 bg-white/[0.04] rounded-full overflow-hidden">
                      <div
                        className="h-full rounded-full transition-all duration-700"
                        style={{
                          width: `${(pillar.value?.value ?? 0) * 100}%`,
                          backgroundColor: pillar.color,
                          boxShadow: `0 0 8px ${pillar.color}40`,
                        }}
                      />
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
