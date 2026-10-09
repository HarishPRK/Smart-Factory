import { useState } from "react";
import { Activity, ArrowRight, Braces, Check, Copy, Download, Layers3, Radio, Search } from "lucide-react";
import { formatNamespaceValue, namespaceActivity, namespaceCoverage, namespaceSnapshot, namespaceTopics, NAMESPACE_LEVELS, payloadEntries, payloadType, type NamespaceNode, type NamespaceReceipt, type PayloadType } from "./namespaceModel";
import { CadenceAnalysis, FieldLaboratory, PayloadEvolution, TrafficDashboard } from "./NamespaceDiagnostics";

const TYPE_COLORS: Record<PayloadType, string> = { number: "#43d8f1", boolean: "#6ed6a2", string: "#c7a4ed", array: "#e9bd70", object: "#82b5f6", null: "#90aab7", undefined: "#90aab7" };
const clock = (time: number) => new Date(time).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" });
const jsonSize = (bytes: number | null) => bytes === null ? "—" : bytes < 1024 ? `${bytes} B` : `${(bytes / 1024).toFixed(1)} KiB`;
const receiptLabel = (receipt: NamespaceReceipt) => receipt.first ? "First receipt" : !receipt.changed && !receipt.added && !receipt.removed ? "Values unchanged" : [receipt.changed ? `${receipt.changed} changed` : "", receipt.added ? `${receipt.added} added` : "", receipt.removed ? `${receipt.removed} removed` : ""].filter(Boolean).join(" · ");

export function SnapshotExport({ root, now }: { root: NamespaceNode; now: number }) {
  const [feedback, setFeedback] = useState("");
  const download = () => {
    let url: string | undefined;
    try {
      url = URL.createObjectURL(new Blob([JSON.stringify(namespaceSnapshot(root, now), null, 2)], { type: "application/json" }));
      const link = document.createElement("a"); link.href = url; link.download = `uns-snapshot-${new Date(now).toISOString().replace(/[:.]/g, "-")}.json`;
      document.body.append(link); link.click(); link.remove();
      setFeedback("Snapshot downloaded");
    } catch { setFeedback("Download unavailable in this browser"); }
    finally { if (url) setTimeout(() => URL.revokeObjectURL(url!), 1000); }
  };
  return <div className="uns-export"><button type="button" onClick={download} disabled={!namespaceTopics(root).length} aria-label="Export namespace snapshot"><Download size={15} /><span>Export snapshot</span></button>{feedback && <span role="status" className="uns-action-feedback">{feedback}</span>}</div>;
}

export function CopyTopic({ path }: { path: string }) {
  const [feedback, setFeedback] = useState("");
  const copy = async () => {
    try { await navigator.clipboard.writeText(path); setFeedback("Copied"); }
    catch { setFeedback("Select the path to copy"); }
  };
  return <div className="uns-copy-topic"><button type="button" onClick={copy} aria-label="Copy topic path">{feedback === "Copied" ? <Check size={14} /> : <Copy size={14} />}<span>Copy topic</span></button>{feedback && <span role="status">{feedback}</span>}</div>;
}

