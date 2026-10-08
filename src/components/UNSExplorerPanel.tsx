import { useContext, useEffect, useRef, useState, type CSSProperties } from "react";
import { Activity, ArrowRight, Building2, ChevronDown, ChevronRight, Clock3, Code2, Database, Factory, FolderTree, GitBranch, Layers3, ListTree, Maximize2, Minimize2, PanelRight, Radio, Search, Server, X } from "lucide-react";
import { subscribeAnyMessage } from "../services/plcService";
import { UIVersionContext } from "./ui-version/UIVersionContext";
import UNSExplorerClassic from "../legacy/components/UNSExplorerPanel";
import { createNamespaceNode, FACTORY_UNS_FILTER, findNamespaceNode, formatNamespaceValue, ingestNamespace, isFactoryNamespaceTopic, namespaceActivity, namespaceChildren, namespaceMatches, namespaceTopics, payloadEntries, type NamespaceNode } from "./uns/namespaceModel";
import NamespaceChart from "./uns/NamespaceTreeChart";

interface UNSExplorerPanelProps { open: boolean; onClose: () => void }
const LEVELS = ["Enterprise", "Site", "Line", "Device"];
const NODE_COLORS = ["#43d8f1", "#82b5f6", "#e9bd70", "#6ed6a2"];

function ageLabel(timestamp: number | null, now: number): string {
  if (timestamp === null) return "No receipts";
  const seconds = Math.max(0, Math.floor((now - timestamp) / 1000));
  if (seconds < 1) return "Just now";
  if (seconds < 60) return `${seconds}s ago`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  return `${Math.floor(seconds / 3600)}h ago`;
}
function NodeIcon({ node }: { node: NamespaceNode }) {
  const Icon = node.isTopic ? Database : [Building2, Factory, Layers3, Server][Math.min(node.depth - 1, 3)] ?? FolderTree;
  return <Icon size={18} aria-hidden="true" />;
}
function ReceiptState({ node, now }: { node: NamespaceNode; now: number }) {
  const receiving = node.lastSeen !== null && now - node.lastSeen < 5000;
  return <span className={`uns-workspace-receipt ${receiving ? "is-receiving" : ""}`}><i />{receiving ? "Receiving" : "Quiet"}</span>;
}

function NamespaceBranch({ node, collapsed, selectedPath, search, now, onToggle, onSelect }: {
  node: NamespaceNode; collapsed: Set<string>; selectedPath: string | null; search: string; now: number;
  onToggle: (path: string) => void; onSelect: (path: string) => void;
}) {
  if (!namespaceMatches(node, search)) return null;
  const children = namespaceChildren(node);
  const isExpanded = search.trim() !== "" || !collapsed.has(node.path);
  const activity = namespaceActivity(node, now);
  const level = !node.isTopic ? LEVELS[node.depth - 1] : undefined;
  const color = NODE_COLORS[Math.min(node.depth - 1, 3)];
  const tags = node.payload !== null && typeof node.payload === "object" && !Array.isArray(node.payload) ? payloadEntries(node.payload).length : null;
  return <li className="uns-workspace-branch" style={{ "--node-color": color } as CSSProperties}>
    <div className={`uns-workspace-node ${selectedPath === node.path ? "is-selected" : ""}`}>
      {children.length ? <button type="button" className="uns-workspace-expand" aria-label={`${isExpanded ? "Collapse" : "Expand"} ${node.path}`} aria-expanded={isExpanded} onClick={() => onToggle(node.path)} disabled={Boolean(search.trim())}>{isExpanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}</button> : <span className="uns-workspace-branch-end" />}
      <button type="button" className="uns-workspace-node-select" onClick={() => onSelect(node.path)} aria-current={selectedPath === node.path ? "true" : undefined} title={node.path}>
        <span className="uns-workspace-node-icon"><NodeIcon node={node} /></span>
        <span className="uns-workspace-node-name">{node.name}<small>{node.isTopic ? tags !== null ? `${tags} tags` : "Payload value" : level ?? "Namespace group"}</small></span>
        <span className="uns-workspace-node-activity"><span>{activity.rateHz.toFixed(1)} <small>Hz</small></span><span>{ageLabel(node.lastSeen, now)}</span></span>
        <span className={`uns-workspace-node-dot ${node.lastSeen !== null && now - node.lastSeen < 5000 ? "is-receiving" : ""}`} />
      </button>
    </div>
    {children.length > 0 && isExpanded && <ul>{children.map((child) => <NamespaceBranch key={child.path} node={child} collapsed={collapsed} selectedPath={selectedPath} search={search} now={now} onToggle={onToggle} onSelect={onSelect} />)}</ul>}
  </li>;
}

