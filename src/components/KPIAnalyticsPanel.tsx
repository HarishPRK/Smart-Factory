import React, { useState, useMemo, useEffect } from "react";
import { usePLCContext, useMqttBufferContext } from "../context/PLCContext";
import type { TimeRange } from "../types";
import {
  isSiteWiseConfigured,
  fetchHistory as swFetchHistory,
  fetchMetrics as swFetchMetrics,
  type SiteWiseProperty,
  type MetricsResult,
} from "../services/siteWiseService";

/* ── PLC Parameter Definitions ───────────────────────── */

interface PLCParam {
  id: SiteWiseProperty;
  label: string;
  unit: string;
  color: string;
  min: number;
  max: number;
  nominal: number;
  kind: "analog" | "digital";
}

const ANALOG_PARAMS: PLCParam[] = [
  { id: "voltage", label: "Voltage", unit: "V", color: "#f59e0b", min: 0, max: 12, nominal: 5.0, kind: "analog" },
  { id: "current", label: "Current", unit: "A", color: "#06b6d4", min: 0, max: 10, nominal: 6.0, kind: "analog" },
  { id: "pH", label: "pH", unit: "pH", color: "#8b5cf6", min: 0, max: 14, nominal: 7.0, kind: "analog" },
  { id: "temperature", label: "Temperature", unit: "°C", color: "#ef4444", min: 0, max: 100, nominal: 25.0, kind: "analog" },
];

const DIGITAL_PARAMS: PLCParam[] = [
  { id: "photoE_sensor", label: "Photo-E Sensor", unit: "", color: "#10b981", min: 0, max: 1, nominal: 0, kind: "digital" },
  { id: "metal_sensor", label: "Metal Detector", unit: "", color: "#3b82f6", min: 0, max: 1, nominal: 0, kind: "digital" },
  { id: "motor", label: "Motor Fan", unit: "", color: "#06b6d4", min: 0, max: 1, nominal: 0, kind: "digital" },
  { id: "push_button", label: "Push Button", unit: "", color: "#f59e0b", min: 0, max: 1, nominal: 0, kind: "digital" },
];

const ALERT_PARAMS: PLCParam[] = [
  { id: "alert_0", label: "Alert Ch-0", unit: "", color: "#ef4444", min: 0, max: 1, nominal: 0, kind: "digital" },
  { id: "alert_1", label: "Alert Ch-1", unit: "", color: "#f97316", min: 0, max: 1, nominal: 0, kind: "digital" },
  { id: "alert_2", label: "Alert Ch-2", unit: "", color: "#eab308", min: 0, max: 1, nominal: 0, kind: "digital" },
  { id: "alert_3", label: "Alert Ch-3 (Emergency)", unit: "", color: "#ec4899", min: 0, max: 1, nominal: 0, kind: "digital" },
];

const ALL_PARAMS = [...ANALOG_PARAMS, ...DIGITAL_PARAMS];

/* ── Time config ─────────────────────────────────────── */

type AnalyticsTimeRange = TimeRange | "1m" | "5m" | "30m";

const TIME_CONFIGS: Record<AnalyticsTimeRange, { points: number; label: string; ms: number; tickFormat: (i: number, total: number) => string }> = {
  "1m": { points: 60, ms: 60_000, label: "Last 1 Minute", tickFormat: (i, t) => `${Math.round((i / (t - 1)) * 60)}s` },
  "5m": { points: 100, ms: 300_000, label: "Last 5 Minutes", tickFormat: (i, t) => `${Math.round((i / (t - 1)) * 5)}m` },
  "30m": { points: 100, ms: 1_800_000, label: "Last 30 Minutes", tickFormat: (i, t) => `${Math.round((i / (t - 1)) * 30)}m` },
  "1h": { points: 100, ms: 3_600_000, label: "Last 1 Hour", tickFormat: (i, t) => `${Math.round((i / (t - 1)) * 60)}m` },
  "6h": { points: 200, ms: 21_600_000, label: "Last 6 Hours", tickFormat: (i, t) => `${Math.round((i / (t - 1)) * 6)}h` },
  "24h": { points: 300, ms: 86_400_000, label: "Last 24 Hours", tickFormat: (i, t) => `${Math.round((i / (t - 1)) * 24)}h` },
  "7d": { points: 500, ms: 604_800_000, label: "Last 7 Days", tickFormat: (i, t) => `D${Math.round((i / (t - 1)) * 7) + 1}` },
};

const ALL_TIME_RANGES: AnalyticsTimeRange[] = ["1m", "5m", "30m", "1h", "6h", "24h", "7d"];

/* ── Mock data generator ─────────────────────────────── */