export function NamespaceOverview({ root, now, onSelect }: { root: NamespaceNode; now: number; onSelect: (path: string) => void }) {
  const [visibleCount, setVisibleCount] = useState(12);
  const topics = namespaceTopics(root), coverage = namespaceCoverage(root);
  const active = topics.filter((topic) => topic.lastSeen !== null && now - topic.lastSeen < 5000).length;
  const rates = topics.map((topic) => ({ topic, activity: namespaceActivity(topic, now) }));
  const cells = rates.map(({ activity }) => Array.from({ length: 30 }, (_, i) => activity.bins[i * 2] + activity.bins[i * 2 + 1]));
  const peak = cells.reduce((max, row) => Math.max(max, ...row), 1);
  const types = new Map<PayloadType, number>();
  for (const topic of topics) for (const [, value] of payloadEntries(topic.payload)) types.set(payloadType(value), (types.get(payloadType(value)) ?? 0) + 1);
  const fieldCount = [...types.values()].reduce((total, count) => total + count, 0);
  const latest = topics.flatMap((topic) => topic.receipts.map((receipt) => ({ topic, receipt }))).sort((a, b) => b.receipt.timestamp - a.receipt.timestamp || b.receipt.sequence - a.receipt.sequence || a.topic.path.localeCompare(b.topic.path)).slice(0, 8);
  const totalRate = rates.reduce((total, row) => total + row.activity.rateHz, 0);
  return <aside className="uns-overview" aria-label="Namespace activity overview">
    <div className="uns-insight-heading"><div><h3>Inside your namespace</h3><p>Follow the traffic. Inspect the timing. Explore the values.</p></div><span className="uns-rate-readout" title="Messages received in the last 10 seconds divided by 10">{totalRate.toFixed(1)}<small>Hz combined · last 10s</small></span></div>
    <div className="uns-receipt-balance"><div className="uns-receipt-track" aria-label={`${active} of ${topics.length} topics received in the last five seconds`}><span style={{ width: `${topics.length ? active / topics.length * 100 : 0}%` }} /></div><div><span><i />{active} receiving <small>last 5s</small></span><span>{topics.length - active} quiet</span></div></div>
    <TrafficDashboard root={root} now={now} onSelect={onSelect} />
    <div className="uns-diagnostic-pair">
    <section className="uns-insight-section uns-traffic"><div className="uns-workspace-section-heading"><h3><Activity size={17} />Topic activity</h3><span>60-second window</span></div><p>Each cell represents two seconds. Brighter cells mean more messages.</p>
      <div className="uns-traffic-axis"><span>Published topic</span><span>60s ago <span>Now</span></span><span>Hz</span></div>
      {rates.slice(0, visibleCount).map(({ topic, activity }, row) => <button type="button" className="uns-traffic-row" key={topic.path} onClick={() => onSelect(topic.path)} aria-label={`Inspect activity for ${topic.path}: ${activity.rateHz.toFixed(1)} Hz`}>
        <span className="uns-traffic-name"><span>{topic.name}</span><small>{topic.path.split("/").slice(-3, -1).join(" / ") || "Root topic"}</small></span>
        <svg viewBox="0 0 300 24" preserveAspectRatio="none" aria-hidden="true">{cells[row].map((count, i) => <rect key={i} x={i * 10} y="2" width="7" height="20" rx="2" fill={count ? "#43d8f1" : "#2e4553"} fillOpacity={count ? .25 + .75 * count / peak : .6}><title>{count} messages, {60 - i * 2}–{58 - i * 2}s ago</title></rect>)}</svg>
        <span className="uns-traffic-rate">{activity.rateHz.toFixed(1)}<ArrowRight size={12} /></span>
      </button>)}
      {topics.length > visibleCount && <button type="button" className="uns-text-action" onClick={() => setVisibleCount((count) => count + 12)}>Show more topics ({topics.length - visibleCount} remaining)</button>}
      <div className="uns-traffic-legend"><span><i />No arrivals</span><span>Fewer <i /><i /><i /> More</span></div>
    </section>
    <CadenceAnalysis root={root} now={now} onSelect={onSelect} />
    </div>
    <div className="uns-diagnostic-pair"><FieldLaboratory root={root} /><PayloadEvolution root={root} now={now} /></div>
    <div className="uns-diagnostic-pair">
    <section className="uns-insight-section"><div className="uns-workspace-section-heading"><h3><Layers3 size={17} />Namespace coverage</h3><span>Discovered nodes</span></div><div className="uns-coverage">{NAMESPACE_LEVELS.map((level, i) => <div key={level}><span>{level}</span><b>{coverage[i]}</b>{i < 5 && <ArrowRight size={12} />}</div>)}</div><p className="uns-insight-caption">Levels follow topic depth. Counts reflect received paths, not a configured asset inventory.</p></section>
    <section className="uns-insight-section"><div className="uns-workspace-section-heading"><h3><Braces size={17} />Payload composition</h3><span>{fieldCount} latest fields</span></div>{fieldCount ? <><div className="uns-type-track" aria-label="Distribution of latest top-level payload field types">{[...types].map(([type, count]) => <span key={type} style={{ width: `${count / fieldCount * 100}%`, background: TYPE_COLORS[type] }} title={`${type}: ${count} fields`} />)}</div><div className="uns-type-legend">{[...types].map(([type, count]) => <span key={type}><i style={{ background: TYPE_COLORS[type] }} />{type}<b>{count}</b></span>)}</div></> : <p className="uns-insight-caption">No object fields received. Select a topic to inspect its raw payload.</p>}</section>
    </div>
    <section className="uns-insight-section"><div className="uns-workspace-section-heading"><h3><Radio size={17} />Recent receipts</h3><span>Latest {latest.length}</span></div><ol className="uns-event-list">{latest.map(({ topic, receipt }) => <li key={`${topic.path}:${receipt.sequence}`}><time>{clock(receipt.timestamp)}</time><button type="button" onClick={() => onSelect(topic.path)}><span>{topic.name}</span><small>{receiptLabel(receipt)}</small></button><span className="uns-event-sequence">#{receipt.sequence}</span></li>)}</ol><p className="uns-insight-caption">Quiet means no recent receipt; it does not establish a device fault. All activity is observed in this browser session.</p></section>
  </aside>;
}

function TagTrace({ node, field }: { node: NamespaceNode; field: string }) {
  const samples = (node.numericHistory.get(field) ?? []).slice(-30);
  if (samples.length < 2) return <span className="uns-trace-empty">{samples.length ? "Collecting" : "Not tracked"}</span>;
  const min = Math.min(...samples.map((point) => point.value)), max = Math.max(...samples.map((point) => point.value));
  const span = samples.at(-1)!.timestamp - samples[0].timestamp;
  const path = samples.map((point, i) => `${i ? "L" : "M"}${2 + (span > 0 ? (point.timestamp - samples[0].timestamp) / span : i / (samples.length - 1)) * 76},${max === min ? 14 : 25 - (point.value - min) / (max - min) * 22}`).join(" ");
  return <svg className="uns-tag-trace" viewBox="0 0 80 28" aria-hidden="true"><title>{samples.length} received samples; minimum {min}; maximum {max}</title><path d={path} /><circle cx="78" cy={max === min ? 14 : 25 - (samples.at(-1)!.value - min) / (max - min) * 22} r="2" /></svg>;
}

export function PayloadInspector({ node }: { node: NamespaceNode }) {
  const [view, setView] = useState<"tags" | "changes" | "json">("tags");
  const [search, setSearch] = useState("");
  const entries = payloadEntries(node.payload), matches = entries.filter(([key]) => key.toLowerCase().includes(search.toLowerCase()));
  return <section className="uns-workspace-payload"><div className="uns-workspace-section-heading"><h3><Braces size={17} />Latest payload</h3><div className="uns-workspace-payload-controls" aria-label="Payload view">{(["tags", "changes", "json"] as const).map((tab) => <button type="button" key={tab} aria-pressed={view === tab} onClick={() => setView(tab)}>{tab === "json" ? "JSON" : tab === "changes" ? "Changes" : "Tags"}</button>)}</div></div>
    <p className="uns-workspace-received-time">{node.lastSeen === null ? "Awaiting receipt" : `Received ${clock(node.lastSeen)}`} · {jsonSize(node.payloadBytes)} serialized JSON</p>
    {view === "json" ? <pre>{JSON.stringify(node.payload, null, 2) ?? "—"}</pre> : view === "changes" ? <div className="uns-payload-changes"><p>Compared with the previous message on this exact topic.</p>{node.messageCount < 2 ? <p className="uns-insight-caption">A second receipt is needed to compare values.</p> : !node.lastChanges.length ? <p className="uns-changes-empty"><Check size={16} />No field changes in the latest message.</p> : <ul>{node.lastChanges.map((change) => <li key={change.key}><div><b>{change.key}</b><span>{change.kind}</span></div><p><span>{change.kind === "added" ? "Not present" : formatNamespaceValue(change.before)}</span><ArrowRight size={14} /><strong>{change.kind === "removed" ? "Not present" : formatNamespaceValue(change.after)}</strong></p></li>)}</ul>}</div> : entries.length ? <>
      <label className="uns-field-search"><Search size={15} /><input aria-label="Filter payload fields" placeholder="Find a field…" value={search} onChange={(event) => setSearch(event.target.value)} /><span>{matches.length}/{entries.length}</span></label>
      <div className="uns-field-columns"><span>Field / type</span><span>Value</span><span>Recent values</span></div>
      <dl className="uns-instrument-tags">{matches.map(([key, value]) => {
        const type = payloadType(value), change = node.lastChanges.find((entry) => entry.key === key);
        return <div key={key}><dt>{key}<small><i style={{ background: TYPE_COLORS[type] }} />{type}{change && <span className="uns-field-change">{change.kind}</span>}</small></dt><dd title={formatNamespaceValue(value)}>{formatNamespaceValue(value)}</dd><dd className="uns-field-visual">{type === "number" ? <TagTrace node={node} field={key} /> : type === "boolean" ? <span className="uns-boolean" data-on={value ? "true" : "false"}><i />{value ? "True" : "False"}</span> : <span className="uns-trace-empty">{type === "array" ? `${(value as unknown[]).length} items` : type === "object" ? `${Object.keys(value as object).length} fields` : "—"}</span>}</dd></div>;
      })}</dl>{!matches.length && <p className="uns-insight-caption">No fields match “{search}”.</p>}<p className="uns-insight-caption">Traces use up to 30 actual receipts for up to 64 numeric fields. Each trace has its own range. Metadata keys beginning with _ are available in JSON.</p>
    </> : <div className="uns-workspace-scalar">{formatNamespaceValue(node.payload)}</div>}
  </section>;
}

export function TopicFacts({ node, now }: { node: NamespaceNode; now: number }) {
  const recent = node.hits.filter((time) => time > now - 60_000 && time <= now);
  const gaps = recent.slice(1).map((time, i) => time - recent[i]).filter((gap) => gap >= 0).sort((a, b) => a - b);
  const median = gaps.length ? (gaps[Math.floor((gaps.length - 1) / 2)] + gaps[Math.floor(gaps.length / 2)]) / 2 : null;
  return <dl className="uns-topic-facts"><div><dt>First observed</dt><dd>{node.firstSeen === null ? "—" : clock(node.firstSeen)}</dd></div><div><dt>Typical interval <small>last 60s</small></dt><dd>{median === null ? "Need 2 receipts" : median < 1000 ? `${Math.round(median)} ms` : `${(median / 1000).toFixed(2)} s`}</dd></div><div><dt>Latest field changes</dt><dd>{node.messageCount < 2 ? "First receipt" : node.lastChanges.length}</dd></div><div><dt>Payload size <small>JSON</small></dt><dd>{jsonSize(node.payloadBytes)}</dd></div></dl>;
}