function ArrivalTimeline({ node, now }: { node: NamespaceNode; now: number }) {
  const { bins } = namespaceActivity(node, now);
  const peak = Math.max(1, ...bins);
  const total = bins.reduce((sum, count) => sum + count, 0);
  return <section className="uns-workspace-activity">
    <div className="uns-workspace-section-heading"><h3><Activity size={16} />Message activity</h3><span>{total.toLocaleString()} received · last 60s</span></div>
    <svg className="uns-workspace-timeline" viewBox="0 0 600 100" role="img" aria-label={`${total} messages received in the last 60 seconds. Peak ${Math.max(...bins)} messages in one second.`}>
      <line x1="0" y1="78" x2="600" y2="78" className="uns-workspace-axis" />
      <line x1="0" y1="14" x2="600" y2="14" className="uns-workspace-axis uns-workspace-axis-top" />
      {bins.map((count, index) => count > 0 ? <rect key={index} x={index * 10 + 2} y={78 - count / peak * 57} width="6" height={count / peak * 57} rx="2"><title>{count} {count === 1 ? "message" : "messages"}, {60 - index}s ago</title></rect> : null)}
      <text x="0" y="98">60s ago</text><text x="300" y="98" textAnchor="middle">30s</text><text x="600" y="98" textAnchor="end">Now</text>
      {total === 0 && <text x="300" y="46" textAnchor="middle">No messages received in this window</text>}
    </svg>
  </section>;
}

