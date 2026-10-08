import { useEffect, useRef, useState, type CSSProperties } from "react";
import { createPortal } from "react-dom";
import { Activity, ArrowUpRight, Battery, ChevronDown, Clock3, Code2, Droplets, Radio, RadioTower, Thermometer, Waves, X } from "lucide-react";
import { useLorawanSensors, type LorawanDevice, type LorawanReading } from "../hooks/useLorawanSensors";
import { LORA_METRICS, receivedMetric, receivedSeries, receivedSummary, relativePacketAge, type LoraMetric } from "./lorawan/lorawanModel";
import "./lorawan-workspace.css";

interface LorawanDetailDrawerProps { open: boolean; onClose: () => void }
const METRIC_ICONS = { soilMoisturePct: Droplets, soilTempC: Thermometer, conductivityUsCm: Waves, batteryV: Battery };

/** A received-packet workspace. The existing public component name is retained for callers. */
export default function LorawanDetailDrawer({ open, onClose }: LorawanDetailDrawerProps) {
  const { list, totalReadings, lastReading } = useLorawanSensors();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [metric, setMetric] = useState<LoraMetric>("soilMoisturePct");
  const [now, setNow] = useState(() => Date.now());
  const dialogRef = useRef<HTMLDivElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const dismiss = useRef(onClose);
  useEffect(() => { dismiss.current = onClose; }, [onClose]);
  useEffect(() => {
    if (!open) return;
    const tick = setInterval(() => setNow(Date.now()), 1000);
    const previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    closeRef.current?.focus();
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") { event.preventDefault(); dismiss.current(); return; }
      if (event.key !== "Tab") return;
      const controls = [...(dialogRef.current?.querySelectorAll<HTMLElement>('button:not(:disabled), summary, a[href], [tabindex="0"]') ?? [])].filter((element) => !element.closest("details:not([open])") || element.tagName === "SUMMARY");
      const first = controls[0]; const last = controls.at(-1);
      if (event.shiftKey && (document.activeElement === first || !dialogRef.current?.contains(document.activeElement))) { event.preventDefault(); last?.focus(); }
      else if (!event.shiftKey && (document.activeElement === last || !dialogRef.current?.contains(document.activeElement))) { event.preventDefault(); first?.focus(); }
    };
    document.addEventListener("keydown", onKey);
    return () => { clearInterval(tick); document.removeEventListener("keydown", onKey); document.body.style.overflow = previousOverflow; if (previousFocus?.isConnected) previousFocus.focus(); };
  }, [open]);
  if (!open) return null;
  const selected = list.find((device) => device.devEui === selectedId) ?? list[0] ?? null;
  const summary = receivedSummary(list);
  const recent = lastReading !== null && now - lastReading.receivedAt < 180_000;
  return createPortal(<div className="lora-workspace-overlay">
    <div className="lora-workspace-backdrop" data-testid="lorawan-backdrop" onClick={onClose} />
    <div className="lora-workspace-dialog" role="dialog" aria-modal="true" aria-labelledby="lora-workspace-title" ref={dialogRef}>
      <header className="lora-workspace-header">
        <div className="lora-workspace-title"><RadioTower size={26} strokeWidth={1.5} /><div><h2 id="lora-workspace-title">LoRaWAN sensors</h2><p>Soil and irrigation telemetry</p></div></div>
        <div className="lora-workspace-header-actions"><span className={`lora-workspace-receipt ${recent ? "is-recent" : ""}`}><i />{lastReading ? recent ? "Receiving packets" : "No recent packets" : "Awaiting gateway"}</span><button type="button" ref={closeRef} onClick={onClose} aria-label="Close LoRaWAN sensors"><X size={20} /></button></div>
      </header>
      <div className="lora-workspace-summary" aria-label="Received network summary">
        <div><span>Devices</span><strong>{list.length}</strong></div><div><span>Session packets</span><strong>{totalReadings.toLocaleString()}</strong></div><div><span>Average moisture</span><strong>{summary.moisture === null ? "—" : summary.moisture.toFixed(1)}<small>{summary.moisture === null ? "" : "%"}</small></strong></div><div><span>Lowest battery</span><strong>{summary.battery === null ? "—" : summary.battery.toFixed(2)}<small>{summary.battery === null ? "" : "V"}</small></strong></div><span className="lora-workspace-latest"><Clock3 size={15} />{lastReading ? relativePacketAge(lastReading.receivedAt, now) : "No packet received"}</span>
      </div>
      <div className="lora-workspace-body">
        <aside className="lora-workspace-devices" aria-label="LoRaWAN devices"><div className="lora-workspace-section-title"><h3>Devices</h3><span>{list.length}</span></div>
          {list.length ? <nav aria-label="Select LoRaWAN device">{list.map((device) => <DeviceButton key={device.devEui} device={device} selected={selected?.devEui === device.devEui} now={now} onSelect={() => setSelectedId(device.devEui)} />)}</nav> : <p className="lora-workspace-device-empty">Devices appear when the gateway sends a packet.</p>}
          <div className="lora-workspace-source"><Radio size={18} /><strong>Received gateway data</strong><code>lorawan/data</code><p>History contains packets received during this session.</p></div>
        </aside>
        <main className="lora-workspace-content">
          {selected ? <>
            <div className="lora-workspace-device-heading"><div><h3>{selected.deviceName}</h3><code>{selected.devEui}</code></div><span><Clock3 size={14} />{relativePacketAge(selected.latest.receivedAt, now)}</span></div>
            <section className="lora-workspace-instruments" aria-label="Selected device measurements">{LORA_METRICS.map((definition) => <MetricInstrument key={definition.key} reading={selected.latest} metric={definition.key} active={metric === definition.key} onSelect={() => setMetric(definition.key)} />)}</section>
            <div className="lora-workspace-analysis"><HistoryChart device={selected} metric={metric} /><DeviceComparison list={list} selectedId={selected.devEui} metric={metric} onSelect={setSelectedId} /></div>
            <PacketDetails reading={selected.latest} />
          </> : <div className="lora-workspace-empty"><RadioTower size={52} strokeWidth={1.2} /><h3>Waiting for the first packet</h3><p>Open this workspace when the LoRaWAN gateway is publishing. Device measurements, comparisons and history will appear here.</p><code>lorawan/data</code></div>}
        </main>
      </div>
      <footer className="lora-workspace-footer"><span><i />Received measurements only</span><span>{list.length ? `${list.length} device${list.length === 1 ? "" : "s"} discovered` : "Listening for gateway packets"}</span></footer>
    </div>
  </div>, document.body);
}