function generateMockHistory(param: PLCParam, points: number, seed: number): number[] {
  const result: number[] = [];
  for (let i = 0; i < points; i++) {
    const noise = Math.sin(seed * 13.7 + i * 2.1) * (param.max - param.min) * 0.08
      + Math.cos(seed * 7.3 + i * 1.3) * (param.max - param.min) * 0.05;
    const drift = Math.sin(i / points * Math.PI) * (param.max - param.min) * 0.1;
    let val = param.nominal + noise + drift;
    val = Math.max(param.min, Math.min(param.max, val));
    result.push(Math.round(val * 100) / 100);
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
  color: string;
  anomalies?: number[];
  timeRange: AnalyticsTimeRange;
  height?: number;
  unit?: string;
  nominal?: number;
}

const AreaChart: React.FC<ChartProps> = ({
  data, color, anomalies = [], timeRange, height = 160, unit, nominal,
}) => {
  const W = 500;
  const H = height;
  const pad = { top: 16, right: 12, bottom: 28, left: 44 };
  const cw = W - pad.left - pad.right;
  const ch = H - pad.top - pad.bottom;

  const min = Math.min(...data) * 0.92;
  const max = Math.max(...data) * 1.08;
  const range = max - min || 1;

  const toX = (i: number) => pad.left + (i / (data.length - 1)) * cw;
  const toY = (v: number) => pad.top + ch - ((v - min) / range) * ch;

  const pts = data.map((v, i) => ({ x: toX(i), y: toY(v) }));
  let path = `M${pts[0].x},${pts[0].y}`;
  for (let i = 1; i < pts.length; i++) {
    const p = pts[i - 1], c = pts[i];
    path += ` C${p.x + (c.x - p.x) * 0.4},${p.y} ${p.x + (c.x - p.x) * 0.6},${c.y} ${c.x},${c.y}`;
  }

  const tcfg = TIME_CONFIGS[timeRange];
  const numTicks = Math.min(6, data.length);

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full" style={{ height }}>
      <defs>
        <linearGradient id={`chart-fill-${color.replace("#", "")}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.25" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>

      {/* Grid lines */}
      {[0, 0.25, 0.5, 0.75, 1].map((frac) => {
        const y = pad.top + ch * (1 - frac);
        const val = min + range * frac;
        return (
          <g key={frac}>
            <line x1={pad.left} y1={y} x2={W - pad.right} y2={y} stroke="rgba(100,160,220,0.08)" strokeWidth="1" />
            <text x={pad.left - 6} y={y + 3} textAnchor="end" fill="rgba(140,180,220,0.55)" fontSize="9" fontFamily="Inter">
              {val >= 100 ? Math.round(val) : val.toFixed(1)}{unit ? ` ${unit}` : ""}
            </text>
          </g>
        );
      })}

      {/* Nominal line */}
      {nominal !== undefined && nominal >= min && nominal <= max && (
        <g>
          <line
            x1={pad.left} y1={toY(nominal)} x2={W - pad.right} y2={toY(nominal)}
            stroke={color} strokeWidth="1" strokeDasharray="6 4" opacity="0.4"
            style={{ transition: "y1 0.8s ease, y2 0.8s ease" }}
          />
          <text x={W - pad.right + 4} y={toY(nominal) + 3} fill={color} fontSize="8" fontFamily="Inter" opacity="0.6">
            nom
          </text>
        </g>
      )}

      {/* X-axis labels */}
      {Array.from({ length: numTicks }, (_, i) => {
        const idx = Math.round((i / (numTicks - 1)) * (data.length - 1));
        return (
          <text key={i} x={toX(idx)} y={H - 4} textAnchor="middle" fill="rgba(140,180,220,0.55)" fontSize="9" fontFamily="Inter">
            {tcfg.tickFormat(idx, data.length)}
          </text>
        );
      })}

      {/* Area fill + line — smooth transitions on data update */}
      <path
        d={`${path} L${pts[pts.length - 1].x},${pad.top + ch} L${pts[0].x},${pad.top + ch} Z`}
        fill={`url(#chart-fill-${color.replace("#", "")})`}
        style={{ transition: "d 0.8s cubic-bezier(0.4, 0, 0.2, 1)" }}
      />
      <path
        d={path} fill="none" stroke={color} strokeWidth="2" strokeLinecap="round"
        style={{ transition: "d 0.8s cubic-bezier(0.4, 0, 0.2, 1)" }}
      />
      <circle
        cx={pts[pts.length - 1].x} cy={pts[pts.length - 1].y} r="3" fill={color}
        style={{ transition: "cx 0.8s cubic-bezier(0.4, 0, 0.2, 1), cy 0.8s cubic-bezier(0.4, 0, 0.2, 1)" }}
      />

      {/* Anomaly markers */}
      {anomalies.map((idx) => {
        const x = toX(idx);
        const y = toY(data[idx]);
        return (
          <g key={`anom-${idx}`} style={{ transition: "transform 0.8s ease" }}>
            <circle cx={x} cy={y} r="6" fill="rgba(239,68,68,0.15)" stroke="#ef4444" strokeWidth="1.5" style={{ transition: "cx 0.8s ease, cy 0.8s ease" }} />
            <circle cx={x} cy={y} r="2.5" fill="#ef4444" style={{ transition: "cx 0.8s ease, cy 0.8s ease" }} />
            <line x1={x} y1={y + 8} x2={x} y2={pad.top + ch} stroke="#ef4444" strokeWidth="1" strokeDasharray="3 3" opacity="0.3" style={{ transition: "x1 0.8s ease, y1 0.8s ease" }} />
          </g>
        );
      })}
    </svg>
  );
};

/* ── Data source types ────────────────────────────────── */

type DataSource = "mqtt" | "sitewise" | "mock";

interface HistoryResult {
  data: number[];
  loading: boolean;
  source: DataSource;
  lastUpdated: Date | null;
}

// Short ranges use MQTT buffer, long ranges use SiteWise
const MQTT_RANGES: AnalyticsTimeRange[] = ["1m", "5m"];
const REFRESH_INTERVALS: Partial<Record<AnalyticsTimeRange, number>> = {
  "1m": 1000,
  "5m": 1000,
  "30m": 5000,
  "1h": 5000,
  "6h": 30000,
  "24h": 60000,
  "7d": 60000,
};

/* ── Unified data hook: MQTT buffer → SiteWise → Mock ── */

function usePLCHistory(
  param: PLCParam,
  timeRange: AnalyticsTimeRange,
  _pointCount: number
): HistoryResult {
  const buffer = useMqttBufferContext();
  const useMqtt = MQTT_RANGES.includes(timeRange);
  const refreshMs = REFRESH_INTERVALS[timeRange] ?? 5000;

  // ── MQTT buffer state (for short ranges) ──
  const [mqttData, setMqttData] = useState<number[]>([]);
  const [mqttUpdated, setMqttUpdated] = useState<Date | null>(null);

  useEffect(() => {
    if (!useMqtt) return;

    const poll = () => {
      const points = buffer.getHistory(param.id, TIME_CONFIGS[timeRange].ms);
      if (points.length > 0) {
        setMqttData(points.map((p) => p.value));
        setMqttUpdated(new Date());
      }
    };

    poll();
    const interval = setInterval(poll, refreshMs);
    return () => clearInterval(interval);
  }, [buffer, param.id, timeRange, useMqtt, refreshMs]);

  // ── SiteWise state (for long ranges) ──
  const [swResult, setSwResult] = useState<{ data: number[]; lastUpdated: Date } | null>(null);
  const [loading, setLoading] = useState(false);
  const paramId = param.id;

  // Clear stale SiteWise data on param/range change
  useEffect(() => {
    setSwResult(null);
  }, [paramId, timeRange]);

  useEffect(() => {
    if (useMqtt) return; // Don't fetch SiteWise for short ranges
    if (!isSiteWiseConfigured()) return;

    let cancelled = false;

    const fetchData = async () => {
      setLoading(true);
      try {
        const end = new Date();
        const start = new Date(end.getTime() - TIME_CONFIGS[timeRange].ms);
        const points = await swFetchHistory(paramId as SiteWiseProperty, start, end, _pointCount);

        if (!cancelled && points.length > 0) {
          setSwResult({ data: points.map((p) => p.value), lastUpdated: new Date() });
        }
      } catch (err) {
        console.error("[SiteWise] Fetch failed:", err);
        if (!cancelled) setSwResult(null);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    fetchData();
    const interval = setInterval(fetchData, refreshMs);
    return () => { cancelled = true; clearInterval(interval); };
  }, [paramId, timeRange, _pointCount, useMqtt, refreshMs]);

  // ── Mock fallback ──
  const mockData = useMemo(
    () => generateMockHistory(param, _pointCount, ANALOG_PARAMS.indexOf(param) + 1),
    [param, _pointCount]
  );

  // Hybrid: for 30m, merge SiteWise bulk + MQTT buffer tail
  const hybridData = useMemo(() => {
    if (timeRange !== "30m" || !swResult || swResult.data.length === 0) return null;
    // Get last 5 min from MQTT buffer to fill the ingestion gap at the right edge
    const tail = buffer.getHistory(param.id, 300_000); // 5 min
    if (tail.length === 0) return null;
    const tailValues = tail.map((p) => p.value);
    // Append tail, remove duplicates at overlap (keep SiteWise for bulk, MQTT for edge)
    return [...swResult.data, ...tailValues];
  }, [swResult, buffer, param.id, timeRange]);

  // Priority: MQTT buffer → Hybrid 30m → SiteWise → Mock
  if (useMqtt && mqttData.length > 0) {
    return { data: mqttData, loading: false, source: "mqtt", lastUpdated: mqttUpdated };
  }
  if (hybridData && hybridData.length > 0) {
    return { data: hybridData, loading, source: "sitewise", lastUpdated: swResult?.lastUpdated ?? null };
  }
  if (!useMqtt && swResult && swResult.data.length > 0) {
    return { data: swResult.data, loading, source: "sitewise", lastUpdated: swResult.lastUpdated };
  }
  return { data: mockData, loading, source: "mock", lastUpdated: null };
}

/* ── CSV Export ───────────────────────────────────────── */

function exportCSV(filename: string, headers: string[], rows: (string | number)[][]) {
  const csvContent = [
    headers.join(","),
    ...rows.map((row) => row.map((cell) => `"${cell}"`).join(",")),
  ].join("\n");

  const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

/* ── Sub-components using live data hooks ────────────── */

const SensorCard: React.FC<{
  param: PLCParam;
  timeRange: AnalyticsTimeRange;
  selected: boolean;
  onClick: () => void;
}> = ({ param, timeRange, selected, onClick }) => {
  const tcfg = TIME_CONFIGS[timeRange];
  const history = usePLCHistory(param, timeRange, tcfg.points);
  const anoms = detectAnomalies(history.data);
  const avg = history.data.length > 0 ? history.data.reduce((s, v) => s + v, 0) / history.data.length : 0;
  const latest = history.data[history.data.length - 1] ?? 0;

  return (
    <div
      className={`card p-4 cursor-pointer transition-all duration-200 hover:border-white/[0.15] ${
        selected ? "ring-1 ring-white/10" : ""
      }`}
      onClick={onClick}
    >
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: param.color }} />
          <h4 className="text-[13px] font-semibold text-cyan-50">{param.label}</h4>
          <span className={`px-1 py-0.5 rounded text-[7px] font-bold uppercase ${
            history.source === "mqtt" ? "bg-cyan-500/15 text-cyan-400" :
            history.source === "sitewise" ? "bg-emerald-500/15 text-emerald-400" :
            "bg-amber-500/15 text-amber-400"
          }`}>{history.source === "mqtt" ? "LIVE" : history.source === "sitewise" ? "SW" : "MOCK"}</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-[18px] font-semibold" style={{ color: param.color }}>{latest.toFixed(1)}</span>
          <span className="text-[10px] text-sky-200/50">{param.unit}</span>
        </div>
      </div>
      <AreaChart data={history.data} color={param.color} anomalies={anoms} timeRange={timeRange} height={100} nominal={param.nominal} />
      <div className="flex justify-between mt-2 text-[10px]">
        <span className="text-sky-200/50">Avg: <span className="text-cyan-100 font-medium">{avg.toFixed(1)} {param.unit}</span></span>
        <span className="text-sky-200/50">Nom: <span className="text-cyan-100 font-medium">{param.nominal} {param.unit}</span></span>
        {anoms.length > 0 && <span className="text-red-400">{anoms.length} anomal{anoms.length === 1 ? "y" : "ies"}</span>}
      </div>
    </div>
  );
};

const DigitalChannel: React.FC<{ param: PLCParam; timeRange: AnalyticsTimeRange }> = ({ param, timeRange }) => {
  const tcfg = TIME_CONFIGS[timeRange];
  const history = usePLCHistory(param, timeRange, tcfg.points);
  const digitalData = history.data.map((v) => (v >= 0.5 ? 1 : 0));
  const toggleCount = digitalData.reduce<number>((acc, v, i) => i > 0 && v !== digitalData[i - 1] ? acc + 1 : acc, 0);
  const activePercent = digitalData.length > 0 ? ((digitalData.filter((v) => v === 1).length / digitalData.length) * 100).toFixed(0) : "0";
  const isOn = digitalData[digitalData.length - 1] === 1;

  return (
    <div className="card p-4">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2.5">
          <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: param.color }} />
          <h4 className="text-[13px] font-semibold text-cyan-50">{param.label}</h4>
          <span className={`px-1 py-0.5 rounded text-[7px] font-bold uppercase ${
            history.source === "mqtt" ? "bg-cyan-500/15 text-cyan-400" :
            history.source === "sitewise" ? "bg-emerald-500/15 text-emerald-400" :
            "bg-amber-500/15 text-amber-400"
          }`}>{history.source === "mqtt" ? "LIVE" : history.source === "sitewise" ? "SW" : "MOCK"}</span>
        </div>
        <div className="flex items-center gap-4">
          <div className="text-center">
            <div className="text-[9px] text-sky-200/45 uppercase">Toggles</div>
            <div className="text-[16px] font-semibold text-cyan-100">{toggleCount}</div>
          </div>
          <div className="text-center">
            <div className="text-[9px] text-sky-200/45 uppercase">Active</div>
            <div className="text-[16px] font-semibold" style={{ color: param.color }}>{activePercent}%</div>
          </div>
          <span className={`px-2 py-1 rounded-md text-[10px] font-semibold ${
            isOn ? "bg-emerald-500/15 text-emerald-400 border border-emerald-500/20" : "bg-white/[0.04] text-sky-200/50 border border-white/[0.06]"
          }`}>{isOn ? "ON" : "OFF"}</span>
        </div>
      </div>
      <svg viewBox="0 0 500 60" className="w-full" style={{ height: 60 }}>
        {digitalData.map((v, i) => {
          if (i === 0) return null;
          const x1 = 20 + ((i - 1) / (digitalData.length - 1)) * 460;
          const x2 = 20 + (i / (digitalData.length - 1)) * 460;
          const yPrev = digitalData[i - 1] === 1 ? 12 : 48;
          const y1 = v === 1 ? 12 : 48;
          return (
            <g key={i}>
              <line x1={x1} y1={yPrev} x2={x2} y2={yPrev} stroke={param.color} strokeWidth="2" opacity="0.7" />
              {v !== digitalData[i - 1] && <line x1={x2} y1={yPrev} x2={x2} y2={y1} stroke={param.color} strokeWidth="2" opacity="0.7" />}
            </g>
          );
        })}
        <text x="4" y="16" fill="rgba(140,180,220,0.4)" fontSize="8" fontFamily="Inter">ON</text>
        <text x="2" y="52" fill="rgba(140,180,220,0.4)" fontSize="8" fontFamily="Inter">OFF</text>
      </svg>
    </div>
  );
};

const AlertChannel: React.FC<{ param: PLCParam; timeRange: AnalyticsTimeRange }> = ({ param, timeRange }) => {
  const tcfg = TIME_CONFIGS[timeRange];
  const history = usePLCHistory(param, timeRange, tcfg.points);
  const alertData = history.data.map((v) => (v >= 0.5 ? 1 : 0));
  const activations = alertData.filter((v) => v === 1).length;
  const activePercent = alertData.length > 0 ? ((activations / alertData.length) * 100).toFixed(0) : "0";
  const isActive = alertData[alertData.length - 1] === 1;

  return (
    <div className={`card p-4 border-l-2 ${isActive ? "border-l-red-500" : "border-l-transparent"}`}>
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2.5">
          <div className={`w-8 h-8 rounded-lg flex items-center justify-center border ${
            isActive ? "bg-red-500/15 border-red-500/25 shadow-[0_0_12px_rgba(239,68,68,0.15)]" : "bg-white/[0.03] border-white/[0.06]"
          }`}>
            <svg width="14" height="14" viewBox="0 0 20 20" fill="none">
              <path d="M10 2L1 18h18L10 2z" stroke={isActive ? param.color : "rgba(140,180,220,0.3)"} strokeWidth="1.5" strokeLinejoin="round" />
              <path d="M10 8v4M10 14.5v.5" stroke={isActive ? param.color : "rgba(140,180,220,0.3)"} strokeWidth="1.5" strokeLinecap="round" />
            </svg>
          </div>
          <div>
            <h4 className="text-[13px] font-semibold text-cyan-50">{param.label}</h4>
            <p className="text-[10px] text-sky-200/45 mt-0.5">
              {param.id === "alert_3" ? "Emergency light trigger channel" : `Alert monitoring channel ${param.id.split("_")[1]}`}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-4">
          <div className="text-center">
            <div className="text-[9px] text-sky-200/45 uppercase">Activations</div>
            <div className="text-[16px] font-semibold" style={{ color: activations > 0 ? param.color : "rgba(140,180,220,0.5)" }}>{activations}</div>
          </div>
          <div className="text-center">
            <div className="text-[9px] text-sky-200/45 uppercase">Active</div>
            <div className="text-[16px] font-semibold" style={{ color: param.color }}>{activePercent}%</div>
          </div>
          <span className={`px-2.5 py-1 rounded-md text-[11px] font-semibold ${
            isActive ? "bg-red-500/15 text-red-400 border border-red-500/25" : "bg-white/[0.04] text-sky-200/50 border border-white/[0.06]"
          }`}>{isActive ? "TRIGGERED" : "CLEAR"}</span>
        </div>
      </div>
      <svg viewBox="0 0 500 50" className="w-full" style={{ height: 50 }}>
        {alertData.map((v, i) => {
          if (i === 0) return null;
          const x1 = 20 + ((i - 1) / (alertData.length - 1)) * 460;
          const x2 = 20 + (i / (alertData.length - 1)) * 460;
          const yPrev = alertData[i - 1] === 1 ? 8 : 42;
          const y1 = v === 1 ? 8 : 42;
          return (
            <g key={i}>
              <line x1={x1} y1={yPrev} x2={x2} y2={yPrev} stroke={param.color} strokeWidth="2" opacity={alertData[i - 1] === 1 ? "0.8" : "0.3"} />
              {v !== alertData[i - 1] && <line x1={x2} y1={yPrev} x2={x2} y2={y1} stroke={param.color} strokeWidth="2" opacity="0.6" />}
              {v === 1 && alertData[i - 1] === 0 && <circle cx={x2} cy={8} r="3" fill={param.color} opacity="0.6" />}
            </g>
          );
        })}
        <text x="4" y="12" fill="rgba(239,68,68,0.4)" fontSize="8" fontFamily="Inter">ALERT</text>
        <text x="2" y="46" fill="rgba(140,180,220,0.3)" fontSize="8" fontFamily="Inter">CLEAR</text>
      </svg>
    </div>
  );
};

/* ── SiteWise computed metrics hook ───────────────────── */

function useSiteWiseMetrics(paramId: SiteWiseProperty) {
  const [metrics, setMetrics] = useState<MetricsResult | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!isSiteWiseConfigured()) return;

    let cancelled = false;

    const fetch = async () => {
      setLoading(true);
      try {
        const result = await swFetchMetrics(paramId);
        if (!cancelled) setMetrics(result);
      } catch {
        if (!cancelled) setMetrics(null);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    fetch();
    const interval = setInterval(fetch, 60000); // Refresh every 60s (hourly aggregates)
    return () => { cancelled = true; clearInterval(interval); };
  }, [paramId]);

  return { metrics, loading };
}

