import { useEffect, useId, useRef, useState, type CSSProperties } from "react";
import { Activity, ArrowDownToLine, ArrowRight, CheckCheck, Clock3, Database, Gauge, Package, Radio, Timer, X } from "lucide-react";
import { Area, CartesianGrid, ComposedChart, Line, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { useOEE } from "../hooks/useOEE";
import type { OEEResponse, OEETrendPoint } from "../services/siteWiseService";
import type { OEETimeRange } from "../types";
import "./oee-workspace.css";

interface OEEPanelProps { open: boolean; onClose: () => void }
type Factor = "availability" | "performance" | "quality";
type Series = Factor | "oee";
const FACTORS = [
  { key: "availability" as const, label: "Availability", color: "#82b5f6", Icon: Timer, formula: "Run time / planned time", gap: "Time unavailable" },
  { key: "performance" as const, label: "Performance", color: "#e9bd70", Icon: Gauge, formula: "Actual output / ideal output", gap: "Speed loss" },
  { key: "quality" as const, label: "Quality", color: "#c7a4ed", Icon: CheckCheck, formula: "Good parts / total parts", gap: "Quality loss" },
];
const SERIES = [{ key: "oee" as const, label: "OEE", color: "#43d8f1" }, ...FACTORS];
const RANGES: { id: OEETimeRange; label: string }[] = [{ id: "shift", label: "Shift" }, { id: "24h", label: "24h" }, { id: "7d", label: "7d" }, { id: "30d", label: "30d" }];
const percent = (value: number | undefined) => value === undefined ? "—" : (value * 100).toFixed(1);
const duration = (seconds: number | undefined) => {
  if (seconds === undefined) return "—";
  if (seconds < 60) return `${Math.floor(seconds)}s`;
  const hours = Math.floor(seconds / 3600), minutes = Math.floor(seconds % 3600 / 60);
  return hours ? `${hours}h ${minutes}m` : `${minutes}m`;
};
const clockTime = (timestamp: number) => new Date(timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
const accent = (color: string) => ({ "--oee-accent": color } as CSSProperties);

function EffectivenessDial({ oee }: { oee: OEEResponse | null }) {
  return <div className="oee-dial" role="img" aria-label={oee ? `Overall effectiveness ${percent(oee.oee.value)} percent. Availability ${percent(oee.availability.value)}, performance ${percent(oee.performance.value)}, quality ${percent(oee.quality.value)} percent.` : "Waiting for an OEE measurement"}>
    <svg viewBox="0 0 240 240" aria-hidden="true">
      {Array.from({ length: 40 }, (_, index) => <line key={index} x1="120" y1="4" x2="120" y2={index % 5 === 0 ? 12 : 8} transform={`rotate(${index * 9} 120 120)`} className="oee-dial-tick" />)}
      {FACTORS.map((factor, index) => <g key={factor.key} transform="rotate(-90 120 120)">
        <circle cx="120" cy="120" r={98 - index * 14} className="oee-dial-track" />
        {oee && <circle cx="120" cy="120" r={98 - index * 14} className="oee-dial-fill" stroke={factor.color} pathLength="100" strokeDasharray={`${oee[factor.key].value * 100} 100`} />}
      </g>)}
    </svg>
    <div className="oee-dial-value"><strong>{percent(oee?.oee.value)}{oee && <small>%</small>}</strong><span>Overall effectiveness</span></div>
  </div>;
}

function FactorInstrument({ factor, value }: { factor: typeof FACTORS[number]; value: number | undefined }) {
  const { Icon } = factor;
  return <section className="oee-factor" style={accent(factor.color)} aria-label={factor.label}>
    <h3><Icon size={18} />{factor.label}</h3>
    <div className="oee-factor-value">{percent(value)}{value !== undefined && <small>%</small>}</div>
    <p>{factor.formula}</p>
    <svg className="oee-factor-segments" viewBox="0 0 240 36" aria-hidden="true">
      {Array.from({ length: 30 }, (_, index) => <rect key={index} x={index * 8} y="3" width="5" height="30" rx="1" fill={value !== undefined && index / 30 < value ? factor.color : "#30444f"} />)}
    </svg>
    <div className="oee-factor-gap"><span>{factor.gap}</span><strong>{value === undefined ? "—" : `${((1 - value) * 100).toFixed(1)}%`}</strong></div>
  </section>;
}

function YieldBreakdown({ oee }: { oee: OEEResponse | null }) {
  const a = oee?.availability.value, p = oee?.performance.value, q = oee?.quality.value;
  const values = a === undefined || p === undefined || q === undefined ? null : [1, a, a * p, a * p * q];
  const labels = ["Planned", "Available", "At speed", "Good output"];
  const colors = ["#497080", ...FACTORS.map((factor) => factor.color)];
  return <aside className="oee-yield">
    <h3>Where effectiveness goes</h3><p>How the three factors compound.</p>
    <div className="oee-yield-bars" role="img" aria-label={values ? labels.map((label, i) => `${label}: ${percent(values[i])}%`).join(", ") : "Effectiveness breakdown awaiting measurements"}>
      {labels.map((label, index) => <div className="oee-yield-column" key={label} style={accent(colors[index])}>
        <strong>{values ? `${percent(values[index])}%` : "—"}</strong>
        <div className="oee-yield-track"><span style={{ transform: `scaleY(${values?.[index] ?? 0})` }} /></div><span>{label}</span>
      </div>)}
    </div>
    <div className="oee-yield-equation"><span>A</span><b>×</b><span>P</span><b>×</b><span>Q</span><ArrowRight size={14} /><strong>{values ? `${percent(values[3])}%` : "—"}</strong></div>
    <small>Calculated from the latest factors.</small>
  </aside>;
}

function History({ data, loading, range }: { data: OEETrendPoint[]; loading: boolean; range: OEETimeRange }) {
  const [visible, setVisible] = useState<Set<Series>>(() => new Set(SERIES.map((series) => series.key)));
  const id = useId().replace(/:/g, "");
  const tickTime = (timestamp: number) => range === "7d" || range === "30d" ? new Date(timestamp).toLocaleDateString([], { month: "short", day: "numeric" }) : clockTime(timestamp);
  return <>
    <div className="oee-history-legend" aria-label="Trend series">
      {SERIES.map((series) => <button type="button" key={series.key} aria-pressed={visible.has(series.key)} style={accent(series.color)} onClick={() => setVisible((previous) => {
        const next = new Set(previous);
        if (next.has(series.key)) { if (next.size > 1) next.delete(series.key); } else next.add(series.key);
        return next;
      })}><i />{series.label}</button>)}
    </div>
    <div className="oee-history-plot">
      {!data.length ? <div className="oee-history-empty" role="status"><Activity size={30} strokeWidth={1.3} /><strong>{loading ? "Loading production history" : "Waiting for production history"}</strong><span>Received OEE readings will appear here.</span></div> :
        <ResponsiveContainer width="100%" height="100%" minWidth={0}>
          <ComposedChart data={data} margin={{ top: 14, right: 14, left: -18, bottom: 0 }} accessibilityLayer>
            <defs><linearGradient id={id} x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#43d8f1" stopOpacity={0.18} /><stop offset="100%" stopColor="#43d8f1" stopOpacity={0} /></linearGradient></defs>
            <CartesianGrid vertical={false} stroke="#30444f" strokeDasharray="3 5" />
            <XAxis dataKey="timestamp" type="number" domain={["dataMin", "dataMax"]} tickFormatter={tickTime} minTickGap={45} tick={{ fill: "#a7bbc6", fontSize: 11 }} axisLine={false} tickLine={false} dy={8} />
            <YAxis domain={[0, 1]} ticks={[0, .25, .5, .75, 1]} tickFormatter={(value: number) => `${value * 100}%`} tick={{ fill: "#a7bbc6", fontSize: 11 }} axisLine={false} tickLine={false} />
            <Tooltip cursor={{ stroke: "#90aab7", strokeDasharray: "4 4" }} content={({ active, payload, label }) => active && payload?.length ? <div className="oee-chart-tooltip"><strong>{new Date(Number(label)).toLocaleString([], { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit", second: "2-digit" })}</strong>{payload.map((entry) => <div key={String(entry.dataKey)}><span><i style={{ background: entry.color }} />{entry.name}</span><b>{percent(Number(entry.value))}%</b></div>)}</div> : null} />
            {visible.has("oee") && <Area dataKey="oee" name="OEE" type="linear" stroke="#43d8f1" strokeWidth={2.5} fill={`url(#${id})`} dot={data.length === 1 ? { r: 4 } : false} activeDot={{ r: 5, stroke: "#14242e", strokeWidth: 2 }} isAnimationActive={false} />}
            {FACTORS.map((factor) => visible.has(factor.key) && <Line key={factor.key} dataKey={factor.key} name={factor.label} type="linear" stroke={factor.color} strokeWidth={1.6} dot={data.length === 1 ? { r: 3 } : false} activeDot={{ r: 4 }} isAnimationActive={false} />)}
          </ComposedChart>
        </ResponsiveContainer>}
    </div>
  </>;
}

function exportHistory(data: OEETrendPoint[]) {
  const csv = ["timestamp,oee_percent,availability_percent,performance_percent,quality_percent", ...data.map((point) => [new Date(point.timestamp).toISOString(), ...SERIES.map((series) => (point[series.key] * 100).toFixed(3))].join(","))].join("\r\n");
  const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
  const link = document.createElement("a"); link.href = url; link.download = "oee-history.csv"; link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export default function OEEPanel({ open, onClose }: OEEPanelProps) {
  const { oee, trend, loading, source, trendSource, trendLoading, trendTimeRange, setTrendTimeRange } = useOEE();
  const dialog = useRef<HTMLDivElement>(null), close = useRef<HTMLButtonElement>(null), dismiss = useRef(onClose);
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => { dismiss.current = onClose; }, [onClose]);
  useEffect(() => {
    if (!open) return;
    const previous = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden"; close.current?.focus();
    const timer = setInterval(() => setNow(Date.now()), 1000);
    const keydown = (event: KeyboardEvent) => {
      if (event.key === "Escape") { event.preventDefault(); dismiss.current(); }
      if (event.key !== "Tab") return;
      const controls = [...(dialog.current?.querySelectorAll<HTMLElement>('button:not(:disabled), [tabindex="0"]') ?? [])].filter((element) => element.getClientRects().length);
      const first = controls[0], last = controls.at(-1);
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
    };
    document.addEventListener("keydown", keydown);
    return () => { clearInterval(timer); document.removeEventListener("keydown", keydown); document.body.style.overflow = overflow; previous?.focus(); };
  }, [open]);
  if (!open) return null;
  const lowest = oee ? FACTORS.reduce((low, factor) => oee[factor.key].value < oee[low.key].value ? factor : low) : null;
  const age = oee ? Math.max(0, Math.floor((now - oee.timestamp) / 1000)) : 0;
  const stale = source === "plc" && age > 30;
  const sourceLabel = source === "plc" ? stale ? "Last PLC reading" : "PLC rollup" : source === "historian" ? "SiteWise snapshot" : loading ? "Connecting" : "Awaiting OEE";
  const counts = [
    { label: "Total cycles", value: oee?.totalCycles.toLocaleString() ?? "—", Icon: Package },
    { label: "Good parts", value: oee?.goodCycles.toLocaleString() ?? "—", Icon: CheckCheck, color: "#6ed6a2" },
    { label: "Rejects", value: oee?.rejectCycles.toLocaleString() ?? "—", Icon: X, color: oee?.rejectCycles ? "#f18b82" : undefined },
    { label: "Run time", value: duration(oee?.runTimeSec), Icon: Timer },
    { label: "Shift", value: oee?.shiftId ?? "—", Icon: Clock3 },
  ];
  return <div className="oee-workspace-overlay"><div className="oee-workspace-backdrop" onClick={onClose} /><div className="oee-workspace" role="dialog" aria-modal="true" aria-labelledby="oee-workspace-title" ref={dialog}>
    <header className="oee-workspace-header"><div className="oee-workspace-heading"><span className="oee-heading-icon"><Gauge size={23} /></span><div><h2 id="oee-workspace-title">OEE Dashboard</h2><p>Overall equipment effectiveness</p></div></div><div className="oee-header-actions"><div className={`oee-source ${stale ? "is-stale" : ""}`}><span><i />{sourceLabel}</span><small>{oee ? `Updated ${clockTime(oee.timestamp)}${stale ? ` · ${duration(age)} ago` : ""}` : "Waiting for a complete rollup"}</small></div><button type="button" className="oee-close" ref={close} onClick={onClose} aria-label="Close OEE dashboard"><X size={20} /></button></div></header>
    <div className="oee-workspace-scroll">
      <section className="oee-overview" aria-label="Current equipment effectiveness"><div className="oee-overall"><EffectivenessDial oee={oee} /><div className="oee-formula">Availability <b>×</b> Performance <b>×</b> Quality</div></div><div className="oee-factors">{FACTORS.map((factor) => <FactorInstrument key={factor.key} factor={factor} value={oee?.[factor.key].value} />)}<div className="oee-focus"><Activity size={16} /><span>{lowest && oee ? <><strong>{lowest.label}</strong> is the lowest factor at <strong>{percent(oee[lowest.key].value)}%</strong>.</> : "The latest production rollup will populate these instruments."}</span></div></div></section>
      <dl className="oee-production-stats">{counts.map(({ label, value, Icon, color }) => <div key={label}><dt><Icon size={14} />{label}</dt><dd style={color ? { color } : undefined}>{value}</dd></div>)}</dl>
      <section className="oee-trend-section" aria-label="OEE history"><div className="oee-section-heading"><div><h3>Effectiveness over time</h3><p>{trendSource === "session" ? "Received this session · up to 20 minutes retained" : trendSource === "historian" ? "SiteWise history and received PLC samples" : "History appears as production readings arrive"}</p></div><div className="oee-range-controls" aria-label="History time range">{RANGES.map((range) => <button type="button" key={range.id} aria-pressed={range.id === trendTimeRange} onClick={() => setTrendTimeRange(range.id)}>{range.label}</button>)}</div></div><div className="oee-history-layout"><div className="oee-history"><History data={trend} loading={trendLoading} range={trendTimeRange} /><div className="oee-history-footer"><span><Clock3 size={13} />{trend.length ? `${trend.length.toLocaleString()} samples · ${clockTime(trend[0].timestamp)}–${clockTime(trend.at(-1)!.timestamp)}` : "No samples received"}</span><button type="button" disabled={!trend.length} onClick={() => exportHistory(trend)}><ArrowDownToLine size={14} />Export CSV</button></div></div><YieldBreakdown oee={oee} /></div></section>
    </div><footer className="oee-workspace-footer"><span><Database size={13} />Received production data only</span><span>{source === "plc" ? "Good / reject counts derived from reported quality." : <><Radio size={13} />Availability × Performance × Quality</>}</span></footer>
  </div></div>;
}