function DeviceButton({ device, selected, now, onSelect }: { device: LorawanDevice; selected: boolean; now: number; onSelect: () => void }) {
  const moisture = receivedMetric(device.latest, "soilMoisturePct");
  const battery = receivedMetric(device.latest, "batteryV");
  const recent = now - device.latest.receivedAt < 180_000;
  return <button type="button" className="lora-workspace-device-button" aria-current={selected ? "true" : undefined} aria-label={`Inspect ${device.deviceName}`} onClick={onSelect}><span className="lora-workspace-device-button-name"><Radio size={16} /><strong>{device.deviceName}</strong><ArrowUpRight size={14} /></span><code>{device.devEui}</code><span className="lora-workspace-device-button-values"><span>{moisture === null ? "No moisture reading" : `${moisture.toFixed(1)}% moisture`}</span><span>{battery === null ? "— V" : `${battery.toFixed(2)} V`}</span></span><span className={`lora-workspace-device-age ${recent ? "is-recent" : ""}`}><i />{relativePacketAge(device.latest.receivedAt, now)}</span></button>;
}

function MetricInstrument({ reading, metric, active, onSelect }: { reading: LorawanReading; metric: LoraMetric; active: boolean; onSelect: () => void }) {
  const definition = LORA_METRICS.find((item) => item.key === metric)!;
  const value = receivedMetric(reading, metric);
  const Icon = METRIC_ICONS[metric];
  return <button type="button" className="lora-workspace-instrument" style={{ "--lora-metric-color": definition.color } as CSSProperties} aria-pressed={active} onClick={onSelect} aria-label={`Show ${definition.label.toLowerCase()} history`}><span className="lora-workspace-instrument-label"><Icon size={16} />{definition.label}</span><strong>{value === null ? "—" : value.toFixed(definition.decimals)}<small>{definition.unit}</small></strong><InstrumentGraphic metric={metric} value={value} /><span className="lora-workspace-instrument-caption">{value === null ? "Not reported" : "Latest received"}</span></button>;
}