const SiteWiseMetricsCard: React.FC<{ param: PLCParam }> = ({ param }) => {
  const { metrics, loading } = useSiteWiseMetrics(param.id);

  if (!isSiteWiseConfigured()) return null;

  const isAnalog = param.kind === "analog";
  const items = isAnalog
    ? [
        { label: "Avg (1h)", value: metrics?.avg_1h?.value, unit: param.unit, color: param.color },
        { label: "Max (1h)", value: metrics?.max_1h?.value, unit: param.unit, color: "#ef4444" },
      ]
    : [
        { label: "Toggles (1h)", value: metrics?.toggle_count_1h?.value, unit: "times", color: param.color },
      ];

  const timestamp = metrics?.avg_1h?.timestamp ?? metrics?.toggle_count_1h?.timestamp;
  const stale = timestamp ? (Date.now() - timestamp) > 7_200_000 : false; // > 2 hours

  return (
    <div className="card p-4">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <svg width="14" height="14" viewBox="0 0 16 16" fill="none" className="text-cyan-300/60">
            <rect x="2" y="2" width="12" height="12" rx="2" stroke="currentColor" strokeWidth="1.2" />
            <path d="M5 10V7M8 10V5M11 10V8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
          </svg>
          <h4 className="text-[13px] font-semibold text-cyan-50">SiteWise Computed Metrics</h4>
        </div>
        <span className={`px-1.5 py-0.5 rounded text-[9px] font-bold uppercase ${
          loading ? "bg-blue-500/15 text-blue-400 border border-blue-500/20" :
          stale ? "bg-amber-500/15 text-amber-400 border border-amber-500/20" :
          "bg-emerald-500/15 text-emerald-400 border border-emerald-500/20"
        }`}>
          {loading ? "Loading..." : stale ? "Stale" : "Server-Computed"}
        </span>
      </div>
      <div className={`grid gap-3 ${isAnalog ? "grid-cols-2" : "grid-cols-1"}`}>
        {items.map((item) => (
          <div key={item.label} className="card-inner p-3.5">
            <div className="text-[10px] text-sky-200/55 uppercase tracking-[0.12em] font-semibold">{item.label}</div>
            <div className="flex items-baseline gap-1.5 mt-1.5">
              <span className="text-[22px] font-semibold leading-none" style={{ color: item.color }}>
                {item.value != null ? (typeof item.value === "number" ? item.value.toFixed(1) : item.value) : "—"}
              </span>
              <span className="text-[10px] text-sky-200/45">{item.unit}</span>
            </div>
          </div>
        ))}
      </div>
      {timestamp && (
        <p className="text-[9px] text-sky-200/35 mt-2">
          Computed at {new Date(timestamp).toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", hour12: true })}
          {stale && " — metric may be outdated"}
        </p>
      )}
    </div>
  );
};

/* ── Shift Comparison ─────────────────────────────────── */

const SHIFTS = [
  { id: "day", label: "Day Shift", hours: [6, 14], color: "#f59e0b" },
  { id: "evening", label: "Evening Shift", hours: [14, 22], color: "#8b5cf6" },
  { id: "night", label: "Night Shift", hours: [22, 6], color: "#3b82f6" },
] as const;

function getShiftBoundaries(shiftId: string, offset = 0) {
  const shift = SHIFTS.find((s) => s.id === shiftId) ?? SHIFTS[0];
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

  const startHour = shift.hours[0];
  const endHour = shift.hours[1];

  const start = new Date(today);
  start.setHours(startHour, 0, 0, 0);
  start.setDate(start.getDate() - offset);

  const end = new Date(today);
  end.setHours(endHour, 0, 0, 0);
  end.setDate(end.getDate() - offset);

  // Night shift crosses midnight
  if (endHour < startHour) {
    end.setDate(end.getDate() + 1);
  }

  return { start, end };
}

const ShiftComparisonSection: React.FC<{ param: PLCParam }> = ({ param }) => {
  const [selectedShift, setSelectedShift] = useState("day");
  const shift = SHIFTS.find((s) => s.id === selectedShift) ?? SHIFTS[0];

  const currentBounds = getShiftBoundaries(selectedShift, 0);
  const prevBounds = getShiftBoundaries(selectedShift, 1);

  // Generate mock shift data (will use SiteWise when data accumulates)
  const currentData = useMemo(() => generateMockHistory(param, 48, 100), [param]);
  const prevData = useMemo(() => generateMockHistory(param, 48, 200), [param]);

  const currentAvg = currentData.reduce((s, v) => s + v, 0) / currentData.length;
  const prevAvg = prevData.reduce((s, v) => s + v, 0) / prevData.length;
  const delta = currentAvg - prevAvg;
  const deltaPct = prevAvg !== 0 ? ((delta / prevAvg) * 100).toFixed(1) : "0.0";
  const improved = param.id === "temperature" ? delta < 0 : Math.abs(currentAvg - param.nominal) < Math.abs(prevAvg - param.nominal);

  return (
    <div className="space-y-5">
      {/* Shift selector */}
      <div className="flex items-center gap-3">
        {SHIFTS.map((s) => (
          <button
            key={s.id}
            onClick={() => setSelectedShift(s.id)}
            className={`px-4 py-2 rounded-lg text-[11px] font-semibold border transition-all duration-200 flex items-center gap-2 ${
              selectedShift === s.id
                ? "bg-white/[0.08] border-white/[0.12] text-white"
                : "border-transparent text-sky-200/50 hover:text-sky-100/70 hover:bg-white/[0.03]"
            }`}
          >
            <span className="w-2 h-2 rounded-full" style={{ backgroundColor: s.color }} />
            {s.label}
            <span className="text-[9px] text-sky-200/40">{s.hours[0]}:00–{s.hours[1]}:00</span>
          </button>
        ))}
      </div>

      {/* Overlaid chart */}
      <div className="card p-5">
        <div className="flex items-center justify-between mb-3">
          <div>
            <h3 className="text-[14px] font-semibold text-cyan-50">{param.label} — {shift.label}</h3>
            <p className="text-[11px] text-sky-200/55 mt-0.5">
              Current shift vs previous shift · {currentBounds.start.toLocaleDateString()} vs {prevBounds.start.toLocaleDateString()}
            </p>
          </div>
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-1.5">
              <span className="w-3 h-[2px] rounded-full" style={{ backgroundColor: shift.color }} />
              <span className="text-[9px] text-sky-200/55">Current</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-3 h-[2px] rounded-full opacity-40" style={{ backgroundColor: shift.color }} />
              <span className="text-[9px] text-sky-200/55">Previous</span>
            </div>
          </div>
        </div>

        {/* Dual chart */}
        <svg viewBox="0 0 500 200" className="w-full" style={{ height: 200 }}>
          <defs>
            <linearGradient id="shift-fill-current" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={shift.color} stopOpacity="0.2" />
              <stop offset="100%" stopColor={shift.color} stopOpacity="0" />
            </linearGradient>
          </defs>
          {(() => {
            const pad = { top: 16, right: 12, bottom: 28, left: 44 };
            const cw = 500 - pad.left - pad.right;
            const ch = 200 - pad.top - pad.bottom;
            const allVals = [...currentData, ...prevData];
            const min = Math.min(...allVals) * 0.92;
            const max = Math.max(...allVals) * 1.08;
            const range = max - min || 1;
            const toX = (i: number) => pad.left + (i / (currentData.length - 1)) * cw;
            const toY = (v: number) => pad.top + ch - ((v - min) / range) * ch;

            const buildPath = (data: number[]) => {
              const pts = data.map((v, i) => ({ x: toX(i), y: toY(v) }));
              let p = `M${pts[0].x},${pts[0].y}`;
              for (let i = 1; i < pts.length; i++) {
                const prev = pts[i - 1], c = pts[i];
                p += ` C${prev.x + (c.x - prev.x) * 0.4},${prev.y} ${prev.x + (c.x - prev.x) * 0.6},${c.y} ${c.x},${c.y}`;
              }
              return { path: p, pts };
            };

            const curr = buildPath(currentData);
            const prev = buildPath(prevData);

            return (
              <>
                {[0, 0.25, 0.5, 0.75, 1].map((frac) => {
                  const y = pad.top + ch * (1 - frac);
                  const val = min + range * frac;
                  return (
                    <g key={frac}>
                      <line x1={pad.left} y1={y} x2={500 - pad.right} y2={y} stroke="rgba(100,160,220,0.08)" strokeWidth="1" />
                      <text x={pad.left - 6} y={y + 3} textAnchor="end" fill="rgba(140,180,220,0.5)" fontSize="9" fontFamily="Inter">
                        {val.toFixed(1)}
                      </text>
                    </g>
                  );
                })}
                {/* Previous shift (dashed, transparent) */}
                <path d={prev.path} fill="none" stroke={shift.color} strokeWidth="1.5" strokeDasharray="6 4" opacity="0.35" />
                {/* Current shift (solid, with fill) */}
                <path
                  d={`${curr.path} L${curr.pts[curr.pts.length - 1].x},${pad.top + ch} L${curr.pts[0].x},${pad.top + ch} Z`}
                  fill="url(#shift-fill-current)"
                />
                <path d={curr.path} fill="none" stroke={shift.color} strokeWidth="2" strokeLinecap="round" />
              </>
            );
          })()}
        </svg>
      </div>

      {/* Comparison stats */}
      <div className="grid grid-cols-4 gap-3">
        {[
          { label: "Current Avg", value: currentAvg.toFixed(1), color: shift.color },
          { label: "Previous Avg", value: prevAvg.toFixed(1), color: `${shift.color}80` },
          { label: "Delta", value: `${delta > 0 ? "+" : ""}${delta.toFixed(2)}`, color: improved ? "#10b981" : "#ef4444" },
          { label: "Change", value: `${Number(deltaPct) > 0 ? "+" : ""}${deltaPct}%`, color: improved ? "#10b981" : "#ef4444" },
        ].map((s) => (
          <div key={s.label} className="card-inner p-3.5">
            <div className="text-[10px] text-sky-200/55 uppercase tracking-[0.12em] font-semibold">{s.label}</div>
            <div className="text-[22px] font-semibold mt-1 leading-none" style={{ color: s.color }}>{s.value}</div>
            <div className="text-[10px] text-sky-200/45 mt-0.5">{param.unit}</div>
          </div>
        ))}
      </div>

      {/* Performance summary */}
      <div className="card p-4">
        <div className="flex items-center gap-3">
          <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${
            improved ? "bg-emerald-500/10 border border-emerald-500/20" : "bg-red-500/10 border border-red-500/20"
          }`}>
            <svg width="18" height="18" viewBox="0 0 20 20" fill="none">
              <path d={improved ? "M10 15V5M6 9l4-4 4 4" : "M10 5v10M6 11l4 4 4-4"}
                stroke={improved ? "#10b981" : "#ef4444"} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </div>
          <div>
            <h4 className="text-[13px] font-semibold text-cyan-50">
              {improved ? "Performance Improved" : "Performance Declined"}
            </h4>
            <p className="text-[11px] text-sky-200/55 mt-0.5">
              {param.label} {improved ? "moved closer to" : "deviated further from"} nominal ({param.nominal} {param.unit}) compared to previous {shift.label.toLowerCase()}.
              Delta: {Math.abs(delta).toFixed(2)} {param.unit} ({Math.abs(Number(deltaPct))}%)
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

const DigitalIOSection: React.FC<{ timeRange: AnalyticsTimeRange }> = ({ timeRange }) => {
  const { outputs } = usePLCContext();

  return (
    <div className="space-y-4">
      {DIGITAL_PARAMS.map((p) => (
        <DigitalChannel key={p.id} param={p} timeRange={timeRange} />
      ))}

      {/* Relay States — real PLC data */}
      <div className="card p-4">
        <h4 className="text-[13px] font-semibold text-cyan-50 mb-3">8-Channel Relay Status</h4>
        <div className="grid grid-cols-8 gap-2">
          {outputs.relay.map((active, i) => (
            <div key={i} className={`rounded-lg p-2.5 text-center border transition-all duration-300 ${
              active ? "bg-emerald-500/10 border-emerald-500/20" : "bg-white/[0.02] border-white/[0.05]"
            }`}>
              <div className={`text-[9px] font-medium ${active ? "text-emerald-400" : "text-sky-200/40"}`}>CH{i}</div>
              <div className={`w-3 h-3 rounded-full mx-auto mt-1.5 transition-all duration-300 ${
                active ? "bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.5)]" : "bg-white/[0.08]"
              }`} />
              <div className={`text-[8px] mt-1 font-semibold ${active ? "text-emerald-400" : "text-sky-200/30"}`}>
                {active ? "ON" : "OFF"}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

/* ── Main Panel ──────────────────────────────────────── */

interface KPIAnalyticsPanelProps {
  open: boolean;
  onClose: () => void;
}

const KPIAnalyticsPanel: React.FC<KPIAnalyticsPanelProps> = ({ open, onClose }) => {
  const [selectedParam, setSelectedParam] = useState<SiteWiseProperty>("voltage");
  const [localTimeRange, setLocalTimeRange] = useState<AnalyticsTimeRange>("1m");
  const [activeSection, setActiveSection] = useState<"trends" | "all-params" | "digital" | "alerts" | "shifts">("trends");

  const param = ALL_PARAMS.find((p) => p.id === selectedParam) ?? ANALOG_PARAMS[0];
  const tcfg = TIME_CONFIGS[localTimeRange];

  const historyData = usePLCHistory(param, localTimeRange, tcfg.points);
  const anomalies = useMemo(() => detectAnomalies(historyData.data), [historyData.data]);

  // Stats
  const stats = useMemo(() => {
    const d = historyData.data;
    const avg = d.reduce((s, v) => s + v, 0) / d.length;
    return {
      avg: avg.toFixed(param.kind === "analog" ? 1 : 0),
      peak: Math.max(...d).toFixed(param.kind === "analog" ? 1 : 0),
      min: Math.min(...d).toFixed(param.kind === "analog" ? 1 : 0),
      latest: d[d.length - 1]?.toFixed(param.kind === "analog" ? 1 : 0) ?? "—",
    };
  }, [historyData.data, param.kind]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />

      <div className="relative w-[90vw] max-w-[1100px] max-h-[85vh] bg-[#0a1628]/95 backdrop-blur-2xl border border-cyan-300/12 rounded-2xl shadow-[0_20px_80px_rgba(0,0,0,0.8)] flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-cyan-300/[0.08]">
          <div>
            <h2 className="text-[16px] font-semibold text-cyan-50 tracking-tight">PLC Analytics</h2>
            <p className="text-[11px] text-sky-200/60 font-medium mt-0.5">
              Historical trends, anomaly detection, and parameter insights from SiteWise
            </p>
          </div>
          <div className="flex items-center gap-3">
            <div className="flex gap-1 p-1 rounded-xl bg-white/[0.03] border border-cyan-300/[0.08]">
              {(["trends", "all-params", "digital", "alerts", "shifts"] as const).map((sec) => (
                <button
                  key={sec}
                  onClick={() => setActiveSection(sec)}
                  className={`px-3 py-1.5 rounded-lg text-[11px] font-semibold transition-all duration-200 ${
                    activeSection === sec
                      ? "bg-cyan-500/[0.12] text-cyan-100"
                      : "text-sky-200/50 hover:text-sky-100/70"
                  }`}
                >
                  {sec === "trends" ? "Trends" : sec === "all-params" ? "All Sensors" : sec === "digital" ? "Digital I/O" : sec === "alerts" ? "Alerts" : "Shift Compare"}
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
          {/* ── Parameter Selector + Time Toggle ── */}
          <div className="flex items-center justify-between mb-5">
            <div className="flex gap-2">
              {(activeSection === "digital" ? DIGITAL_PARAMS : ANALOG_PARAMS).map((p) => (
                <button
                  key={p.id}
                  onClick={() => setSelectedParam(p.id)}
                  className={`px-3 py-1.5 rounded-lg text-[11px] font-semibold transition-all duration-200 border flex items-center gap-2 ${
                    selectedParam === p.id
                      ? "bg-white/[0.08] border-white/[0.12] text-white"
                      : "border-transparent text-sky-200/50 hover:text-sky-100/70 hover:bg-white/[0.03]"
                  }`}
                >
                  <span className="w-2 h-2 rounded-full" style={{ backgroundColor: p.color }} />
                  {p.label}
                </button>
              ))}
            </div>
            <div className="flex gap-1 p-0.5 rounded-lg bg-white/[0.03] border border-cyan-300/[0.08]">
              {ALL_TIME_RANGES.map((t) => (
                <button
                  key={t}
                  onClick={() => setLocalTimeRange(t)}
                  className={`px-2.5 py-1 rounded-md text-[10px] font-semibold transition-all duration-200 ${
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

          {/* ── TRENDS Section ── */}
          {activeSection === "trends" && (
            <div className="space-y-5">
              <div className="card p-5">
                <div className="flex items-center justify-between mb-3">
                  <div>
                    <h3 className="text-[14px] font-semibold text-cyan-50">
                      {param.label} — {tcfg.label}
                    </h3>
                    <p className="text-[11px] text-sky-200/55 mt-0.5 flex items-center gap-2">
                      Range: {param.min}–{param.max} {param.unit} · Nominal: {param.nominal} {param.unit}
                      <span className={`px-1.5 py-0.5 rounded text-[9px] font-bold uppercase ${
                        historyData.source === "mqtt"
                          ? "bg-cyan-500/15 text-cyan-400 border border-cyan-500/20"
                          : historyData.source === "sitewise"
                            ? "bg-emerald-500/15 text-emerald-400 border border-emerald-500/20"
                            : "bg-amber-500/15 text-amber-400 border border-amber-500/20"
                      }`}>
                        {historyData.loading ? "Loading..." : historyData.source === "mqtt" ? "MQTT Live" : historyData.source === "sitewise" ? "SiteWise" : "Mock"}
                      </span>
                      {anomalies.length > 0 && (
                        <span className="text-red-400/80">
                          {anomalies.length} anomal{anomalies.length === 1 ? "y" : "ies"}
                        </span>
                      )}
                    </p>
                    {historyData.lastUpdated && (
                      <p className="text-[10px] text-sky-200/40 mt-1 flex items-center gap-1.5">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                        Last updated: {historyData.lastUpdated.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: true })}
                        · Refreshes every {(REFRESH_INTERVALS[localTimeRange] ?? 5000) / 1000}s
                      </p>
                    )}
                  </div>
                  <div className="flex items-center gap-3">
                    <button
                      onClick={() => {
                        const rows = historyData.data.map((v, i) => [i + 1, v.toFixed(2), param.unit]);
                        exportCSV(
                          `${param.id}_${localTimeRange}_${new Date().toISOString().slice(0, 10)}.csv`,
                          ["Index", `${param.label} (${param.unit})`, "Unit"],
                          rows
                        );
                      }}
                      className="px-2.5 py-1.5 rounded-lg text-[10px] font-semibold text-sky-200/50 hover:text-white border border-white/[0.06] hover:border-white/[0.12] hover:bg-white/[0.04] transition-all duration-200 flex items-center gap-1.5"
                    >
                      <svg width="12" height="12" viewBox="0 0 16 16" fill="none">
                        <path d="M8 2v8M5 7l3 3 3-3M3 12h10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                      CSV
                    </button>
                    <div className="text-right">
                      <div className="text-[28px] font-semibold leading-none" style={{ color: param.color }}>
                        {stats.latest}
                      </div>
                      <div className="text-[11px] text-sky-200/55 mt-0.5">{param.unit} latest</div>
                    </div>
                  </div>
                </div>
                <AreaChart
                  data={historyData.data}
                  color={param.color}
                  anomalies={anomalies}
                  timeRange={localTimeRange}
                  height={220}
                  unit={param.unit}
                  nominal={param.nominal}
                />
              </div>

              {/* Stats Row */}
              <div className="grid grid-cols-4 gap-3">
                {[
                  { label: "Average", value: stats.avg, color: param.color },
                  { label: "Peak", value: stats.peak, color: "#ef4444" },
                  { label: "Minimum", value: stats.min, color: "#10b981" },
                  { label: "Anomalies", value: String(anomalies.length), color: anomalies.length > 0 ? "#ef4444" : "#10b981" },
                ].map((stat) => (
                  <div key={stat.label} className="card-inner p-3.5">
                    <div className="text-[10px] text-sky-200/55 uppercase tracking-[0.12em] font-semibold">{stat.label}</div>
                    <div className="text-[22px] font-semibold mt-1 leading-none" style={{ color: stat.color }}>
                      {stat.value}
                    </div>
                    <div className="text-[10px] text-sky-200/45 mt-0.5">{stat.label === "Anomalies" ? "detected" : param.unit}</div>
                  </div>
                ))}
              </div>

              {/* Nominal deviation table */}
              <div className="card p-4">
                <h4 className="text-[13px] font-semibold text-cyan-50 mb-3">Deviation from Nominal ({param.nominal} {param.unit})</h4>
                <div className="grid grid-cols-3 gap-4">
                  {[
                    { label: "Current Deviation", value: Math.abs(Number(stats.latest) - param.nominal).toFixed(2), pct: (Math.abs(Number(stats.latest) - param.nominal) / (param.max - param.min) * 100).toFixed(1) },
                    { label: "Avg Deviation", value: Math.abs(Number(stats.avg) - param.nominal).toFixed(2), pct: (Math.abs(Number(stats.avg) - param.nominal) / (param.max - param.min) * 100).toFixed(1) },
                    { label: "Max Deviation", value: Math.max(Math.abs(Number(stats.peak) - param.nominal), Math.abs(Number(stats.min) - param.nominal)).toFixed(2), pct: (Math.max(Math.abs(Number(stats.peak) - param.nominal), Math.abs(Number(stats.min) - param.nominal)) / (param.max - param.min) * 100).toFixed(1) },
                  ].map((d) => {
                    const severity = Number(d.pct) > 40 ? "critical" : Number(d.pct) > 20 ? "warning" : "normal";
                    const sColor = severity === "critical" ? "#ef4444" : severity === "warning" ? "#f59e0b" : "#10b981";
                    return (
                      <div key={d.label} className="card-inner p-3">
                        <div className="text-[10px] text-sky-200/55 font-medium">{d.label}</div>
                        <div className="flex items-baseline gap-1.5 mt-1.5">
                          <span className="text-[18px] font-semibold" style={{ color: sColor }}>{d.value}</span>
                          <span className="text-[10px] text-sky-200/45">{param.unit}</span>
                        </div>
                        <div className="flex items-center gap-2 mt-1.5">
                          <div className="flex-1 h-1.5 rounded-full bg-white/[0.04] overflow-hidden">
                            <div className="h-full rounded-full" style={{ width: `${Math.min(100, Number(d.pct))}%`, backgroundColor: sColor }} />
                          </div>
                          <span className="text-[9px] font-semibold" style={{ color: sColor }}>{d.pct}%</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* SiteWise Computed Metrics */}
              <SiteWiseMetricsCard param={param} />
            </div>
          )}

          {/* ── ALL SENSORS Section (live data) ── */}
          {activeSection === "all-params" && (
            <div className="grid grid-cols-2 gap-4">
              {ANALOG_PARAMS.map((p) => (
                <SensorCard
                  key={p.id}
                  param={p}
                  timeRange={localTimeRange}
                  selected={selectedParam === p.id}
                  onClick={() => { setSelectedParam(p.id); setActiveSection("trends"); }}
                />
              ))}
            </div>
          )}

          {/* ── DIGITAL I/O Section (live data) ── */}
          {activeSection === "digital" && (
            <DigitalIOSection timeRange={localTimeRange} />
          )}

          {/* ── ALERTS Section (live data) ── */}
          {activeSection === "alerts" && (
            <div className="space-y-4">
              {ALERT_PARAMS.map((p) => (
                <AlertChannel key={p.id} param={p} timeRange={localTimeRange} />
              ))}
            </div>
          )}

          {/* ── SHIFT COMPARISON Section ── */}
          {activeSection === "shifts" && (
            <ShiftComparisonSection param={param} />
          )}
        </div>
      </div>
    </div>
  );
};

export default KPIAnalyticsPanel;
