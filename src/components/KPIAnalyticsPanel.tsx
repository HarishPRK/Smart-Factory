import { useEffect, useId, useRef, useState, type CSSProperties } from "react";
import { Activity, ArrowDownToLine, ArrowUpRight, ChartNoAxesCombined, Clock3, Database, GitCompareArrows, Radio, SlidersHorizontal, TriangleAlert, X } from "lucide-react";
import { usePLCAnalyticsHistory, ANALYTICS_RANGES, ANALYTICS_RANGE_CONFIGS, type AnalyticsTimeRange } from "../hooks/usePLCAnalyticsHistory";
import { usePLCTrendHistory, type PLCTrendHistory } from "../hooks/usePLCTrendHistory";
import { fetchMetrics, isSiteWiseConfigured, type MetricsResult, type SiteWiseProperty } from "../services/siteWiseService";
import { chartDomain, distributionBins, summarizeDigital, summarizeSeries } from "./analytics/analyticsModel";

type Param = { id: SiteWiseProperty; label: string; unit: string; color: string; min: number; max: number; nominal: number };
const ANALOG: Param[] = [
  { id: "voltage", label: "Voltage", unit: "V", color: "#e9bd70", min: 0, max: 12, nominal: 5 },
  { id: "current", label: "Current", unit: "A", color: "#43d8f1", min: 0, max: 10, nominal: 6 },
  { id: "pH", label: "pH", unit: "", color: "#4ac2be", min: 0, max: 14, nominal: 7 },
  { id: "temperature", label: "Temperature", unit: "°C", color: "#f18b82", min: 0, max: 100, nominal: 25 },
];
const DIGITAL: Param[] = [
  { id: "photoE_sensor", label: "Photoelectric", unit: "", color: "#6ed6a2", min: 0, max: 1, nominal: 0 },
  { id: "metal_sensor", label: "Metal detector", unit: "", color: "#82b5f6", min: 0, max: 1, nominal: 0 },
  { id: "motor", label: "Motor fan", unit: "", color: "#43d8f1", min: 0, max: 1, nominal: 0 },
  { id: "push_button", label: "Push button", unit: "", color: "#e9bd70", min: 0, max: 1, nominal: 0 },
];
const ALERTS: Param[] = [
  { id: "alert_0", label: "Alert channel 0", unit: "", color: "#f18b82", min: 0, max: 1, nominal: 0 },
  { id: "alert_1", label: "Alert channel 1", unit: "", color: "#e9bd70", min: 0, max: 1, nominal: 0 },
  { id: "alert_2", label: "Alert channel 2", unit: "", color: "#6ed6a2", min: 0, max: 1, nominal: 0 },
  { id: "alert_3", label: "Emergency light channel", unit: "", color: "#f18b82", min: 0, max: 1, nominal: 0 },
];
const VIEWS = [
  { id: "trends", label: "Trends", icon: ChartNoAxesCombined }, { id: "sensors", label: "All sensors", icon: SlidersHorizontal },
  { id: "digital", label: "Digital I/O", icon: Radio }, { id: "alerts", label: "Alerts", icon: TriangleAlert },
  { id: "shifts", label: "Shift comparison", icon: GitCompareArrows },
] as const;
type History = PLCTrendHistory;
const fmt = (value: number | null | undefined, digits = 2) => value == null || !Number.isFinite(value) ? "—" : value.toLocaleString(undefined, { maximumFractionDigits: digits });
const time = (timestamp: number) => new Date(timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" });
const accent = (color: string) => ({ "--signal": color } as CSSProperties);

function SourceState({ history }: { history: History }) {
  if (history.source === "hourly-preview") return <span className="plc-analysis-source" data-state="ready"><i aria-hidden="true" />Last hour</span>;
  const stale = history.source === "mqtt" && history.lastUpdated !== null && history.windowEnd - history.lastUpdated > 15_000;
  const text = history.loading ? "Loading history" : history.state === "unconfigured" ? "Historian not configured" : history.state === "error" ? "History unavailable" : history.source === "sitewise" ? "SiteWise history" : history.source === "mqtt+sitewise" ? "SiteWise + MQTT history" : history.state === "empty" ? "Awaiting readings" : stale ? "Last received" : "MQTT readings";
  return <span className="plc-analysis-source" data-state={stale ? "stale" : history.state}><i aria-hidden="true" />{text}</span>;
}
function EmptyHistory({ history }: { history: History }) {
  return <div className="plc-analysis-empty" role="status"><Activity size={28} strokeWidth={1.25} aria-hidden="true" />
    <h4>{history.loading ? "Loading received history" : history.state === "unconfigured" ? "Historical data is not connected" : history.state === "error" ? "Could not load this history" : "Waiting for this sensor"}</h4>
    <p>{history.state === "unconfigured" ? "Choose 1m or 5m to inspect received MQTT readings. Longer ranges need the existing SiteWise historian." : history.state === "error" ? "The historian request failed. Select another range or reopen this view to retry." : "The plot will appear when readings arrive. No sample values are substituted."}</p></div>;
}
function usePlotWidth() {
  const ref = useRef<HTMLDivElement>(null); const [width, setWidth] = useState(800);
  useEffect(() => {
    if (!ref.current || typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(([entry]) => setWidth(Math.max(260, entry.contentRect.width)));
    observer.observe(ref.current); return () => observer.disconnect();
  }, []);
  return { ref, width };
}

/** Coordinates follow measurement timestamps; MQTT receipt gaps break the trace. */
function SignalPlot({ history, param, deviation = false, fullRange = false, compact = false, digital = false }: { history: History; param: Param; deviation?: boolean; fullRange?: boolean; compact?: boolean; digital?: boolean }) {
  const { ref, width } = usePlotWidth(); const [inspection, setInspection] = useState<{ timestamp: number; value: number } | null>(null);
  const fillId = useId().replace(/:/g, ""); const points = history.points; const height = compact ? 140 : 290;
  const pad = { left: compact ? 36 : 48, right: 20, top: 24, bottom: 30 }; const baseline = deviation ? 0 : param.nominal;
  const values = points.map((point) => ({ ...point, value: digital ? point.value >= .5 ? 1 : 0 : deviation ? point.value - param.nominal : point.value }));
  const domain = digital ? [-.2, 1.2] : fullRange ? [deviation ? param.min - param.nominal : param.min, deviation ? param.max - param.nominal : param.max] : chartDomain(values, baseline);
  const x = (timestamp: number) => pad.left + (timestamp - history.windowStart) / Math.max(1, history.windowEnd - history.windowStart) * (width - pad.left - pad.right);
  const y = (value: number) => pad.top + (1 - (value - domain[0]) / (domain[1] - domain[0])) * (height - pad.top - pad.bottom);
  const bottom = height - pad.bottom; const outliers = summarizeSeries(points, param.nominal).outlierIndices;
  const segments: string[] = []; let path = "";
  values.forEach((point, index) => {
    if (!index || (history.source === "mqtt" && point.timestamp - values[index - 1].timestamp > 15_000)) { if (path) segments.push(path); path = `M${x(point.timestamp)},${y(point.value)}`; }
    else path += digital ? `H${x(point.timestamp)}V${y(point.value)}` : `L${x(point.timestamp)},${y(point.value)}`;
  }); if (path) segments.push(path);
  const inspected = inspection && points.some((point) => point.timestamp === inspection.timestamp && point.value === inspection.value) ? inspection : null;
  const inspectedValue = inspected ? digital ? inspected.value >= .5 ? 1 : 0 : deviation ? inspected.value - param.nominal : inspected.value : null;
  return <div ref={ref} className="plc-analysis-plot" style={accent(param.color)}>{!points.length ? <EmptyHistory history={history} /> : <>
    <svg viewBox={`0 0 ${width} ${height}`} role="img" aria-label={`${param.label} ${digital ? "state history" : deviation ? "deviation from nominal" : history.source === "hourly-preview" ? "trend history" : "received history"}, ${points.length} timestamped readings`}>
      <defs><linearGradient id={fillId} x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor={param.color} stopOpacity=".12" /><stop offset="100%" stopColor={param.color} stopOpacity="0" /></linearGradient><clipPath id={`${fillId}-plot`}><rect x={pad.left} y={pad.top} width={width - pad.left - pad.right} height={bottom - pad.top} /></clipPath></defs>
      {(digital ? [0, 1] : [0, .25, .5, .75, 1].map((fraction) => domain[0] + (domain[1] - domain[0]) * fraction)).map((value) => <g key={value}><line x1={pad.left} x2={width - pad.right} y1={y(value)} y2={y(value)} className="plc-analysis-gridline" /><text x={pad.left - 9} y={y(value) + 4} textAnchor="end">{digital ? value ? "ON" : "OFF" : fmt(value, 1)}</text></g>)}
      {!digital && <g className="plc-analysis-reference"><line x1={pad.left} x2={width - pad.right} y1={y(baseline)} y2={y(baseline)} /><text x={width - pad.right} y={y(baseline) - 7} textAnchor="end">{deviation ? "Nominal" : `Nominal ${fmt(param.nominal)} ${param.unit}`}</text></g>}
      {Array.from({ length: compact || width < 430 ? 3 : 5 }, (_, index) => {
        const count = compact || width < 430 ? 3 : 5; const timestamp = history.windowStart + index / (count - 1) * (history.windowEnd - history.windowStart);
        const duration = history.windowEnd - history.windowStart;
        const label = duration > 86_400_000 ? new Date(timestamp).toLocaleDateString([], { month: "short", day: "numeric" }) : new Date(timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", ...(duration <= 300_000 ? { second: "2-digit" as const } : {}) });
        return <text key={index} x={x(timestamp)} y={height - 6} textAnchor={!index ? "start" : index === count - 1 ? "end" : "middle"}>{label}</text>;
      })}
      <g clipPath={`url(#${fillId}-plot)`}>
      {!digital && segments.length === 1 && values.length > 1 && <path d={`${segments[0]}L${x(values.at(-1)!.timestamp)},${bottom}L${x(values[0].timestamp)},${bottom}Z`} fill={`url(#${fillId})`} />}
      {segments.map((segment, index) => <path key={index} d={segment} fill="none" stroke={param.color} strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />)}
      {!digital && outliers.map((index) => <circle key={index} cx={x(values[index].timestamp)} cy={y(values[index].value)} r="4" className="plc-analysis-outlier" />)}
      <circle cx={x(values.at(-1)!.timestamp)} cy={y(values.at(-1)!.value)} r="3.5" fill={param.color} />
      {inspected && <g><line x1={x(inspected.timestamp)} x2={x(inspected.timestamp)} y1={pad.top} y2={bottom} className="plc-analysis-crosshair" /><circle cx={x(inspected.timestamp)} cy={y(inspectedValue!)} r="5" fill={param.color} stroke="#101c25" strokeWidth="2" /></g>}
      </g>
      {!compact && <rect x={pad.left} y={pad.top} width={width - pad.left - pad.right} height={bottom - pad.top} fill="transparent" onPointerMove={(event) => {
        const box = event.currentTarget.ownerSVGElement!.getBoundingClientRect(); const position = (event.clientX - box.left) / box.width * width;
        const timestamp = history.windowStart + (position - pad.left) / (width - pad.left - pad.right) * (history.windowEnd - history.windowStart);
        setInspection(points.reduce((nearest, point) => Math.abs(point.timestamp - timestamp) < Math.abs(nearest.timestamp - timestamp) ? point : nearest));
      }} onPointerLeave={() => setInspection(null)} />}
    </svg>
    {!compact && <div className="plc-analysis-inspect" tabIndex={0} role="group" aria-label={`Inspect ${param.label} readings with left and right arrow keys`} onKeyDown={(event) => {
      if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return; event.preventDefault();
      const current = inspected ? points.findIndex((point) => point.timestamp === inspected.timestamp) : points.length - 1;
      setInspection(points[Math.max(0, Math.min(points.length - 1, current + (event.key === "ArrowLeft" ? -1 : 1)))]);
    }}><span>{inspected ? time(inspected.timestamp) : "Hover to inspect · arrow keys supported"}</span><strong aria-live="polite" aria-atomic="true">{inspected ? `${fmt(inspectedValue)} ${param.unit}` : `${points.length} ${history.source === "hourly-preview" ? "samples" : "received samples"}`}</strong></div>}
  </>}</div>;
}

function StatsStrip({ history, param }: { history: History; param: Param }) {
  const stats = summarizeSeries(history.points, param.nominal);
  return <dl className="plc-analysis-stats" aria-label={`${param.label} summary`}>{[{ label: "Average", value: stats.average, unit: param.unit }, { label: "Peak", value: stats.maximum, unit: param.unit }, { label: "Minimum", value: stats.minimum, unit: param.unit }, { label: "Statistical outliers", value: stats.count ? stats.outlierIndices.length : null, unit: "samples · 1.8σ" }].map((stat) => <div key={stat.label}><dt>{stat.label}</dt><dd>{fmt(stat.value)}<small>{stat.unit}</small></dd></div>)}</dl>;
}
function SignalDistribution({ history, param }: { history: History; param: Param }) {
  const stats = summarizeSeries(history.points, param.nominal); const bins = distributionBins(history.points); const most = Math.max(1, ...bins.map((bin) => bin.count));
  const position = (value: number) => Math.max(0, Math.min(100, (value - param.min) / (param.max - param.min) * 100));
  return <aside className="plc-analysis-detail" style={accent(param.color)} aria-label="Signal characteristics"><section><h4>Reading distribution</h4><p>{history.source === "hourly-preview" ? "Frequency of values in this window" : "How often each value was received"}</p>
    <svg viewBox="0 0 240 110" role="img" aria-label={stats.count ? `${stats.count} readings in ${bins.length} distribution bins` : "Distribution awaiting readings"}><line x1="0" x2="240" y1="88" y2="88" className="plc-analysis-gridline" />{bins.map((bin, index) => <rect key={index} x={index * 240 / bins.length + 2} y={88 - bin.count / most * 70} width={Math.max(1, 240 / bins.length - 4)} height={bin.count / most * 70} fill={param.color} opacity={.35 + bin.count / most * .55}><title>{fmt(bin.low)}–{fmt(bin.high)} {param.unit}: {bin.count} samples</title></rect>)}{bins.length > 0 && <><text x="0" y="108">{fmt(bins[0].low)}</text><text x="240" y="108" textAnchor="end">{fmt(bins.at(-1)!.high)} {param.unit}</text></>}</svg>
    <dl className="plc-analysis-inline"><div><dt>Spread (σ)</dt><dd>{fmt(stats.standardDeviation)} <small>{param.unit}</small></dd></div><div><dt>Samples</dt><dd>{stats.count || "—"}</dd></div></dl></section>
    <section><h4>Position in range</h4><div className="plc-analysis-ruler" aria-label={`${param.label} position; nominal ${param.nominal} ${param.unit}; latest ${fmt(stats.latest)}`}><span style={{ left: `${position(param.nominal)}%` }} title="Nominal" />{stats.latest !== null && <i style={{ left: `${position(stats.latest)}%` }} title={history.source === "hourly-preview" ? "Latest value" : "Latest received reading"} />}</div><div className="plc-analysis-ruler-labels"><span>{param.min}</span><span>Nominal {param.nominal}</span><span>{param.max} {param.unit}</span></div>
    <dl className="plc-analysis-deviations">{[{ label: "Current deviation", value: stats.currentDeviation }, { label: "Average deviation", value: stats.averageDeviation }, { label: "Max deviation", value: stats.maxDeviation }].map((item) => <div key={item.label}><dt>{item.label}</dt><dd>{fmt(item.value)} <small>{param.unit}</small></dd></div>)}</dl></section>
    <p className="plc-analysis-note">Distribution and outliers describe {history.source === "hourly-preview" ? "chart samples" : "received samples"}. They do not change machine safety thresholds.</p></aside>;
}
function ChannelSelector({ param, range, selected, onSelect }: { param: Param; range: AnalyticsTimeRange; selected: boolean; onSelect: () => void }) {
  const history = usePLCTrendHistory(param.id, range); const stats = summarizeSeries(history.points, param.nominal);
  return <button className="plc-analysis-channel" style={accent(param.color)} aria-pressed={selected} onClick={onSelect} aria-label={`Inspect ${param.label}`}><span><i aria-hidden="true" />{param.label}</span><strong>{fmt(stats.latest)}<small>{param.unit}</small></strong><span className="plc-analysis-channel-meta">{history.loading ? "Loading" : history.source === "hourly-preview" ? "1-hour trend" : history.source === "sitewise" ? "Historian" : history.source === "mqtt+sitewise" ? "Historian + MQTT" : history.lastUpdated === null ? "No readings" : history.windowEnd - history.lastUpdated > 15_000 ? "Last received" : "MQTT"}<ArrowUpRight size={13} aria-hidden="true" /></span></button>;
}
function HistorianMetrics({ param }: { param: Param }) {
  const [result, setResult] = useState<{ id: SiteWiseProperty; metrics: MetricsResult } | null>(null);
  useEffect(() => { if (!isSiteWiseConfigured()) return; let cancelled = false; fetchMetrics(param.id).then((metrics) => { if (!cancelled) setResult({ id: param.id, metrics }); }).catch(() => { if (!cancelled) setResult(null); }); return () => { cancelled = true; }; }, [param.id]);
  if (!isSiteWiseConfigured()) return null; const metrics = result?.id === param.id ? result.metrics : null;
  return <section className="plc-analysis-historian"><span><Database size={15} />SiteWise computed · 1h</span><span>Average <strong>{fmt(metrics?.avg_1h?.value)} {param.unit}</strong></span><span>Maximum <strong>{fmt(metrics?.max_1h?.value)} {param.unit}</strong></span></section>;
}
function TrendView({ param, history }: { param: Param; history: History }) {
  const [deviation, setDeviation] = useState(false); const [fullRange, setFullRange] = useState(false); const latest = summarizeSeries(history.points, param.nominal).latest;
  const preview = history.source === "hourly-preview";
  const exportHistory = () => {
    const rows = history.points.map((point) => [new Date(point.timestamp).toISOString(), point.value, param.unit, history.source]);
    const csv = [["Timestamp", "Value", "Unit", "Source"], ...rows].map((row) => row.map((cell) => `"${String(cell).replaceAll('"', '""')}"`).join(",")).join("\n");
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" })); const link = document.createElement("a"); link.href = url; link.download = `${param.id}-${preview ? "trend" : "received"}-history.csv`; link.click(); URL.revokeObjectURL(url);
  };
  return <><div className="plc-analysis-trend-layout"><section className="plc-analysis-signal" style={accent(param.color)}>
    <div className="plc-analysis-signal-heading"><div><h3>{param.label} history</h3><p>{preview ? "Last hour · 15-second intervals" : history.lastUpdated === null ? "No measurement received" : `Last measurement ${time(history.lastUpdated)}`}</p><SourceState history={history} /></div><div className="plc-analysis-reading"><strong>{fmt(latest)}<small>{param.unit}</small></strong><span>{preview ? "Latest value" : "Latest received"}</span></div></div>
    <div className="plc-analysis-plot-tools"><div className="plc-analysis-segment" aria-label="Plot mode"><button aria-pressed={!deviation} onClick={() => setDeviation(false)}>Signal</button><button aria-pressed={deviation} onClick={() => setDeviation(true)}>Nominal deviation</button></div><div className="plc-analysis-segment" aria-label="Chart scale"><button aria-pressed={!fullRange} onClick={() => setFullRange(false)}>Auto</button><button aria-pressed={fullRange} onClick={() => setFullRange(true)}>Full range</button></div></div>
    <SignalPlot history={history} param={param} deviation={deviation} fullRange={fullRange} /><StatsStrip history={history} param={param} />
    <div className="plc-analysis-chart-footer"><span><i style={{ background: param.color }} />{preview ? "Signal values" : "Received values"}<span className="plc-analysis-dashed" />Nominal</span><button disabled={!history.points.length} onClick={exportHistory}><ArrowDownToLine size={14} />Export CSV</button></div></section><SignalDistribution history={history} param={param} /></div>{!preview && <HistorianMetrics param={param} />}</>;
}
function SensorOverview({ param, range, onSelect }: { param: Param; range: AnalyticsTimeRange; onSelect: () => void }) {
  const history = usePLCTrendHistory(param.id, range); const stats = summarizeSeries(history.points, param.nominal);
  return <section className="plc-analysis-overview-signal" style={accent(param.color)}><header><button onClick={onSelect}>{param.label}<ArrowUpRight size={15} /></button><strong>{fmt(stats.latest)} <small>{param.unit}</small></strong></header><SourceState history={history} /><SignalPlot history={history} param={param} compact /><dl className="plc-analysis-inline"><div><dt>Average</dt><dd>{fmt(stats.average)}</dd></div><div><dt>Min / max</dt><dd>{fmt(stats.minimum)} / {fmt(stats.maximum)}</dd></div><div><dt>Samples</dt><dd>{stats.count || "—"}</dd></div></dl></section>;
}
function DigitalHistory({ param, range, alert = false }: { param: Param; range: AnalyticsTimeRange; alert?: boolean }) {
  const history = usePLCAnalyticsHistory(param.id, range); const stats = summarizeDigital(history.points); const stale = history.source === "mqtt" && history.lastUpdated !== null && history.windowEnd - history.lastUpdated > 15_000;
  return <section className="plc-analysis-digital" style={accent(param.color)}><header><div><h3>{param.label}</h3><SourceState history={history} /></div><span className="plc-analysis-bit" data-active={stats.latest === 1}>{stats.latest === null ? "No history" : `${stale ? "Last: " : ""}${stats.latest ? alert ? "Active" : "ON" : alert ? "Clear" : "OFF"}`}</span></header><SignalPlot history={history} param={param} compact digital /><dl className="plc-analysis-inline"><div><dt>{alert ? "Activations" : "Transitions"}</dt><dd>{stats.totalSamples ? alert ? stats.activations : stats.transitions : "—"}</dd></div><div><dt>ON samples</dt><dd>{fmt(stats.onSamplePercent, 1)}{stats.onSamplePercent !== null ? "%" : ""}</dd></div><div><dt>Received samples</dt><dd>{stats.totalSamples || "—"}</dd></div></dl></section>;
}
function RelayChannel({ index, range }: { index: number; range: AnalyticsTimeRange }) {
  const history = usePLCAnalyticsHistory(`relay_ch${index}`, range); const latest = summarizeDigital(history.points).latest;
  return <div data-active={latest === 1}><span>CH{index}</span><i aria-hidden="true" /><strong>{latest === null ? "—" : latest ? "ON" : "OFF"}</strong></div>;
}
function RelayStatus({ range }: { range: AnalyticsTimeRange }) {
  return <section className="plc-analysis-relays"><header><h3>8-channel relay feedback</h3><p>Last reported state in the selected window</p></header><div className="plc-analysis-relay-grid">{Array.from({ length: 8 }, (_, index) => <RelayChannel key={index} index={index} range={range} />)}</div></section>;
}
function ShiftComparison({ param }: { param: Param }) {
  const [duration, setDuration] = useState<"1h" | "6h" | "24h">("6h"); const current = usePLCAnalyticsHistory(param.id, duration); const previous = usePLCAnalyticsHistory(param.id, duration, ANALYTICS_RANGE_CONFIGS[duration].durationMs);
  const currentStats = summarizeSeries(current.points, param.nominal), previousStats = summarizeSeries(previous.points, param.nominal); const delta = currentStats.average !== null && previousStats.average !== null ? currentStats.average - previousStats.average : null;
  return <section className="plc-analysis-shifts"><header><div><h3>Compare adjacent periods</h3><p>Current window and the immediately preceding window, from the historian.</p></div><div className="plc-analysis-segment" aria-label="Comparison duration">{(["1h", "6h", "24h"] as const).map((value) => <button key={value} aria-pressed={duration === value} onClick={() => setDuration(value)}>{value}</button>)}</div></header><div className="plc-analysis-shift-plots">{[{ label: "Current period", history: current }, { label: "Previous period", history: previous }].map((period) => <section key={period.label}><h4>{period.label}</h4><SourceState history={period.history} /><SignalPlot param={param} history={period.history} compact /></section>)}</div><dl className="plc-analysis-stats"><div><dt>Current average</dt><dd>{fmt(currentStats.average)}<small>{param.unit}</small></dd></div><div><dt>Previous average</dt><dd>{fmt(previousStats.average)}<small>{param.unit}</small></dd></div><div><dt>Difference</dt><dd>{delta === null ? "—" : `${delta > 0 ? "+" : ""}${fmt(delta)}`}<small>{param.unit}</small></dd></div></dl></section>;
}

function AnalyticsWorkspace({ onClose }: { onClose: () => void }) {
  const [selected, setSelected] = useState<SiteWiseProperty>("voltage"); const [range, setRange] = useState<AnalyticsTimeRange>("1m"); const [view, setView] = useState<(typeof VIEWS)[number]["id"]>("trends");
  const dialog = useRef<HTMLDivElement>(null); const close = useRef<HTMLButtonElement>(null); const param = ANALOG.find((item) => item.id === selected) ?? ANALOG[0]; const history = usePLCTrendHistory(param.id, range);
  const preview = history.source === "hourly-preview" && (view === "trends" || view === "sensors");
  const dismiss = useRef(onClose);
  useEffect(() => { dismiss.current = onClose; }, [onClose]);
  useEffect(() => {
    const prior = document.activeElement instanceof HTMLElement ? document.activeElement : null; const priorOverflow = document.body.style.overflow; document.body.style.overflow = "hidden"; close.current?.focus();
    const keyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") { event.preventDefault(); dismiss.current(); } if (event.key !== "Tab") return;
      const controls = Array.from(dialog.current?.querySelectorAll<HTMLElement>('button:not(:disabled), [tabindex="0"], a[href], input, select') ?? []).filter((element) => element.getClientRects().length > 0);
      if (!controls.length) return; const first = controls[0], last = controls.at(-1)!;
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); } else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
    };
    window.addEventListener("keydown", keyDown); return () => { document.body.style.overflow = priorOverflow; window.removeEventListener("keydown", keyDown); prior?.focus(); };
  }, []);
  const choose = (id: SiteWiseProperty) => { setSelected(id); setView("trends"); };
  return <div className="plc-analysis-overlay"><div className="plc-analysis-backdrop" onClick={onClose} /><div ref={dialog} className="plc-analysis" role="dialog" aria-modal="true" aria-labelledby="plc-analysis-title">
    <header className="plc-analysis-header"><div><h2 id="plc-analysis-title">PLC Analytics</h2><p>Explore sensor history, events and shift performance.</p></div><div><span className="plc-analysis-header-source"><Database size={14} />{preview ? "Sensor trends" : "Received data only"}</span><button ref={close} className="plc-analysis-close" onClick={onClose} aria-label="Close analytics"><X size={19} /></button></div></header>
    <div className="plc-analysis-body"><aside className="plc-analysis-nav"><nav aria-label="Analytics views">{VIEWS.map((item) => <button key={item.id} aria-current={view === item.id ? "page" : undefined} onClick={() => setView(item.id)}><item.icon size={17} />{item.label}</button>)}</nav><div className="plc-analysis-provenance"><Database size={18} /><strong>{preview ? "Sensor history" : "Received data only"}</strong><p>{preview ? "Explore signal variation, distribution and nominal deviation." : "MQTT session history and connected SiteWise records."}</p><span><Clock3 size={12} />{preview ? "One-hour window" : "Measurement timestamps"}</span></div></aside>
    <div className="plc-analysis-content"><div className="plc-analysis-toolbar"><h3>{VIEWS.find((item) => item.id === view)!.label}</h3>{view !== "shifts" && <div className="plc-analysis-ranges" aria-label="History time range">{ANALYTICS_RANGES.map((value) => <button key={value} aria-pressed={range === value} onClick={() => setRange(value)}>{value}</button>)}</div>}</div>
      {view === "trends" && <div className="plc-analysis-channels" aria-label="Analog channels">{ANALOG.map((item) => <ChannelSelector key={item.id} param={item} range={range} selected={selected === item.id} onSelect={() => choose(item.id)} />)}</div>}
      {view === "shifts" && <div className="plc-analysis-shift-channel-select" aria-label="Comparison sensor">{ANALOG.map((item) => <button key={item.id} style={accent(item.color)} aria-pressed={selected === item.id} onClick={() => setSelected(item.id)}><i aria-hidden="true" />{item.label}</button>)}</div>}
      {view === "trends" && <TrendView param={param} history={history} />}
      {view === "sensors" && <div className="plc-analysis-overview">{ANALOG.map((item) => <SensorOverview key={item.id} param={item} range={range} onSelect={() => choose(item.id)} />)}</div>}
      {view === "digital" && <><p className="plc-analysis-view-note">Timestamped state transitions. ON percentage counts received samples.</p><div className="plc-analysis-digital-grid">{DIGITAL.map((item) => <DigitalHistory key={item.id} param={item} range={range} />)}</div><RelayStatus range={range} /></>}
      {view === "alerts" && <><p className="plc-analysis-view-note">Activations count OFF → ON transitions. An active lamp is not itself a dedicated emergency-stop input.</p><div className="plc-analysis-digital-grid">{ALERTS.map((item) => <DigitalHistory key={item.id} param={item} range={range} alert />)}</div></>}
      {view === "shifts" && <ShiftComparison param={param} />}
    </div></div>
  </div></div>;
}
export default function KPIAnalyticsPanel({ open, onClose }: { open: boolean; onClose: () => void }) { return open ? <AnalyticsWorkspace onClose={onClose} /> : null; }