function InstrumentGraphic({ metric, value }: { metric: LoraMetric; value: number | null }) {
  const bounded = (lo: number, hi: number) => value === null ? 0 : Math.max(0, Math.min(1, (value - lo) / (hi - lo)));
  return <svg className="lora-workspace-instrument-graphic" viewBox="0 0 160 65" aria-hidden="true">
    {metric === "soilMoisturePct" ? <><path className="lora-workspace-graphic-base" d="M8 14h144v37H8z" /><path className="lora-workspace-graphic-base" d="M8 25h144M8 38h144" />{value !== null && <rect x="8" y={51 - bounded(0, 100) * 37} width="144" height={bounded(0, 100) * 37} className="lora-workspace-graphic-fill" />}<path d={`M8 ${51 - bounded(0, 100) * 37}h144`} stroke="currentColor" strokeWidth="2" strokeDasharray={value === null ? "4 5" : undefined} /><text x="8" y="63">0</text><text x="152" y="63" textAnchor="end">100%</text></> : metric === "soilTempC" ? <><path className="lora-workspace-graphic-base" d="M11 32h139" />{[0, 1, 2, 3, 4, 5, 6].map((i) => <path key={i} className="lora-workspace-graphic-base" d={`M${11 + i * 23} 25v14`} />)}{value !== null && <><path d={`M11 32h${bounded(-20, 60) * 139}`} stroke="currentColor" strokeWidth="5" /><circle cx={11 + bounded(-20, 60) * 139} cy="32" r="6" fill="currentColor" /></>}<text x="11" y="58">−20</text><text x="150" y="58" textAnchor="end">60°C</text></> : metric === "conductivityUsCm" ? <>{Array.from({ length: 12 }, (_, index) => <rect key={index} x={8 + index * 12} y={41 - index * 2} width="7" height={10 + index * 2} rx="1" className={value !== null && index / 12 < bounded(0, 2000) ? "lora-workspace-graphic-fill" : "lora-workspace-graphic-base"} />)}<path className="lora-workspace-graphic-base" d="M8 54h144" /><text x="8" y="65">0</text><text x="152" y="65" textAnchor="end">2,000</text></> : <><rect className="lora-workspace-graphic-base" x="17" y="14" width="123" height="35" rx="4" /><path className="lora-workspace-graphic-base" d="M142 24h6v15h-6" />{[0, 1, 2, 3, 4, 5].map((index) => <rect key={index} x={23 + index * 19} y="20" width="14" height="23" rx="1" className={value !== null && index / 6 < bounded(3, 3.7) ? "lora-workspace-graphic-fill" : "lora-workspace-graphic-base"} />)}<text x="17" y="64">3.0</text><text x="140" y="64" textAnchor="end">3.7 V</text></>}
  </svg>;
}

