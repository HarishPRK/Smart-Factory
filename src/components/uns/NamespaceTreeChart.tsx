import { useEffect, useRef, useState, type CSSProperties, type PointerEvent as ReactPointerEvent } from "react";
import { Building2, ChevronDown, ChevronRight, Database, Factory, Focus, FolderTree, Layers3, Minus, Plus, Scan, Server } from "lucide-react";
import { namespaceActivity, payloadEntries, type NamespaceNode } from "./namespaceModel";
import { fitNamespaceChart, focusNamespaceChart, layoutNamespaceChart, zoomNamespaceChart } from "./namespaceChart";

interface NamespaceChartProps {
  root: NamespaceNode;
  collapsed: Set<string>;
  search: string;
  selectedPath: string | null;
  now: number;
  focusPath: { path: string; revision: number } | null;
  onToggle: (path: string) => void;
  onSelect: (path: string) => void;
}
type Camera = { x: number; y: number; zoom: number };
const COLORS = ["#43d8f1", "#82b5f6", "#e9bd70", "#6ed6a2"];
const LEVELS = ["Enterprise", "Site", "Line", "Device"];

export default function NamespaceTreeChart({ root, collapsed, search, selectedPath, now, focusPath, onToggle, onSelect }: NamespaceChartProps) {
  const viewport = useRef<HTMLDivElement>(null);
  const drag = useRef<{ id: number; x: number; y: number; camera: Camera } | null>(null);
  const initialized = useRef(false);
  const measuredSize = useRef({ width: 800, height: 500 });
  const lastSearch = useRef("");
  const lastFocus = useRef(-1);
  const [size, setSize] = useState({ width: 800, height: 500 });
  const [camera, setCamera] = useState<Camera>({ x: 32, y: 32, zoom: 1 });
  const [dragging, setDragging] = useState(false);
  const chart = layoutNamespaceChart(root, collapsed, search);
  const selected = chart.nodes.find(({ node }) => node.path === selectedPath);
  const selectedAncestors = new Set(selectedPath?.split("/").map((_, index, segments) => segments.slice(0, index + 1).join("/")) ?? []);

  useEffect(() => {
    const element = viewport.current;
    if (!element) return;
    const measure = () => {
      const bounds = element.getBoundingClientRect();
      if (bounds.width > 0 && bounds.height > 0) {
        const previous = measuredSize.current;
        const next = { width: bounds.width, height: bounds.height };
        if (initialized.current && (previous.width !== next.width || previous.height !== next.height)) {
          // Retain the explored world center when details or the viewport resize.
          setCamera((current) => ({ ...current, x: current.x + (next.width - previous.width) / 2, y: current.y + (next.height - previous.height) / 2 }));
        }
        measuredSize.current = next;
        setSize(next);
      }
    };
    measure();
    if (typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(measure);
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (chart.nodes.length === 0) return;
    if (!initialized.current) {
      initialized.current = true;
      const measured = viewport.current?.getBoundingClientRect();
      const viewSize = measured?.width && measured.height ? measured : size;
      const fitted = fitNamespaceChart(chart.width, chart.height, viewSize.width, viewSize.height);
      const zoom = Math.max(.75, fitted.zoom);
      setCamera({ x: Math.max(28, (viewSize.width - chart.width * zoom) / 2), y: Math.max(28, (viewSize.height - chart.height * zoom) / 2), zoom });
    }
    const query = search.trim().toLocaleLowerCase();
    if (query && query !== lastSearch.current) {
      const match = chart.nodes.find(({ node }) => node.path.toLocaleLowerCase().includes(query) || payloadEntries(node.payload).some(([key]) => key.toLocaleLowerCase().includes(query)));
      if (match) setCamera((previous) => focusNamespaceChart(match, size.width, size.height, Math.max(.85, previous.zoom)));
    }
    lastSearch.current = query;
    if (focusPath && lastFocus.current !== focusPath.revision) {
      const match = chart.nodes.find(({ node }) => node.path === focusPath.path);
      if (match) {
        lastFocus.current = focusPath.revision;
        setCamera((previous) => focusNamespaceChart(match, size.width, size.height, Math.max(.85, previous.zoom)));
      }
    }
  }, [chart.nodes, chart.width, chart.height, focusPath, search, size]);

  const zoom = (factor: number, anchor = { x: size.width / 2, y: size.height / 2 }) => setCamera((previous) => zoomNamespaceChart(previous, previous.zoom * factor, anchor.x, anchor.y));
  const fit = () => setCamera(fitNamespaceChart(chart.width, chart.height, size.width, size.height));
  const centerSelection = () => { if (selected) setCamera(focusNamespaceChart(selected, size.width, size.height, Math.max(.85, camera.zoom))); };
  const startDrag = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (event.button !== 0 || (event.target as Element).closest("button")) return;
    drag.current = { id: event.pointerId, x: event.clientX, y: event.clientY, camera };
    event.currentTarget.setPointerCapture?.(event.pointerId);
    setDragging(true);
  };
  const moveDrag = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (!drag.current || drag.current.id !== event.pointerId) return;
    setCamera({ ...drag.current.camera, x: drag.current.camera.x + event.clientX - drag.current.x, y: drag.current.camera.y + event.clientY - drag.current.y });
  };
  const stopDrag = () => { drag.current = null; setDragging(false); };
  useEffect(() => {
    const element = viewport.current;
    if (!element) return;
    const wheel = (event: WheelEvent) => {
      event.preventDefault();
      if (event.ctrlKey || event.metaKey) {
        const bounds = element.getBoundingClientRect();
        setCamera((previous) => zoomNamespaceChart(previous, previous.zoom * Math.exp(-event.deltaY * .003), event.clientX - bounds.left, event.clientY - bounds.top));
      } else setCamera((previous) => ({ ...previous, x: previous.x - event.deltaX - (event.shiftKey ? event.deltaY : 0), y: previous.y - (event.shiftKey ? 0 : event.deltaY) }));
    };
    element.addEventListener("wheel", wheel, { passive: false });
    return () => element.removeEventListener("wheel", wheel);
  }, []);
  const miniScale = Math.min(160 / Math.max(1, chart.width), 78 / Math.max(1, chart.height));
  const reveal = (path: string) => {
    const match = chart.nodes.find(({ node }) => node.path === path);
    if (!match) return;
    const x = camera.x + match.x * camera.zoom;
    const y = camera.y + match.y * camera.zoom;
    if (x < 0 || y < 0 || x + match.width * camera.zoom > size.width || y + match.height * camera.zoom > size.height) setCamera(focusNamespaceChart(match, size.width, size.height, camera.zoom));
  };

  return <div className="uns-chart-shell">
    <div className="uns-chart-heading"><span><FolderTree size={16} />Namespace map</span><span>{chart.nodes.length} nodes · {chart.links.length} connections</span></div>
    <div role="navigation" aria-label="Namespace hierarchy" className={`uns-chart-viewport ${dragging ? "is-dragging" : ""}`} ref={viewport} tabIndex={0}
      onPointerDown={startDrag} onPointerMove={moveDrag} onPointerUp={stopDrag} onPointerCancel={stopDrag} onLostPointerCapture={stopDrag}
      onKeyDown={(event) => {
        if (event.target !== event.currentTarget) return;
        const steps: Record<string, [number, number]> = { ArrowLeft: [72, 0], ArrowRight: [-72, 0], ArrowUp: [0, 72], ArrowDown: [0, -72] };
        if (steps[event.key]) { event.preventDefault(); const [x, y] = steps[event.key]; setCamera((previous) => ({ ...previous, x: previous.x + x, y: previous.y + y })); }
        if (event.key === "+" || event.key === "=") { event.preventDefault(); zoom(1.2); }
        if (event.key === "-") { event.preventDefault(); zoom(1 / 1.2); }
        if (event.key === "Home") { event.preventDefault(); fit(); }
      }} aria-describedby="uns-chart-help">
      <div className="uns-chart-world" style={{ width: chart.width, height: chart.height, transform: `translate(${camera.x}px, ${camera.y}px) scale(${camera.zoom})` }}>
        <svg className="uns-chart-links" width={chart.width} height={chart.height} aria-hidden="true">
          {chart.links.map((link) => <path key={link.target} d={link.path} className={selectedAncestors.has(link.target) ? "is-selected-path" : undefined} />)}
        </svg>
        {chart.nodes.map(({ node, x, y, width, height }) => {
          const activity = namespaceActivity(node, now);
          const receiving = node.lastSeen !== null && now - node.lastSeen < 5000;
          const Icon = node.isTopic ? Database : [Building2, Factory, Layers3, Server][Math.min(node.depth - 1, 3)] ?? FolderTree;
          const tags = node.isTopic && node.payload !== null && typeof node.payload === "object" && !Array.isArray(node.payload) ? payloadEntries(node.payload).length : null;
          const isExpanded = Boolean(search.trim()) || !collapsed.has(node.path);
          return <div key={node.path} className={`uns-chart-node ${selectedPath === node.path ? "is-selected" : ""} ${selectedAncestors.has(node.path) ? "is-selected-path" : ""}`} style={{ left: x, top: y, width, height, "--node-color": COLORS[Math.min(node.depth - 1, 3)] } as CSSProperties}>
            <button type="button" className="uns-chart-node-select" title={node.path} aria-current={selectedPath === node.path ? "true" : undefined} onClick={() => onSelect(node.path)} onFocus={() => reveal(node.path)}>
              <span className="uns-chart-node-kind"><Icon size={17} />{node.isTopic ? "Published topic" : LEVELS[node.depth - 1] ?? "Namespace"}</span>
              <strong>{node.name}</strong>
              <span className="uns-chart-node-metrics"><span><i className={receiving ? "is-receiving" : ""} />{activity.rateHz.toFixed(1)} Hz</span><span>{tags !== null ? `${tags} tags` : `${activity.topics} ${activity.topics === 1 ? "topic" : "topics"}`}</span></span>
            </button>
            {node.children.size > 0 && <button type="button" className="uns-chart-node-expand" aria-label={`${isExpanded ? "Collapse" : "Expand"} ${node.path}`} aria-expanded={isExpanded} disabled={Boolean(search.trim())} onClick={() => onToggle(node.path)} onFocus={() => reveal(node.path)}>{isExpanded ? <ChevronDown size={15} /> : <ChevronRight size={15} />}</button>}
          </div>;
        })}
      </div>
    </div>
    <div className="uns-chart-bottom">
      <button type="button" className="uns-chart-overview" onClick={fit} aria-label="Fit tree using overview" title="Fit entire tree">
        <svg viewBox="0 0 176 92" aria-hidden="true">
          <g transform="translate(8 7)">
            {chart.nodes.map(({ node, x, y, width, height }) => <rect key={node.path} x={x * miniScale} y={y * miniScale} width={Math.max(3, width * miniScale)} height={Math.max(2, height * miniScale)} rx="1" className={selectedPath === node.path ? "is-selected" : undefined} />)}
            <rect className="uns-chart-overview-camera" x={Math.max(0, -camera.x / camera.zoom) * miniScale} y={Math.max(0, -camera.y / camera.zoom) * miniScale} width={Math.min(chart.width, size.width / camera.zoom) * miniScale} height={Math.min(chart.height, size.height / camera.zoom) * miniScale} />
          </g>
        </svg>
      </button>
      <p id="uns-chart-help">Drag to explore<span> · Ctrl / ⌘ scroll to zoom · Arrow keys to pan</span></p>
      <div className="uns-chart-controls" aria-label="Tree chart controls"><button type="button" onClick={() => zoom(1 / 1.2)} aria-label="Zoom out" disabled={camera.zoom <= .35}><Minus size={16} /></button><output aria-label="Chart zoom">{Math.round(camera.zoom * 100)}%</output><button type="button" onClick={() => zoom(1.2)} aria-label="Zoom in" disabled={camera.zoom >= 1.5}><Plus size={16} /></button><button type="button" onClick={fit} aria-label="Fit tree" title="Fit tree"><Scan size={17} /></button><button type="button" onClick={centerSelection} disabled={!selected} aria-label="Center selected node" title="Center selected node"><Focus size={17} /></button></div>
    </div>
  </div>;
}