function NamespaceInspector({ node, root, now, onSelect }: { node: NamespaceNode; root: NamespaceNode; now: number; onSelect: (path: string) => void }) {
  const [rawPayload, setRawPayload] = useState(false);
  const entries = payloadEntries(node.payload);
  const activity = namespaceActivity(node, now);
  const segments = node.path.split("/");
  const topics = namespaceTopics(node);
  const tagCount = node.payload !== null && typeof node.payload === "object" && !Array.isArray(node.payload) ? entries.length : null;
  return <aside className="uns-workspace-inspector" aria-label="Selected namespace details">
    <nav className="uns-workspace-breadcrumb" aria-label="Selected topic path">{segments.map((segment, index) => <span key={`${index}-${segment}`}><button type="button" onClick={() => onSelect(segments.slice(0, index + 1).join("/"))}>{segment}</button>{index < segments.length - 1 && <ChevronRight size={12} />}</span>)}</nav>
    <div className="uns-workspace-inspector-title"><span className="uns-workspace-selected-icon"><NodeIcon node={node} /></span><div><h3>{node.name}</h3><p>{node.isTopic ? "Published topic" : `${LEVELS[node.depth - 1] ?? "Namespace"} branch`}</p></div><ReceiptState node={node} now={now} /></div>
    <code className="uns-workspace-topic-path">{node.path}</code>
    <dl className="uns-workspace-topic-metrics"><div><dt>Arrival rate</dt><dd>{activity.rateHz.toFixed(1)} <small>Hz</small></dd></div><div><dt>Session messages</dt><dd>{activity.messages.toLocaleString()}</dd></div><div><dt>{node.isTopic ? "Payload tags" : "Published topics"}</dt><dd>{node.isTopic ? tagCount ?? "—" : activity.topics}</dd></div></dl>
    <ArrivalTimeline node={node} now={now} />
    {node.isTopic ? <section className="uns-workspace-payload">
      <div className="uns-workspace-section-heading"><h3><Database size={16} />Latest payload</h3><div className="uns-workspace-payload-controls"><button type="button" aria-pressed={!rawPayload} onClick={() => setRawPayload(false)}>Tags</button><button type="button" aria-pressed={rawPayload} onClick={() => setRawPayload(true)}><Code2 size={13} />JSON</button></div></div>
      <p className="uns-workspace-received-time"><Clock3 size={13} />Received {node.lastSeen === null ? "—" : new Date(node.lastSeen).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" })} · {ageLabel(node.lastSeen, now)}</p>
      {rawPayload ? <pre>{JSON.stringify(node.payload, null, 2) ?? "—"}</pre> : entries.length ? <dl className="uns-workspace-tags">{entries.map(([key, value]) => <div key={key}><dt>{key}</dt><dd title={formatNamespaceValue(value)}>{formatNamespaceValue(value)}</dd></div>)}</dl> : <div className="uns-workspace-scalar">{formatNamespaceValue(node.payload)}</div>}
    </section> : <section className="uns-workspace-descendants"><div className="uns-workspace-section-heading"><h3><Database size={16} />Published topics</h3><span>{topics.length}</span></div>{topics.map((topic) => <button type="button" key={topic.path} onClick={() => onSelect(topic.path)}><span>{topic.path.slice(node.path.length + 1) || topic.name}</span><span>{namespaceActivity(topic, now).rateHz.toFixed(1)} Hz <ArrowRight size={14} /></span></button>)}</section>}
    <p className="uns-workspace-source-note">Discovered from received MQTT envelopes. Arrival rate uses the last 10 seconds.{node.isTopic ? " Values are the latest received payload." : " Hierarchy labels follow topic depth."} {root.lastSeen === null ? "Waiting for messages." : ""}</p>
  </aside>;
}

function UNSWorkspace({ open, onClose }: UNSExplorerPanelProps) {
  const rootRef = useRef(createNamespaceNode());
  const discoveredDevices = useRef(new Set<string>());
  const messagesRef = useRef(0);
  const dialogRef = useRef<HTMLDivElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const dismiss = useRef(onClose);
  useEffect(() => { dismiss.current = onClose; }, [onClose]);
  const [snapshot, setSnapshot] = useState(() => ({ root: createNamespaceNode(), messages: 0, now: Date.now() }));
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  const [selectedPath, setSelectedPath] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [view, setView] = useState<"chart" | "list">("chart");
  const [showDetails, setShowDetails] = useState(false);
  const [focusPath, setFocusPath] = useState<{ path: string; revision: number } | null>(null);
  useEffect(() => {
    let pending: ReturnType<typeof setTimeout> | undefined;
    const repaint = () => setSnapshot({ root: rootRef.current, messages: messagesRef.current, now: Date.now() });
    const unsubscribe = subscribeAnyMessage((topic, payload) => {
      if (!isFactoryNamespaceTopic(topic)) return;
      if (!ingestNamespace(rootRef.current, topic, payload, Date.now())) return;
      messagesRef.current += 1;
      // Start with the four hierarchy scopes; deeper topics unfold on demand.
      // A branch is initialized once, so later receipts never undo user expansion.
      const devicePath = topic.split("/").filter(Boolean).slice(0, 4).join("/");
      const device = findNamespaceNode(rootRef.current, devicePath);
      if (device?.depth === 4 && device.children.size && !discoveredDevices.current.has(devicePath)) {
        discoveredDevices.current.add(devicePath);
        setCollapsed((previous) => new Set(previous).add(devicePath));
      }
      if (pending === undefined) pending = setTimeout(() => { pending = undefined; repaint(); }, 250);
    });
    const tick = setInterval(repaint, 1000);
    return () => { unsubscribe(); clearInterval(tick); if (pending !== undefined) clearTimeout(pending); };
  }, []);
  useEffect(() => {
    if (!open) return;
    const previous = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    closeRef.current?.focus();
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") { event.preventDefault(); dismiss.current(); }
      if (event.key !== "Tab") return;
      const controls = [...(dialogRef.current?.querySelectorAll<HTMLElement>('button:not(:disabled), input, [tabindex="0"]') ?? [])].filter((element) => element.getClientRects().length > 0);
      const first = controls[0]; const last = controls.at(-1);
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
    };
    document.addEventListener("keydown", onKeyDown);
    return () => { document.removeEventListener("keydown", onKeyDown); document.body.style.overflow = previousOverflow; previous?.focus(); };
  }, [open]);
  if (!open) return null;
  const { root, messages, now } = snapshot;
  const topics = namespaceTopics(root);
  const selected = (selectedPath ? findNamespaceNode(root, selectedPath) : null) ?? topics[0] ?? namespaceChildren(root)[0] ?? null;
  const branches = namespaceChildren(root).filter((node) => namespaceMatches(node, search));
  const toggle = (path: string) => setCollapsed((previous) => { const next = new Set(previous); if (next.has(path)) next.delete(path); else next.add(path); return next; });
  const collapseAll = () => { const paths = new Set<string>(); const visit = (node: NamespaceNode) => { if (node.path && node.children.size) paths.add(node.path); namespaceChildren(node).forEach(visit); }; visit(root); setCollapsed(paths); };
  const inspect = (path: string) => { setSelectedPath(path); setShowDetails(true); };
  const navigate = (path: string) => {
    inspect(path);
    setCollapsed((previous) => { const next = new Set(previous); const segments = path.split("/"); segments.forEach((_, index) => next.delete(segments.slice(0, index + 1).join("/"))); return next; });
    setFocusPath((previous) => ({ path, revision: (previous?.revision ?? 0) + 1 }));
  };
  return <div className="uns-workspace-overlay"><div className="uns-workspace-backdrop" onClick={onClose} /><div className="uns-workspace-dialog" role="dialog" aria-modal="true" aria-labelledby="uns-workspace-title" ref={dialogRef}>
    <header className="uns-workspace-header"><div><h2 id="uns-workspace-title">UNS Explorer</h2><p>Unified Namespace · <code>{FACTORY_UNS_FILTER}</code></p></div><div className="uns-workspace-header-actions">{root.lastSeen !== null ? <ReceiptState node={root} now={now} /> : <span className="uns-workspace-receipt"><Radio size={14} />Awaiting traffic</span>}<button type="button" ref={closeRef} onClick={onClose} aria-label="Close UNS Explorer"><X size={20} /></button></div></header>
    <div className="uns-workspace-summary"><span><FolderTree size={16} /><strong>{root.children.size}</strong> root branches</span><span><Database size={16} /><strong>{topics.length}</strong> topics</span><span><Radio size={16} /><strong>{messages.toLocaleString()}</strong> session messages</span><span className="uns-workspace-summary-time"><Clock3 size={15} />{ageLabel(root.lastSeen, now)}</span></div>
    <div className={`uns-workspace-body ${view === "chart" ? "has-chart" : ""} ${selected && showDetails ? "" : "is-empty"}`}>
      <section className="uns-workspace-hierarchy"><div className="uns-workspace-tree-tools"><label className="uns-workspace-search"><Search size={17} /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search topics or tags" aria-label="Search namespace topics or tags" />{search && <button type="button" onClick={() => setSearch("")} aria-label="Clear namespace search"><X size={14} /></button>}</label><div className="uns-workspace-view-controls" aria-label="Namespace view"><button type="button" aria-pressed={view === "chart"} onClick={() => setView("chart")}><GitBranch size={15} />Chart</button><button type="button" aria-pressed={view === "list"} onClick={() => setView("list")}><ListTree size={15} />List</button></div></div>
        <div className="uns-workspace-map-tools"><span>{view === "chart" ? "Enterprise → Site → Line → Device" : "Namespace hierarchy"}</span><div className="uns-workspace-tree-actions"><button type="button" onClick={() => setCollapsed(new Set())} disabled={Boolean(search.trim()) || !topics.length} aria-label="Expand all branches" title="Expand all branches"><Maximize2 size={16} /></button><button type="button" onClick={collapseAll} disabled={Boolean(search.trim()) || !topics.length} aria-label="Collapse all branches" title="Collapse all branches"><Minimize2 size={16} /></button><button type="button" className="uns-workspace-details-toggle" onClick={() => setShowDetails((previous) => !previous)} disabled={!selected} aria-pressed={showDetails} aria-label={showDetails ? "Hide namespace details" : "Show namespace details"}><PanelRight size={16} /><span>Details</span></button></div></div>
        {root.children.size ? branches.length ? view === "chart" ? <NamespaceChart root={root} collapsed={collapsed} search={search} selectedPath={selected?.path ?? null} now={now} focusPath={focusPath} onToggle={toggle} onSelect={inspect} /> : <nav className="uns-workspace-tree-scroll" aria-label="Namespace hierarchy"><ul>{branches.map((node) => <NamespaceBranch key={node.path} node={node} collapsed={collapsed} selectedPath={selected?.path ?? null} search={search} now={now} onToggle={toggle} onSelect={inspect} />)}</ul></nav> : <div className="uns-workspace-no-results"><h3>No matching topics</h3><p>Try a device name, topic segment or payload tag.</p><button type="button" onClick={() => setSearch("")}>Clear search</button></div> : <div className="uns-workspace-empty" role="status"><FolderTree size={44} strokeWidth={1.25} /><h3>Waiting for broker traffic</h3><p>The tree builds from received messages under <code>{FACTORY_UNS_FILTER}</code>. Expand a device to discover its topics, then select a node to inspect its payload.</p><div><Radio size={16} />MQTT discovery is listening</div></div>}
      </section>
      {selected && showDetails && <NamespaceInspector key={selected.path} node={selected} root={root} now={now} onSelect={navigate} />}
    </div><footer className="uns-workspace-footer"><span><i />Received broker data only</span><span>Topic depth → Enterprise / Site / Line / Device</span></footer>
  </div></div>;
}

export default function UNSExplorerPanel(props: UNSExplorerPanelProps) {
  const context = useContext(UIVersionContext);
  return context?.version === "classic" ? <UNSExplorerClassic {...props} /> : <UNSWorkspace {...props} />;
}
