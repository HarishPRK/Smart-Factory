import { useEffect, useId, useRef, useState, type CSSProperties } from "react";
import { Activity, ArrowDownRight, ArrowRight, ArrowUpRight, BrainCircuit, ChartNoAxesCombined, Check, ChevronRight, Clock3, Database, Gauge, Radio, ScanLine, ShieldCheck, Sparkles, TriangleAlert, Wrench, X } from "lucide-react";
import { Area, CartesianGrid, ComposedChart, Line, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { usePredictionStore } from "../stores/predictionStore";
import { requestAIAnalysis } from "../services/aiPredictionService";
import type { ParameterPrediction, RULEstimate, HealthScore, PredictionHorizon } from "../types/predictions";
import "./predictive-workspace.css";

interface PredictivePanelProps { open: boolean; onClose: () => void }
type TabId = "anomaly" | "maintenance" | "production" | "ai";
const TABS = [
  { id: "anomaly" as const, label: "Anomaly forecast", Icon: ChartNoAxesCombined },
  { id: "maintenance" as const, label: "Maintenance", Icon: Wrench },
  { id: "production" as const, label: "Production outlook", Icon: Gauge },
  { id: "ai" as const, label: "AI analysis", Icon: BrainCircuit },
];
const CHANNELS = [{ id: "voltage", label: "Voltage", color: "#f2ad67" }, { id: "current", label: "Current", color: "#43d8f1" }, { id: "ph", label: "pH", color: "#c7a4ed" }, { id: "temperature", label: "Temperature", color: "#f18b82" }];
const HORIZONS: { key: PredictionHorizon; minutes: number }[] = [{ key: "5min", minutes: 5 }, { key: "15min", minutes: 15 }, { key: "30min", minutes: 30 }];
const colorFor = (id: string) => CHANNELS.find((channel) => channel.id === id)?.color ?? "#43d8f1";
const accent = (color: string) => ({ "--predict-accent": color } as CSSProperties);
const number = (value: number) => Number.isFinite(value) ? value.toLocaleString(undefined, { minimumFractionDigits: 1, maximumFractionDigits: 1 }) : "—";
const fit = (value: number) => Number.isFinite(value) ? value.toFixed(2) : "—";
const minutesLabel = (minutes: number | null) => minutes === null ? "Not projected" : minutes < 1 ? "< 1 min" : minutes > 1440 ? `${number(minutes / 1440)} days` : minutes > 60 ? `${number(minutes / 60)} hours` : `${Math.round(minutes)} min`;
const coverage = (prediction: ParameterPrediction) => {
  const seconds = Math.max(0, ((prediction.observedUntil ?? 0) - (prediction.observedFrom ?? 0)) / 1000);
  return seconds >= 60 ? `${number(seconds / 60)} min` : `${Math.round(seconds)} sec`;
};

function EmptySignals() {
  return <div className="predict-empty" role="status"><Radio size={38} strokeWidth={1.2} /><h3>Listening for production signals</h3><p>Forecasts appear after at least five fresh PLC readings for a parameter. Missing or stale inputs are kept out of the model.</p><span>Voltage · Current · pH · Temperature</span></div>;
}

function FitLabel({ value }: { value: number }) {
  return <span className="predict-fit" title="R-squared describes how well a straight line fits the received readings. It is not a probability of failure."><span>Fit R²</span><strong>{fit(value)}</strong></span>;
}

function ObservedTrace({ prediction }: { prediction: ParameterPrediction }) {
  const data = prediction.history ?? [];
  if (data.length < 2) return null;
  const low = Math.min(...data.map((sample) => sample.value)), high = Math.max(...data.map((sample) => sample.value));
  const range = high - low || Math.max(.1, Math.abs(high) * .02);
  const span = data.at(-1)!.timestamp - data[0].timestamp || 1;
  const path = data.map((sample, i) => `${i ? "L" : "M"}${4 + (sample.timestamp - data[0].timestamp) / span * 192},${38 - (sample.value - low) / range * 28}`).join(" ");
  return <div className="predict-observed"><div><span>Received readings</span><small>{prediction.sampleCount} samples / {coverage(prediction)}</small></div><svg viewBox="0 0 200 48" role="img" aria-label={`${prediction.label}, ${prediction.sampleCount} received samples over ${coverage(prediction)}`}><line x1="0" y1="44" x2="200" y2="44" stroke="#2e4553" /><path d={path} fill="none" stroke={colorFor(prediction.parameterId)} strokeWidth="1.7" /></svg></div>;
}

function ProjectionChart({ prediction, horizon }: { prediction: ParameterPrediction; horizon: number }) {
  const id = useId().replace(/:/g, "");
  const fittedNow = prediction.predictions["5min"].value - prediction.rateOfChange * 5;
  const data = [
    { minute: 0, estimate: fittedNow, observed: prediction.currentValue, interval: [fittedNow, fittedNow] },
    ...HORIZONS.filter((item) => item.minutes <= horizon).map((item) => ({ minute: item.minutes, estimate: prediction.predictions[item.key].value, observed: undefined, interval: [prediction.predictions[item.key].confidenceLow, prediction.predictions[item.key].confidenceHigh] })),
  ];
  const color = colorFor(prediction.parameterId);
  return <div className="predict-chart" aria-label={`${prediction.label} forecast for the next ${horizon} minutes`}>
    <ResponsiveContainer width="100%" height="100%" minWidth={0}>
      <ComposedChart data={data} margin={{ top: 22, right: 26, bottom: 6, left: -8 }} accessibilityLayer>
        <defs><linearGradient id={id} x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor={color} stopOpacity={.24} /><stop offset="100%" stopColor={color} stopOpacity={.04} /></linearGradient></defs>
        <CartesianGrid vertical={false} stroke="#2e4553" strokeDasharray="3 6" />
        <XAxis dataKey="minute" type="number" domain={[0, horizon]} ticks={[0, ...HORIZONS.filter((item) => item.minutes <= horizon).map((item) => item.minutes)]} tickFormatter={(value: number) => value === 0 ? "Now" : `+${value} min`} tick={{ fill: "#a7bbc6", fontSize: 12 }} axisLine={false} tickLine={false} dy={8} />
        <YAxis domain={["auto", "auto"]} tickFormatter={(value: number) => number(value)} tick={{ fill: "#a7bbc6", fontSize: 11 }} axisLine={false} tickLine={false} width={65} />
        <Tooltip cursor={{ stroke: "#90aab7", strokeDasharray: "3 4" }} content={({ active, payload }) => {
          const point = payload?.[0]?.payload as typeof data[number] | undefined;
          return active && point ? <div className="predict-chart-tooltip"><strong>{point.minute ? `+${point.minute} minute projection` : "Current fit"}</strong><b>{number(point.estimate)} <small>{prediction.unit}</small></b><span>Interval {number(point.interval[0])} – {number(point.interval[1])}</span></div> : null;
        }} />
        <Area dataKey="interval" type="linear" fill={`url(#${id})`} stroke="none" isAnimationActive={false} />
        {prediction.thresholdCrossing?.willCross && <ReferenceLine y={prediction.thresholdCrossing.threshold} stroke="#e9bd70" strokeDasharray="5 5" ifOverflow="extendDomain" label={{ value: `Limit ${prediction.thresholdCrossing.threshold}`, position: "insideTopRight", fill: "#e9bd70", fontSize: 11 }} />}
        <Line dataKey="estimate" type="linear" stroke={color} strokeWidth={2.4} strokeDasharray="7 5" dot={{ r: 3.5, fill: "#17232d", strokeWidth: 2 }} activeDot={{ r: 5 }} isAnimationActive={false} />
        <Line dataKey="observed" stroke="none" dot={{ r: 5, fill: color, stroke: "#eef5f7", strokeWidth: 2 }} isAnimationActive={false} />
      </ComposedChart>
    </ResponsiveContainer>
  </div>;
}

function ForecastExplorer({ predictions }: { predictions: ParameterPrediction[] }) {
  const [selectedId, setSelectedId] = useState("voltage");
  const [horizon, setHorizon] = useState(30);
  const prediction = predictions.find((item) => item.parameterId === selectedId) ?? predictions[0];
  if (!prediction) return <EmptySignals />;
  const Direction = prediction.trendDirection === "rising" ? ArrowUpRight : prediction.trendDirection === "falling" ? ArrowDownRight : ArrowRight;
  const crossing = prediction.thresholdCrossing;
  const outsideRange = HORIZONS.some(({ key }) => prediction.predictions[key].value < prediction.min || prediction.predictions[key].value > prediction.max);
  return <div className="predict-explorer"><aside className="predict-signal-list" aria-label="Forecast parameters"><h3>Signals</h3>{CHANNELS.map((channel) => {
    const item = predictions.find((entry) => entry.parameterId === channel.id);
    return <button type="button" key={channel.id} style={accent(channel.color)} aria-pressed={prediction.parameterId === channel.id} disabled={!item} onClick={() => setSelectedId(channel.id)}><span className="predict-signal-name"><i />{channel.label}<ChevronRight size={15} /></span><strong>{item ? number(item.currentValue) : "—"}<small>{item?.unit}</small></strong><span className="predict-signal-state">{item ? <>{item.thresholdCrossing?.willCross ? <TriangleAlert size={12} /> : <Activity size={12} />}{item.thresholdCrossing?.willCross ? "Crossing projected" : "Tracking trend"}</> : "Awaiting readings"}</span></button>;
  })}<div className="predict-signal-note"><Radio size={15} /><span>Received PLC data<br /><small>Up to 100 samples per signal</small></span></div></aside>
    <div className="predict-forecast" style={accent(colorFor(prediction.parameterId))}><div className="predict-forecast-heading"><div><h3>{prediction.label} forecast</h3><p>Linear projection from the current observation window</p></div><FitLabel value={prediction.confidence} /></div>
      <div className="predict-reading-row"><div className="predict-current"><span>Latest received</span><strong>{number(prediction.currentValue)}<small>{prediction.unit}</small></strong><span className="predict-rate"><Direction size={17} />{prediction.rateOfChange > 0 ? "+" : ""}{prediction.rateOfChange.toFixed(2)} {prediction.rateOfChangeUnit}</span></div><ObservedTrace prediction={prediction} /><div className="predict-crossing" data-warning={crossing?.willCross || undefined}><span>{crossing?.willCross ? "Estimated threshold crossing" : "Threshold outlook"}</span><strong>{crossing?.willCross ? minutesLabel(crossing.minutesUntil) : "No crossing projected"}</strong><small>{crossing?.willCross ? `${crossing.direction === "above" ? "Above" : "Below"} ${crossing.threshold} ${prediction.unit}` : "Under the current linear fit"}</small></div></div>
      <div className="predict-chart-toolbar"><div className="predict-chart-legend"><span><i className="is-line" />Estimate</span><span><i />Model interval</span></div><div className="predict-horizon-controls" aria-label="Forecast horizon">{HORIZONS.map((item) => <button type="button" key={item.key} aria-pressed={horizon === item.minutes} onClick={() => setHorizon(item.minutes)}>{item.minutes} min</button>)}</div></div>
      <ProjectionChart key={prediction.parameterId} prediction={prediction} horizon={horizon} />
      <div className="predict-horizon-readings">{HORIZONS.map(({ key, minutes }) => <div key={key}><span>In {minutes} minutes</span><strong>{number(prediction.predictions[key].value)}<small>{prediction.unit}</small></strong><span>{number(prediction.predictions[key].confidenceLow)} – {number(prediction.predictions[key].confidenceHigh)}</span></div>)}</div>
      <p className={`predict-model-note ${outsideRange ? "is-warning" : ""}`}><TriangleAlert size={14} /><span>{outsideRange ? "This projection extends outside the sensor range. Treat the extrapolation as unreliable." : "The shaded interval is a statistical estimate, not a guaranteed operating range."} Fit R² measures trend fit, not failure probability.</span></p>
    </div>
  </div>;
}

function Maintenance({ predictions, estimates, health }: { predictions: ParameterPrediction[]; estimates: RULEstimate[]; health: HealthScore }) {
  if (!predictions.length) return <EmptySignals />;
  const next = estimates.filter((item) => item.estimatedMinutesRemaining !== null && item.trend === "degrading").sort((a, b) => a.estimatedMinutesRemaining! - b.estimatedMinutesRemaining!)[0];
  return <div className="predict-maintenance"><div className="predict-condition"><Gauge size={25} /><h3>Condition index</h3><div><strong>{health.overall}</strong><span>/100</span></div><div className="predict-condition-scale" role="meter" aria-label="Heuristic condition index" aria-valuenow={health.overall} aria-valuemin={0} aria-valuemax={100}><span style={{ transform: `scaleX(${health.overall / 100})` }} /></div><p>A weighted indicator of sensor position in range, adjusted for projected threshold crossings.</p><small>Heuristic estimate · not equipment health certification</small></div>
    <div className="predict-maintenance-main"><div className="predict-maintenance-next"><Wrench size={24} /><div><h3>{next ? `${next.label} reaches its configured limit first` : "No upward limit crossing projected"}</h3><p>{next ? `Estimated ${minutesLabel(next.estimatedMinutesRemaining)} · fit R² ${fit(next.confidence)}` : "Continue monitoring incoming readings and review site maintenance guidance."}</p></div></div><div className="predict-section-heading"><h3>Threshold proximity</h3><span>Latest reading against configured upper limit</span></div>
      <div className="predict-threshold-list">{estimates.map((item) => {
        const prediction = predictions.find((entry) => entry.parameterId === item.parameterId);
        if (!prediction) return null;
        const position = (value: number) => Math.max(0, Math.min(100, (value - prediction.min) / (prediction.max - prediction.min) * 100));
        return <section key={item.parameterId} style={accent(colorFor(item.parameterId))}><div><h4>{item.label}</h4><span>{number(prediction.currentValue)} {prediction.unit}</span></div><div className="predict-threshold-range"><span className="predict-threshold-marker" style={{ left: `${position(item.failureThreshold)}%` }} /><i style={{ left: `${position(prediction.currentValue)}%` }} /></div><div className="predict-threshold-caption"><span>Limit {item.failureThreshold} {prediction.unit}</span><span>{item.trend === "degrading" ? minutesLabel(item.estimatedMinutesRemaining) : "No crossing projected"}</span></div></section>;
      })}</div><p className="predict-model-note"><ShieldCheck size={15} />Time to a configured sensor limit is not validated remaining equipment life. These estimates issue no equipment commands.</p></div>
  </div>;
}

function Production({ predictions }: { predictions: ParameterPrediction[] }) {
  if (!predictions.length) return <EmptySignals />;
  return <div className="predict-production"><div className="predict-section-heading"><div><h3>30-minute sensor outlook</h3><p>Compare the latest reading with its projected movement.</p></div><span className="predict-source-chip"><Activity size={14} />Linear extrapolation</span></div><div className="predict-outlook-legend"><span><i />Received</span><span><i className="is-outline" />Projected</span></div>
    {predictions.map((prediction) => {
      const forecast = prediction.predictions["30min"].value, delta = forecast - prediction.currentValue;
      const position = (value: number) => Math.max(0, Math.min(100, (value - prediction.min) / (prediction.max - prediction.min) * 100));
      const current = position(prediction.currentValue), future = position(forecast), outside = forecast < prediction.min || forecast > prediction.max;
      return <section className="predict-outlook-row" key={prediction.parameterId} style={accent(colorFor(prediction.parameterId))}><h4>{prediction.label}<small>{prediction.unit}</small></h4><div><div className="predict-outlook-track"><span style={{ left: `${Math.min(current, future)}%`, width: `${Math.abs(current - future)}%` }} /><i style={{ left: `${current}%` }} /><i className="is-outline" style={{ left: `${future}%` }} /></div><div className="predict-outlook-range"><span>{prediction.min}</span><span>{prediction.max}</span></div></div><div className="predict-outlook-values"><strong>{number(prediction.currentValue)} <ArrowRight size={15} /> {number(forecast)}</strong><small>{outside ? "Outside sensor range" : `${delta > 0 ? "+" : ""}${number(delta)} ${prediction.unit} projected change`}</small></div></section>;
    })}<div className="predict-production-note"><Database size={21} /><div><h3>OEE requires production measurements</h3><p>Sensor trends alone do not establish future availability, output, or quality. Use the OEE Dashboard for received production rollups.</p></div></div></div>;
}

function AIAnalysis({ predictions, estimates, health }: { predictions: ParameterPrediction[]; estimates: RULEstimate[]; health: HealthScore }) {
  const analysis = usePredictionStore((state) => state.aiAnalysis), loading = usePredictionStore((state) => state.aiAnalysisLoading);
  const request = async () => {
    if (usePredictionStore.getState().aiAnalysisLoading || !predictions.length) return;
    usePredictionStore.setState({ aiAnalysisLoading: true });
    try { const result = await requestAIAnalysis(predictions, estimates, health); usePredictionStore.setState({ aiAnalysis: result }); }
    finally { usePredictionStore.setState({ aiAnalysisLoading: false }); }
  };
  return <div className="predict-ai"><aside className="predict-ai-context"><BrainCircuit size={30} strokeWidth={1.4} /><h3>Factory assessment</h3><p>Ask the connected Bedrock service to review the current signal trends and threshold estimates.</p><dl><div><dt>Parameters included</dt><dd>{predictions.length}</dd></div><div><dt>Model context</dt><dd>Current session</dd></div><div><dt>Execution</dt><dd>On request</dd></div></dl><button type="button" className="predict-primary" disabled={loading || !predictions.length} onClick={request}><Sparkles size={16} />{loading ? "Analyzing signals…" : analysis ? "Refresh assessment" : "Request AI analysis"}</button><small>Advisory only · no equipment commands</small></aside><div className="predict-ai-response" aria-busy={loading}>
    {loading ? <div className="predict-empty" role="status"><Activity size={32} /><h3>Reviewing the signal summary</h3><p>Waiting for a response from the configured AI service.</p></div> : analysis ? <><div className="predict-section-heading"><h3>{analysis.unavailable ? "Analysis unavailable" : "Assessment"}</h3><span>{new Date(analysis.timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</span></div>{!analysis.unavailable && analysis.riskLevel && <span className="predict-risk" data-risk={analysis.riskLevel}>{analysis.riskLevel} risk · AI assessment</span>}<p className="predict-assessment">{analysis.summary}</p>{analysis.recommendations.length > 0 && <section><h4>Recommended next steps</h4><ol>{analysis.recommendations.map((item, index) => <li key={index}>{item}</li>)}</ol></section>}{analysis.patterns.length > 0 && <section><h4>Patterns identified</h4><ul>{analysis.patterns.map((item, index) => <li key={index}>{item}</li>)}</ul></section>}</> : <div className="predict-empty"><ScanLine size={42} strokeWidth={1.2} /><h3>Turn observations into an assessment</h3><p>The analysis uses the received signal summary, regression fit, threshold projections, and condition index shown in this workspace.</p></div>}
  </div></div>;
}

export default function PredictivePanel({ open, onClose }: PredictivePanelProps) {
  const [activeTab, setActiveTab] = useState<TabId>("anomaly");
  const predictions = usePredictionStore((state) => state.parameterPredictions), estimates = usePredictionStore((state) => state.rulEstimates), health = usePredictionStore((state) => state.healthScore), alerts = usePredictionStore((state) => state.anomalyAlerts), computed = usePredictionStore((state) => state.lastComputedAt);
  const dialog = useRef<HTMLDivElement>(null), close = useRef<HTMLButtonElement>(null), dismiss = useRef(onClose);
  useEffect(() => { dismiss.current = onClose; }, [onClose]);
  useEffect(() => {
    if (!open) return;
    const previous = document.activeElement instanceof HTMLElement ? document.activeElement : null, overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden"; close.current?.focus();
    const keydown = (event: KeyboardEvent) => {
      if (event.key === "Escape") { event.preventDefault(); dismiss.current(); }
      if (event.key !== "Tab") return;
      const controls = [...(dialog.current?.querySelectorAll<HTMLElement>('button:not(:disabled), summary, [tabindex="0"]') ?? [])].filter((element) => element.getClientRects().length);
      const first = controls[0], last = controls.at(-1);
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
    };
    document.addEventListener("keydown", keydown);
    return () => { document.removeEventListener("keydown", keydown); document.body.style.overflow = overflow; previous?.focus(); };
  }, [open]);
  if (!open) return null;
  return <div className="predict-overlay"><div className="predict-backdrop" onClick={onClose} /><div className="predict-workspace" role="dialog" aria-modal="true" aria-labelledby="predict-title" ref={dialog}>
    <header className="predict-header"><div className="predict-title"><span><ChartNoAxesCombined size={23} /></span><div><h2 id="predict-title">Predictive Analytics</h2><p>Explore signal behavior. Anticipate threshold crossings.</p></div></div><div className="predict-header-actions"><span className="predict-source-chip"><Radio size={14} />{predictions.length ? "PLC observations" : "Awaiting signals"}</span><button type="button" ref={close} className="predict-close" onClick={onClose} aria-label="Close Predictive Analytics"><X size={20} /></button></div></header>
    <nav className="predict-tabs" role="tablist" aria-label="Predictive views">{TABS.map(({ id, label, Icon }, index) => <button type="button" role="tab" id={`predict-tab-${id}`} aria-selected={activeTab === id} aria-controls={`predict-panel-${id}`} tabIndex={activeTab === id ? 0 : -1} key={id} onClick={() => setActiveTab(id)} onKeyDown={(event) => {
      const next = event.key === "ArrowRight" ? (index + 1) % TABS.length : event.key === "ArrowLeft" ? (index + TABS.length - 1) % TABS.length : event.key === "Home" ? 0 : event.key === "End" ? TABS.length - 1 : null;
      if (next !== null) { event.preventDefault(); setActiveTab(TABS[next].id); document.getElementById(`predict-tab-${TABS[next].id}`)?.focus(); }
    }}><Icon size={16} />{label}</button>)}<span>{computed ? `Computed ${new Date(computed).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" })}` : "Collecting readings"}</span></nav>
    <div className="predict-scroll"><div className="predict-summary"><span><Database size={15} /><strong>{predictions.length}</strong> / 4 signals ready</span><span><Clock3 size={15} />5 · 15 · 30 minute projections</span><span className={alerts.length ? "has-alerts" : ""}>{alerts.length ? <TriangleAlert size={15} /> : <Check size={15} />}{alerts.length ? `${alerts.length} trend notice${alerts.length === 1 ? "" : "s"}` : predictions.length ? "No trend notices" : "Waiting for observations"}</span></div>
      {alerts.length > 0 && <details className="predict-notices"><summary><TriangleAlert size={15} />Review trend notices<ChevronRight size={15} /></summary><ul>{alerts.map((alert) => <li key={alert.id}><span>{alert.message}</span><small>Fit R² {fit(alert.confidence)}</small></li>)}</ul></details>}
      <div role="tabpanel" id={`predict-panel-${activeTab}`} aria-labelledby={`predict-tab-${activeTab}`} tabIndex={0} className="predict-tab-content">
        {activeTab === "anomaly" && <ForecastExplorer predictions={predictions} />}
        {activeTab === "maintenance" && <Maintenance predictions={predictions} estimates={estimates} health={health} />}
        {activeTab === "production" && <Production predictions={predictions} />}
        {activeTab === "ai" && <AIAnalysis predictions={predictions} estimates={estimates} health={health} />}
      </div>
      <details className="predict-provenance"><summary><Database size={15} />Where these predictions come from<ChevronRight size={15} /></summary><div><section><h4>Received PLC signals</h4><p>Voltage, current, pH and temperature arrive through the configured PLC connection. Up to 100 real readings and their receipt times are retained per signal in this browser session.</p></section><section><h4>Local statistical model</h4><p>Linear regression recomputes every two seconds. Projections, intervals and threshold estimates use the same window. SiteWise history and a trained failure model are not used here.</p></section><section><h4>Optional AI assessment</h4><p>On request, the current summary goes to <code>/api/factory-ai/chat</code>, backed by the configured AWS Bedrock service. Estimates remain advisory.</p></section></div></details>
    </div><footer className="predict-footer"><span><Activity size={13} />Observed inputs · estimated outcomes</span><span>Session-based analysis · review operating limits before acting</span></footer>
  </div></div>;
}
