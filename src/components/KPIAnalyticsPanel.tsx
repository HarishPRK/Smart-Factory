import React, { useState, useMemo } from "react";
import { useFilters } from "../context/FilterContext";
import { kpis } from "../data/mockData";
import type { KpiId, ZoneId, TimeRange } from "../types";

/* ── Mock history generator ──────────────────────────── */

const TIME_CONFIGS: Record<TimeRange, { points: number; label: string; tickFormat: (i: number, total: number) => string }> = {
  "1h": { points: 12, label: "Last 1 Hour", tickFormat: (i, t) => `${Math.round((i / (t - 1)) * 60)}m` },
  "6h": { points: 18, label: "Last 6 Hours", tickFormat: (i, t) => `${Math.round((i / (t - 1)) * 6)}h` },
  "24h": { points: 24, label: "Last 24 Hours", tickFormat: (i, t) => `${Math.round((i / (t - 1)) * 24)}h` },
  "7d": { points: 14, label: "Last 7 Days", tickFormat: (i, t) => `D${Math.round((i / (t - 1)) * 7) + 1}` },
};

function generateHistory(baseData: number[], points: number, seed: number): number[] {
  const result: number[] = [];
  const base = baseData.length > 0 ? baseData : [50, 55, 45, 60, 50];
  for (let i = 0; i < points; i++) {
    const idx = (i / (points - 1)) * (base.length - 1);
    const lo = Math.floor(idx);
    const hi = Math.min(lo + 1, base.length - 1);
    const frac = idx - lo;
    const val = base[lo] * (1 - frac) + base[hi] * frac;
    const noise = Math.sin(seed * 13.7 + i * 2.1) * 8 + Math.cos(seed * 7.3 + i * 1.3) * 5;
    result.push(Math.round((val + noise) * 10) / 10);
  }
  return result;
}

function detectAnomalies(data: number[]): number[] {
  if (data.length < 3) return [];
  const mean = data.reduce((s, v) => s + v, 0) / data.length;
  const std = Math.sqrt(data.reduce((s, v) => s + (v - mean) ** 2, 0) / data.length);
  const threshold = std * 1.8;
  return data.reduce<number[]>((acc, v, i) => {
    if (Math.abs(v - mean) > threshold) acc.push(i);
    return acc;
  }, []);
}

/* ── SVG Area Chart ──────────────────────────────────── */

interface ChartProps {
  data: number[];
  zoneData?: Record<string, number[]>;
  color: string;
  anomalies?: number[];
  timeRange: TimeRange;
  showZones?: boolean;
  height?: number;
}

const ZONE_COLORS: Record<number, string> = { 1: "#3b82f6", 2: "#06b6d4", 3: "#8b5cf6" };