function HistoryChart({ device, metric }: { device: LorawanDevice; metric: LoraMetric }) {
  const definition = LORA_METRICS.find((item) => item.key === metric)!;
  const series = receivedSeries(device, metric);
  const values = series.map((point) => point.value);
  const minimum = values.length ? Math.min(...values) : null;
  const maximum = values.length ? Math.max(...values) : null;
  const average = values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : null;
  const padding = minimum !== null && maximum !== null ? Math.max((maximum - minimum) * .18, Math.abs(maximum) * .02, .2) : 1;
  const lo = (minimum ?? 0) - padding; const hi = (maximum ?? 1) + padding;
  const firstTs = series[0]?.timestamp ?? 0; const lastTs = series.at(-1)?.timestamp ?? firstTs;
  const x = (timestamp: number) => series.length === 1 ? 353 : 48 + (timestamp - firstTs) / Math.max(1, lastTs - firstTs) * 610;
  const y = (value: number) => 176 - (value - lo) / (hi - lo) * 147;
  const points = series.map((point) => `${x(point.timestamp)},${y(point.value)}`).join(" ");
  return <section className="lora-workspace-history" style={{ "--lora-metric-color": definition.color } as CSSProperties}><div className="lora-workspace-section-title"><h3><Activity size={17} />{definition.label} history</h3><span>{series.length} received {series.length === 1 ? "sample" : "samples"}</span></div>
    {series.length ? <svg className="lora-workspace-history-chart" viewBox="0 0 680 212" role="img" aria-label={`${device.deviceName} ${definition.label.toLowerCase()} history, ${series.length} received samples, minimum ${minimum?.toFixed(definition.decimals)}, maximum ${maximum?.toFixed(definition.decimals)} ${definition.unit}`}>
      {[0, 1, 2, 3].map((tick) => { const value = lo + (hi - lo) * tick / 3; return <g key={tick}><line x1="48" x2="658" y1={y(value)} y2={y(value)} /><text x="40" y={y(value) + 4} textAnchor="end">{value.toFixed(definition.decimals)}</text></g>; })}
      {series.length > 1 && <><polygon points={`48,176 ${points} 658,176`} fill="currentColor" opacity=".08" /><polyline points={points} fill="none" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" /></>}
      {series.map((point, index) => <circle key={`${point.timestamp}-${index}`} cx={x(point.timestamp)} cy={y(point.value)} r={index === series.length - 1 ? 3.5 : 2} fill="currentColor"><title>{formatTime(point.timestamp)} · {point.value.toFixed(definition.decimals)} {definition.unit}</title></circle>)}
      <text x="48" y="204">{formatTime(firstTs)}</text><text x="658" y="204" textAnchor="end">{series.length > 1 ? formatTime(lastTs) : "One packet received"}</text>
    </svg> : <div className="lora-workspace-history-empty"><Activity size={30} /><h4>No {definition.label.toLowerCase()} reported</h4><p>Only values included in received packets appear in this chart.</p></div>}
    <dl className="lora-workspace-history-stats"><div><dt>Average</dt><dd>{average === null ? "—" : average.toFixed(definition.decimals)}<small>{definition.unit}</small></dd></div><div><dt>Minimum</dt><dd>{minimum === null ? "—" : minimum.toFixed(definition.decimals)}<small>{definition.unit}</small></dd></div><div><dt>Maximum</dt><dd>{maximum === null ? "—" : maximum.toFixed(definition.decimals)}<small>{definition.unit}</small></dd></div></dl>
  </section>;
}

function DeviceComparison({ list, selectedId, metric, onSelect }: { list: LorawanDevice[]; selectedId: string; metric: LoraMetric; onSelect: (id: string) => void }) {
  const definition = LORA_METRICS.find((item) => item.key === metric)!;
  const values = list.map((device) => receivedMetric(device.latest, metric));
  const numeric = values.filter((value): value is number => value !== null);
  const lo = Math.min(0, ...numeric); const hi = Math.max(1, ...numeric);
  const origin = (0 - lo) / (hi - lo) * 100;
  return <section className="lora-workspace-comparison" style={{ "--lora-metric-color": definition.color } as CSSProperties}><div className="lora-workspace-section-title"><h3>Device comparison</h3></div><p>{definition.label} · latest packet</p><div>{list.map((device, index) => { const value = values[index]; const width = value === null ? 0 : Math.abs(value) / (hi - lo) * 100; return <button type="button" key={device.devEui} aria-label={`Compare ${device.deviceName}`} aria-current={selectedId === device.devEui ? "true" : undefined} onClick={() => onSelect(device.devEui)}><span>{device.deviceName}<strong>{value === null ? "—" : value.toFixed(definition.decimals)}<small>{definition.unit}</small></strong></span><span className="lora-workspace-comparison-track">{value !== null && <i style={{ left: `${value < 0 ? origin - width : origin}%`, width: `${width}%` }} />}{value === 0 && <b style={{ left: `${origin}%` }} />}</span>{value === null && <small>Not reported</small>}</button>; })}</div></section>;
}

function PacketDetails({ reading }: { reading: LorawanReading }) {
  const payload = { device_name: reading.deviceName, dev_eui: reading.devEui, ...(reading.sourceTs ? { timestamp: reading.sourceTs } : {}), ...Object.fromEntries(LORA_METRICS.flatMap((definition) => { const value = receivedMetric(reading, definition.key); return value === null ? [] : [[definition.payloadKey, value]]; })) };
  return <details className="lora-workspace-packet"><summary><span><Code2 size={16} />Latest received fields</span><span><Clock3 size={14} />{formatTime(reading.receivedAt)}<ChevronDown size={16} /></span></summary><div><dl><div><dt>Device identifier</dt><dd>{reading.devEui}</dd></div><div><dt>Source timestamp</dt><dd>{reading.sourceTs ?? "Not provided"}</dd></div><div><dt>Received locally</dt><dd>{new Date(reading.receivedAt).toLocaleString()}</dd></div></dl><pre>{JSON.stringify(payload, null, 2)}</pre></div></details>;
}

function formatTime(timestamp: number) { return new Date(timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" }); }
