import { useState } from "react";
import { Activity, ArrowUpRight, Clock3, GitCompareArrows, Waves } from "lucide-react";
import { formatNamespaceValue, namespaceTopics, type NamespaceNode } from "./namespaceModel";
import { namespaceTraffic, numericFieldStats, topicCadence } from "./namespaceMetrics";

const timeLabel = (timestamp: number) => new Date(timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" });
const duration = (ms: number) => ms < 1000 ? `${Math.round(ms)} ms` : `${(ms / 1000).toFixed(2)} s`;
const magnitude = (value: number) => Number(value.toPrecision(5)).toLocaleString();
const bytes = (value: number) => value < 1024 ? `${value.toLocaleString()} B` : `${(value / 1024).toFixed(1)} KiB`;
type Traffic = ReturnType<typeof namespaceTraffic>;

function TrafficPlot({ traffic }: { traffic: Traffic }) {
  const [cursor, setCursor] = useState<number | null>(null);
  const { bins, series, peak, start, totals } = traffic;
  const chosen = cursor ?? 59;
  const top = Math.max(1, peak);
  const plotted = series.slice(0, 7).map((row) => ({ id: row.node.path, label: row.node.name, color: row.color, bins: row.bins }));
  if (series.length > 7) plotted.push({ id: "__other__", label: "Other topics", color: "#a7bbc6", bins: bins.map((_, i) => series.slice(7).reduce((sum, row) => sum + row.bins[i], 0)) });
  return <section className="uns-traffic-plot" aria-label="Traffic timeline">
    <div className="uns-diagnostic-heading"><div><h3><Activity size={19} />Message traffic</h3><p>Each stack is one second of received messages.</p></div><span className="uns-window-label">Last 60 seconds</span></div>
    <div className="uns-plot-facts"><span><b>{totals.messages.toLocaleString()}</b> messages</span><span><b>{peak}</b> peak / second</span><span><b>{bytes(totals.bytes)}</b> serialized JSON</span></div>
    <svg viewBox="0 0 820 255" className="uns-large-plot" role="img" aria-label={`${totals.messages} messages in the last 60 second buckets; peak ${peak} per second, grouped by topic.`}
      onPointerMove={(event) => { const bounds = event.currentTarget.getBoundingClientRect(); if (bounds.width) setCursor(Math.max(0, Math.min(59, Math.floor(((event.clientX - bounds.left) / bounds.width * 820 - 42) / 12.7)))); }} onPointerLeave={() => setCursor(null)}>
      {[0, .5, 1].map((fraction) => <g key={fraction}><line x1="42" x2="804" y1={212 - fraction * 172} y2={212 - fraction * 172} className="uns-plot-grid" /><text x="31" y={216 - fraction * 172} textAnchor="end">{Number((top * fraction).toFixed(1))}</text></g>)}
      <text x="42" y="20">messages / second</text>
      {bins.map((_, i) => {
        let offset = 0;
        return <g key={i}>{plotted.map((row) => { const count = row.bins[i], height = count / top * 172; offset += height; return count ? <rect key={row.id} x={44 + i * 12.7} y={212 - offset} width="8" height={height} fill={row.color} opacity={cursor !== null && i !== cursor ? .38 : 1} /> : null; })}</g>;
      })}
      <line x1={48 + chosen * 12.7} x2={48 + chosen * 12.7} y1="32" y2="216" className="uns-plot-cursor" />
      <text x="42" y="244">{timeLabel(start * 1000)}</text><text x="423" y="244" textAnchor="middle">30s ago</text><text x="804" y="244" textAnchor="end">Now</text>
    </svg>
    <div className="uns-plot-scrubber"><span>{timeLabel((start + chosen) * 1000)}</span><input type="range" min="0" max="59" value={chosen} onChange={(event) => setCursor(Number(event.target.value))} aria-label="Inspect traffic second" /><output>{bins[chosen]} messages{chosen === 59 ? " · partial second" : ""}</output></div>
    <div className="uns-series-legend">{plotted.map((row) => <span key={row.id} title={row.id === "__other__" ? "Remaining topics combined" : row.id}><i style={{ background: row.color }} />{row.label}<b>{row.bins[chosen]}</b></span>)}</div>
  </section>;
}

export function TrafficDashboard({ root, now, onSelect }: { root: NamespaceNode; now: number; onSelect: (path: string) => void }) {
  const traffic = namespaceTraffic(root, now);
  const ranked = [...traffic.series].sort((a, b) => b.count - a.count || a.node.path.localeCompare(b.node.path));
  return <div className="uns-traffic-dashboard"><TrafficPlot traffic={traffic} /><section className="uns-traffic-share" aria-label="Traffic share by topic"><div className="uns-diagnostic-heading"><div><h3>Who is publishing?</h3><p>Share of received messages in the same window.</p></div></div>
    <div className="uns-share-rows">{ranked.map((row) => <button type="button" key={row.node.path} onClick={() => onSelect(row.node.path)} title={row.node.path} aria-label={`Inspect traffic share for ${row.node.path}`}><span><i style={{ background: row.color }} /><b>{row.node.name}</b><ArrowUpRight size={14} /></span><span className="uns-share-meter"><i style={{ width: `${traffic.totals.messages ? row.count / traffic.totals.messages * 100 : 0}%`, background: row.color }} /></span><span className="uns-share-values"><span>{row.count.toLocaleString()} messages</span><strong>{traffic.totals.messages ? (row.count / traffic.totals.messages * 100).toFixed(1) : "0.0"}%</strong></span></button>)}</div>
    <p className="uns-insight-caption">Counts include unchanged payloads. JSON volume excludes MQTT headers and transport overhead.</p>
  </section></div>;
}

export function CadenceAnalysis({ root, now, onSelect }: { root: NamespaceNode; now: number; onSelect: (path: string) => void }) {
  const rows = namespaceTopics(root).map((node) => ({ node, cadence: topicCadence(node, now) }));
  const scale = Math.max(1, ...rows.map((row) => row.cadence?.max ?? 0));
  return <section className="uns-insight-section uns-cadence" aria-label="Publish interval analysis"><div className="uns-diagnostic-heading"><div><h3><Clock3 size={18} />Publish intervals</h3><p>Compare the spacing between actual topic arrivals.</p></div><span className="uns-window-label">Last 60 seconds</span></div>
    <div className="uns-cadence-axis"><span>Topic</span><span>0 <span>{duration(scale)}</span></span><span>Median</span></div>
    {rows.map(({ node, cadence }) => <button type="button" className="uns-cadence-row" key={node.path} onClick={() => onSelect(node.path)} aria-label={`Inspect publish intervals for ${node.path}`}><span>{node.name}</span>{cadence ? <><svg viewBox="0 0 300 32" aria-hidden="true"><title>{cadence.count} intervals; minimum {duration(cadence.min)}, median {duration(cadence.median)}, 95th percentile {duration(cadence.p95)}, maximum {duration(cadence.max)}</title><line x1="5" x2="295" y1="16" y2="16" className="uns-cadence-base" /><line x1={5 + cadence.min / scale * 290} x2={5 + cadence.max / scale * 290} y1="16" y2="16" className="uns-cadence-range" /><rect x={3 + cadence.p95 / scale * 290} y="10" width="4" height="12" fill="#e9bd70" /><circle cx={5 + cadence.median / scale * 290} cy="16" r="4" fill="#43d8f1" /></svg><b>{duration(cadence.median)}</b></> : <><span className="uns-insight-caption">Waiting for a second receipt</span><b>—</b></>}</button>)}
    <div className="uns-cadence-key"><span><i />Min–max interval</span><span><i />Median</span><span><i />95th percentile</span></div><p className="uns-insight-caption">These are browser arrival intervals. A long gap alone does not prove packet loss or a device fault.</p>
  </section>;
}

export function PayloadEvolution({ root, now }: { root: NamespaceNode; now: number }) {
  const { changes, totals } = namespaceTraffic(root, now);
  const top = Math.max(1, ...changes.map((point) => point.changed + point.added + point.removed));
  const comparable = totals.messages - totals.first;
  const changedMessages = comparable - totals.unchanged;
  const categories = [{ key: "changed", label: "Value changed", color: "#43d8f1" }, { key: "added", label: "Field added", color: "#6ed6a2" }, { key: "removed", label: "Field removed", color: "#f18b82" }] as const;
  return <section className="uns-insight-section uns-evolution" aria-label="Payload change timeline"><div className="uns-diagnostic-heading"><div><h3><GitCompareArrows size={18} />What is changing?</h3><p>Field differences between successive topic payloads.</p></div><span className="uns-window-label">5-second groups</span></div>
    <svg viewBox="0 0 560 225" className="uns-large-plot" role="img" aria-label={`${totals.changed} changed fields, ${totals.added} added and ${totals.removed} removed in the last minute.`}>
      {[0, .5, 1].map((fraction) => <g key={fraction}><line x1="38" x2="548" y1={184 - fraction * 150} y2={184 - fraction * 150} className="uns-plot-grid" /><text x="29" y={188 - fraction * 150} textAnchor="end">{Number((top * fraction).toFixed(1))}</text></g>)}
      <text x="38" y="18">field changes</text>
      {changes.map((point, index) => { let offset = 0; return <g key={point.timestamp}>{categories.map(({ key, color }) => { const height = point[key] / top * 150; offset += height; return point[key] ? <rect key={key} x={46 + index * 42} y={184 - offset} width="25" height={height} fill={color}><title>{timeLabel(point.timestamp)}: {point[key]} fields {key}</title></rect> : null; })}</g>; })}
      <text x="38" y="216">60s ago</text><text x="548" y="216" textAnchor="end">Now</text>
      {!totals.changed && !totals.added && !totals.removed && <text x="294" y="110" textAnchor="middle">{comparable ? "Received values are unchanged" : "Waiting for comparable messages"}</text>}
    </svg>
    <div className="uns-series-legend">{categories.map(({ key, color, label }) => <span key={key}><i style={{ background: color }} />{label}<b>{totals[key]}</b></span>)}</div>
    <div className="uns-change-ratio"><span style={{ width: `${comparable ? changedMessages / comparable * 100 : 0}%` }} /></div><p className="uns-insight-caption">{changedMessages} changed messages · {totals.unchanged} unchanged · {totals.first} first receipts. Underscore metadata is excluded from comparisons.</p>
  </section>;
}

function FieldPlot({ samples, label }: { samples: { timestamp: number; value: number }[]; label: string }) {
  const [cursor, setCursor] = useState<number | null>(null);
  const stats = numericFieldStats(samples);
  if (!stats) return <p className="uns-diagnostic-empty">Waiting for numeric values on this field.</p>;
  const selected = Math.min(cursor ?? samples.length - 1, samples.length - 1), sample = samples[selected];
  const padding = stats.min === stats.max ? Math.max(Math.abs(stats.min) * .02, .01) : (stats.max - stats.min) * .12;
  const low = stats.min - padding, high = stats.max + padding, span = samples.at(-1)!.timestamp - samples[0].timestamp;
  const x = (index: number) => 54 + (samples.length === 1 ? .5 : span > 0 ? (samples[index].timestamp - samples[0].timestamp) / span : index / (samples.length - 1)) * 488;
  const y = (value: number) => 184 - (value - low) / (high - low) * 150;
  const path = samples.map((point, i) => `${i ? "L" : "M"}${x(i)},${y(point.value)}`).join(" ");
  return <><div className="uns-field-readout"><output>{formatNamespaceValue(sample.value)}</output><span>{timeLabel(sample.timestamp)} · received value</span></div><svg viewBox="0 0 560 225" className="uns-large-plot" role="img" aria-label={`${label}, ${samples.length} received samples, minimum ${stats.min}, maximum ${stats.max}.`}
    onPointerMove={(event) => { const bounds = event.currentTarget.getBoundingClientRect(); if (!bounds.width) return; const target = (event.clientX - bounds.left) / bounds.width * 560; let nearest = 0; for (let i = 1; i < samples.length; i++) if (Math.abs(x(i) - target) < Math.abs(x(nearest) - target)) nearest = i; setCursor(nearest); }} onPointerLeave={() => setCursor(null)}>
      {[low, (low + high) / 2, high].map((value, index) => <g key={index}><line x1="54" x2="542" y1={y(value)} y2={y(value)} className="uns-plot-grid" /><text x="45" y={y(value) + 4} textAnchor="end">{magnitude(value)}</text></g>)}
      <path d={path} className="uns-field-line" /><line x1={x(selected)} x2={x(selected)} y1="29" y2="184" className="uns-plot-cursor" /><circle cx={x(selected)} cy={y(sample.value)} r="4" fill="#43d8f1" /><text x="54" y="217">{timeLabel(samples[0].timestamp)}</text><text x="542" y="217" textAnchor="end">{timeLabel(samples.at(-1)!.timestamp)}</text>
    </svg><input className="uns-field-scrubber" type="range" min="0" max={Math.max(0, samples.length - 1)} value={selected} disabled={samples.length < 2} onChange={(event) => setCursor(Number(event.target.value))} aria-label="Inspect numeric field sample" /><div className="uns-field-statistics"><span>Minimum<b>{magnitude(stats.min)}</b></span><span>Average<b>{magnitude(stats.average)}</b></span><span>Maximum<b>{magnitude(stats.max)}</b></span><span>Samples<b>{stats.count}</b></span></div></>;
}

export function FieldLaboratory({ root }: { root: NamespaceNode }) {
  const [topicPath, setTopicPath] = useState(""), [fieldKey, setFieldKey] = useState("");
  const topics = namespaceTopics(root).filter((node) => node.numericHistory.size > 0);
  const selected = topics.find((node) => node.path === topicPath) ?? topics[0];
  const fields = selected ? [...selected.numericHistory.keys()] : [];
  const field = fields.includes(fieldKey) ? fieldKey : fields[0];
  return <section className="uns-insight-section uns-field-laboratory" aria-label="Numeric field explorer"><div className="uns-diagnostic-heading"><div><h3><Waves size={18} />Explore a sensor field</h3><p>Inspect individual measurements beyond the topic envelope.</p></div></div>
    {selected ? <><div className="uns-field-selectors"><label>Topic<select aria-label="Numeric field topic" value={selected.path} onChange={(event) => { setTopicPath(event.target.value); setFieldKey(""); }}>{topics.map((node) => <option key={node.path} value={node.path}>{node.path.split("/").slice(-3).join(" / ")}</option>)}</select></label><label>Field<select aria-label="Numeric field" value={field} onChange={(event) => setFieldKey(event.target.value)}>{fields.map((key) => <option key={key}>{key}</option>)}</select></label></div><FieldPlot key={`${selected.path}:${field}`} samples={selected.numericHistory.get(field)!} label={field} /><p className="uns-insight-caption">Up to 120 actual samples per tracked field. Axis scales to received values; units and alarm limits are not inferred.</p></> : <p className="uns-diagnostic-empty">Numeric fields will appear as their topic payloads arrive. Values are never generated to fill this chart.</p>}
  </section>;
}