const AreaChart: React.FC<ChartProps> = ({
  data, zoneData, color, anomalies = [], timeRange, showZones = false, height = 160,
}) => {
  const W = 500;
  const H = height;
  const pad = { top: 16, right: 12, bottom: 28, left: 40 };
  const cw = W - pad.left - pad.right;
  const ch = H - pad.top - pad.bottom;

  const allValues = showZones && zoneData
    ? Object.values(zoneData).flat()
    : data;
  const min = Math.min(...allValues) * 0.92;
  const max = Math.max(...allValues) * 1.08;
  const range = max - min || 1;

  const toX = (i: number, len: number) => pad.left + (i / (len - 1)) * cw;
  const toY = (v: number) => pad.top + ch - ((v - min) / range) * ch;

  const buildPath = (d: number[]) => {
    const pts = d.map((v, i) => ({ x: toX(i, d.length), y: toY(v) }));
    let path = `M${pts[0].x},${pts[0].y}`;
    for (let i = 1; i < pts.length; i++) {
      const p = pts[i - 1], c = pts[i];
      path += ` C${p.x + (c.x - p.x) * 0.4},${p.y} ${p.x + (c.x - p.x) * 0.6},${c.y} ${c.x},${c.y}`;
    }
    return { path, pts };
  };

  const tcfg = TIME_CONFIGS[timeRange];
  const numTicks = Math.min(6, data.length);

  const datasets = showZones && zoneData
    ? Object.entries(zoneData).map(([z, d]) => ({ zone: Number(z), ...buildPath(d), data: d, color: ZONE_COLORS[Number(z)] }))
    : [{ zone: 0, ...buildPath(data), data, color }];

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full" style={{ height }}>
      <defs>
        {datasets.map((ds) => (
          <linearGradient key={`fill-${ds.zone}`} id={`chart-fill-${ds.zone}-${color.replace("#", "")}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={ds.color} stopOpacity="0.25" />
            <stop offset="100%" stopColor={ds.color} stopOpacity="0" />
          </linearGradient>
        ))}
      </defs>

      {/* Grid lines */}
      {[0, 0.25, 0.5, 0.75, 1].map((frac) => {
        const y = pad.top + ch * (1 - frac);
        const val = min + range * frac;
        return (
          <g key={frac}>
            <line x1={pad.left} y1={y} x2={W - pad.right} y2={y} stroke="rgba(100,160,220,0.08)" strokeWidth="1" />
            <text x={pad.left - 6} y={y + 3} textAnchor="end" fill="rgba(140,180,220,0.5)" fontSize="9" fontFamily="Inter">
              {val >= 100 ? Math.round(val) : val.toFixed(1)}
            </text>
          </g>
        );
      })}

      {/* X-axis labels */}
      {Array.from({ length: numTicks }, (_, i) => {
        const idx = Math.round((i / (numTicks - 1)) * (data.length - 1));
        return (
          <text key={i} x={toX(idx, data.length)} y={H - 4} textAnchor="middle" fill="rgba(140,180,220,0.5)" fontSize="9" fontFamily="Inter">
            {tcfg.tickFormat(idx, data.length)}
          </text>
        );
      })}

      {/* Area fills + lines */}
      {datasets.map((ds) => (
        <g key={ds.zone}>
          <path
            d={`${ds.path} L${ds.pts[ds.pts.length - 1].x},${pad.top + ch} L${ds.pts[0].x},${pad.top + ch} Z`}
            fill={`url(#chart-fill-${ds.zone}-${color.replace("#", "")})`}
          />
          <path d={ds.path} fill="none" stroke={ds.color} strokeWidth="2" strokeLinecap="round" />
          {/* End dot */}
          <circle cx={ds.pts[ds.pts.length - 1].x} cy={ds.pts[ds.pts.length - 1].y} r="3" fill={ds.color} />
        </g>
      ))}

      {/* Anomaly markers */}
      {!showZones && anomalies.map((idx) => {
        const x = toX(idx, data.length);
        const y = toY(data[idx]);
        return (
          <g key={`anom-${idx}`}>
            <circle cx={x} cy={y} r="6" fill="rgba(239,68,68,0.15)" stroke="#ef4444" strokeWidth="1.5" />
            <circle cx={x} cy={y} r="2.5" fill="#ef4444" />
            <line x1={x} y1={y + 8} x2={x} y2={pad.top + ch} stroke="#ef4444" strokeWidth="1" strokeDasharray="3 3" opacity="0.3" />
          </g>
        );
      })}
    </svg>
  );
};

/* ── Sustainability Mini Cards ───────────────────────── */

const sustainabilityMetrics = [
  { label: "Carbon Footprint", value: "12.4", unit: "tCO2e", trend: "-3.2%", positive: true, color: "#10b981" },
  { label: "Energy Efficiency", value: "87.2", unit: "%", trend: "+1.8%", positive: true, color: "#3b82f6" },
  { label: "Water Recycled", value: "64.5", unit: "%", trend: "+5.1%", positive: true, color: "#06b6d4" },
  { label: "Waste Diverted", value: "78.3", unit: "%", trend: "-0.4%", positive: false, color: "#f59e0b" },
];

/* ── Main Panel ──────────────────────────────────────── */

interface KPIAnalyticsPanelProps {
  open: boolean;
  onClose: () => void;
}

const KPIAnalyticsPanel: React.FC<KPIAnalyticsPanelProps> = ({ open, onClose }) => {
  const { state } = useFilters();
  const [selectedKpi, setSelectedKpi] = useState<KpiId>("energy");
  const [localTimeRange, setLocalTimeRange] = useState<TimeRange>(state.timeRange);
  const [showZoneComparison, setShowZoneComparison] = useState(false);
  const [activeSection, setActiveSection] = useState<"trends" | "comparison" | "sustainability">("trends");

  const kpi = kpis.find((k) => k.id === selectedKpi)!;
  const tcfg = TIME_CONFIGS[localTimeRange];

  // Generate history data per zone
  const historyData = useMemo(() => {
    const seed = kpis.indexOf(kpi) + 1;
    const pts = tcfg.points;
    return {
      all: generateHistory(kpi.sparkData, pts, seed),
      zones: {
        1: generateHistory(kpi.zoneValues[1].sparkData, pts, seed + 10),
        2: generateHistory(kpi.zoneValues[2].sparkData, pts, seed + 20),
        3: generateHistory(kpi.zoneValues[3].sparkData, pts, seed + 30),
      } as Record<string, number[]>,
    };
  }, [kpi, tcfg.points]);

  const anomalies = useMemo(() => detectAnomalies(historyData.all), [historyData.all]);

  // Zone comparison stats
  const zoneStats = useMemo(() => {
    return ([1, 2, 3] as ZoneId[]).map((z) => {
      const d = historyData.zones[z];
      const avg = d.reduce((s, v) => s + v, 0) / d.length;
      const max = Math.max(...d);
      const min = Math.min(...d);
      return { zone: z, avg: avg.toFixed(1), max: max.toFixed(1), min: min.toFixed(1), data: d };
    });
  }, [historyData.zones]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />

      {/* Panel */}
      <div className="relative w-[90vw] max-w-[1100px] max-h-[85vh] bg-[#060e1f]/95 backdrop-blur-2xl border border-cyan-300/10 rounded-2xl shadow-[0_20px_80px_rgba(0,0,0,0.8)] flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-cyan-300/[0.06]">
          <div>
            <h2 className="text-[15px] font-semibold text-cyan-50 tracking-tight">KPI Analytics</h2>
            <p className="text-[10px] text-sky-200/50 font-medium mt-0.5">
              History, trends, zone comparison, and sustainability metrics
            </p>
          </div>
          <div className="flex items-center gap-3">
            {/* Section Tabs */}
            <div className="flex gap-1 p-1 rounded-xl bg-white/[0.03] border border-cyan-300/[0.06]">
              {(["trends", "comparison", "sustainability"] as const).map((sec) => (
                <button
                  key={sec}
                  onClick={() => setActiveSection(sec)}
                  className={`px-3 py-1.5 rounded-lg text-[10px] font-semibold transition-all duration-200 capitalize ${
                    activeSection === sec
                      ? "bg-cyan-500/[0.12] text-cyan-100"
                      : "text-sky-200/50 hover:text-sky-100/70"
                  }`}
                >
                  {sec}
                </button>
              ))}
            </div>
            <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-white/[0.06] text-cyan-100/50 hover:text-white transition-all">
              <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
                <path d="M4 4l8 8M12 4l-8 8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
              </svg>
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {/* ── KPI Selector + Time Toggle (shared) ── */}
          <div className="flex items-center justify-between mb-5">
            <div className="flex gap-2">
              {kpis.map((k) => (
                <button
                  key={k.id}
                  onClick={() => setSelectedKpi(k.id)}
                  className={`px-3 py-1.5 rounded-lg text-[10px] font-semibold transition-all duration-200 border ${
                    selectedKpi === k.id
                      ? "bg-white/[0.08] border-white/[0.12] text-white"
                      : "border-transparent text-sky-200/50 hover:text-sky-100/70 hover:bg-white/[0.03]"
                  }`}
                >
                  {k.label}
                </button>
              ))}
            </div>
            <div className="flex items-center gap-3">
              {activeSection === "trends" && (
                <button
                  onClick={() => setShowZoneComparison(!showZoneComparison)}
                  className={`px-3 py-1.5 rounded-lg text-[10px] font-semibold border transition-all duration-200 ${
                    showZoneComparison
                      ? "bg-cyan-500/[0.1] border-cyan-500/20 text-cyan-300"
                      : "border-white/[0.06] text-sky-200/50 hover:text-sky-100/70"
                  }`}
                >
                  Zone Overlay
                </button>
              )}
              <div className="flex gap-1 p-0.5 rounded-lg bg-white/[0.03] border border-cyan-300/[0.06]">
                {(["1h", "6h", "24h", "7d"] as TimeRange[]).map((t) => (
                  <button
                    key={t}
                    onClick={() => setLocalTimeRange(t)}
                    className={`px-2.5 py-1 rounded-md text-[9px] font-semibold transition-all duration-200 ${
                      localTimeRange === t
                        ? "bg-blue-500 text-white shadow-[0_2px_8px_rgba(59,130,246,0.3)]"
                        : "text-sky-200/50 hover:text-white"
                    }`}
                  >
                    {t}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* ── TRENDS Section ── */}
          {activeSection === "trends" && (
            <div className="space-y-5">
              {/* Main Chart */}
              <div className="card p-4">
                <div className="flex items-center justify-between mb-3">
                  <div>
                    <h3 className="text-[13px] font-semibold text-cyan-50">
                      {kpi.label} — {tcfg.label}
                    </h3>
                    <p className="text-[10px] text-sky-200/50 mt-0.5">
                      {showZoneComparison ? "All zones overlaid" : "Aggregated across all zones"}
                      {anomalies.length > 0 && !showZoneComparison && (
                        <span className="text-red-400/80 ml-2">
                          {anomalies.length} anomal{anomalies.length === 1 ? "y" : "ies"} detected
                        </span>
                      )}
                    </p>
                  </div>
                  <div className="text-right">
                    <div className="text-[22px] font-semibold gradient-number leading-none">
                      {kpi.value}
                    </div>
                    <div className="text-[10px] text-sky-200/50 mt-0.5">{kpi.unit} current</div>
                  </div>
                </div>
                <AreaChart
                  data={historyData.all}
                  zoneData={showZoneComparison ? historyData.zones : undefined}
                  color={kpi.sparkColor}
                  anomalies={showZoneComparison ? [] : anomalies}
                  timeRange={localTimeRange}
                  showZones={showZoneComparison}
                  height={200}
                />
                {showZoneComparison && (
                  <div className="flex items-center justify-center gap-6 mt-3">
                    {([1, 2, 3] as ZoneId[]).map((z) => (
                      <div key={z} className="flex items-center gap-1.5">
                        <span className="w-3 h-[2px] rounded-full" style={{ backgroundColor: ZONE_COLORS[z] }} />
                        <span className="text-[9px] text-sky-200/60 font-medium">Zone {z}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Stats Row */}
              <div className="grid grid-cols-4 gap-3">
                {[
                  { label: "Average", value: (historyData.all.reduce((s, v) => s + v, 0) / historyData.all.length).toFixed(1), color: kpi.sparkColor },
                  { label: "Peak", value: Math.max(...historyData.all).toFixed(1), color: "#ef4444" },
                  { label: "Minimum", value: Math.min(...historyData.all).toFixed(1), color: "#10b981" },
                  { label: "Anomalies", value: String(anomalies.length), color: anomalies.length > 0 ? "#ef4444" : "#10b981" },
                ].map((stat) => (
                  <div key={stat.label} className="card-inner p-3">
                    <div className="text-[9px] text-sky-200/50 uppercase tracking-[0.12em] font-semibold">{stat.label}</div>
                    <div className="text-[20px] font-semibold mt-1 leading-none" style={{ color: stat.color }}>
                      {stat.value}
                    </div>
                    <div className="text-[9px] text-sky-200/40 mt-0.5">{kpi.unit}</div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ── COMPARISON Section ── */}
          {activeSection === "comparison" && (
            <div className="space-y-5">
              <div className="grid grid-cols-3 gap-4">
                {zoneStats.map((zs) => (
                  <div key={zs.zone} className="card p-4">
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-2">
                        <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: ZONE_COLORS[zs.zone] }} />
                        <h4 className="text-[12px] font-semibold text-cyan-50">Zone {zs.zone}</h4>
                      </div>
                      <span className="text-[9px] text-sky-200/50 font-medium">{tcfg.label}</span>
                    </div>
                    <AreaChart
                      data={zs.data}
                      color={ZONE_COLORS[zs.zone]}
                      anomalies={detectAnomalies(zs.data)}
                      timeRange={localTimeRange}
                      height={120}
                    />
                    <div className="grid grid-cols-3 gap-2 mt-3">
                      {[
                        { label: "Avg", value: zs.avg },
                        { label: "Peak", value: zs.max },
                        { label: "Min", value: zs.min },
                      ].map((s) => (
                        <div key={s.label} className="text-center">
                          <div className="text-[9px] text-sky-200/45 uppercase tracking-[0.1em] font-medium">{s.label}</div>
                          <div className="text-[14px] font-semibold text-cyan-100 mt-0.5">{s.value}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>

              {/* Zone Ranking */}
              <div className="card p-4">
                <h4 className="text-[12px] font-semibold text-cyan-50 mb-3">Zone Ranking — {kpi.label}</h4>
                <div className="space-y-2">
                  {zoneStats
                    .sort((a, b) => Number(b.avg) - Number(a.avg))
                    .map((zs, i) => {
                      const maxAvg = Math.max(...zoneStats.map((z) => Number(z.avg)));
                      const pct = (Number(zs.avg) / maxAvg) * 100;
                      return (
                        <div key={zs.zone} className="flex items-center gap-3">
                          <span className="text-[10px] text-sky-200/60 font-semibold w-4">#{i + 1}</span>
                          <span className="text-[11px] text-cyan-100 font-medium w-16">Zone {zs.zone}</span>
                          <div className="flex-1 h-2 rounded-full bg-white/[0.04] overflow-hidden">
                            <div
                              className="h-full rounded-full transition-all duration-700"
                              style={{ width: `${pct}%`, backgroundColor: ZONE_COLORS[zs.zone], boxShadow: `0 0 8px ${ZONE_COLORS[zs.zone]}40` }}
                            />
                          </div>
                          <span className="text-[11px] font-semibold text-cyan-100 w-14 text-right">
                            {zs.avg} <span className="text-[9px] text-sky-200/40">{kpi.unit}</span>
                          </span>
                        </div>
                      );
                    })}
                </div>
              </div>
            </div>
          )}

          {/* ── SUSTAINABILITY Section ── */}
          {activeSection === "sustainability" && (
            <div className="space-y-5">
              <div className="grid grid-cols-4 gap-3">
                {sustainabilityMetrics.map((m) => (
                  <div key={m.label} className="card p-4 flex flex-col justify-between">
                    <div className="text-[9px] text-sky-200/50 uppercase tracking-[0.12em] font-semibold">{m.label}</div>
                    <div className="my-3">
                      <span className="text-[28px] font-semibold leading-none" style={{ color: m.color }}>{m.value}</span>
                      <span className="text-[11px] text-sky-200/50 ml-1">{m.unit}</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <svg width="8" height="8" viewBox="0 0 8 8" fill="currentColor" className={m.positive ? "text-emerald-400" : "text-red-400 rotate-180"}>
                        <path d="M4 1L7 5H1L4 1Z" />
                      </svg>
                      <span className={`text-[10px] font-semibold ${m.positive ? "text-emerald-400" : "text-red-400"}`}>{m.trend}</span>
                      <span className="text-[9px] text-sky-200/40 ml-1">vs last period</span>
                    </div>
                  </div>
                ))}
              </div>

              {/* Sustainability Trend Chart */}
              <div className="card p-4">
                <h4 className="text-[12px] font-semibold text-cyan-50 mb-1">Emission Trend — {tcfg.label}</h4>
                <p className="text-[10px] text-sky-200/45 mb-3">PPM levels across all zones with anomaly detection</p>
                {(() => {
                  const emissionKpi = kpis.find((k) => k.id === "emission")!;
                  const emData = generateHistory(emissionKpi.sparkData, tcfg.points, 42);
                  return (
                    <AreaChart
                      data={emData}
                      color="#f59e0b"
                      anomalies={detectAnomalies(emData)}
                      timeRange={localTimeRange}
                      height={180}
                    />
                  );
                })()}
              </div>

              {/* ESG Score */}
              <div className="card p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h4 className="text-[12px] font-semibold text-cyan-50">Sustainability Score</h4>
                    <p className="text-[10px] text-sky-200/45 mt-0.5">Composite ESG performance index</p>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="text-[36px] font-bold text-emerald-400 leading-none">82</div>
                    <div className="text-[10px] text-sky-200/50">
                      <div>/100</div>
                      <div className="text-emerald-400 font-semibold">Good</div>
                    </div>
                  </div>
                </div>
                <div className="mt-4 grid grid-cols-3 gap-3">
                  {[
                    { label: "Environmental", score: 85, color: "#10b981" },
                    { label: "Efficiency", score: 87, color: "#3b82f6" },
                    { label: "Waste Mgmt", score: 74, color: "#f59e0b" },
                  ].map((item) => (
                    <div key={item.label}>
                      <div className="flex justify-between items-center mb-1.5">
                        <span className="text-[9px] text-sky-200/55 font-medium">{item.label}</span>
                        <span className="text-[10px] font-semibold" style={{ color: item.color }}>{item.score}</span>
                      </div>
                      <div className="h-1.5 rounded-full bg-white/[0.04] overflow-hidden">
                        <div
                          className="h-full rounded-full transition-all duration-700"
                          style={{ width: `${item.score}%`, backgroundColor: item.color, boxShadow: `0 0 6px ${item.color}40` }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default KPIAnalyticsPanel;
