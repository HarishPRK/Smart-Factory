import React, { useEffect, useRef, useState } from "react";
import { subscribeAnyMessage } from "../services/plcService";

interface UNSExplorerPanelProps {
  open: boolean;
  onClose: () => void;
}

/* ── Namespace trie ─────────────────────────────────────
 * Built live from broker traffic: every `{topic, payload}` envelope grows
 * the tree, so new lines/devices appear with zero configuration — the whole
 * point of a Unified Namespace. Nothing here is hardcoded to plc1.
 */
interface UNSNode {
  name: string;
  path: string;
  depth: number;
  children: Map<string, UNSNode>;
  /** A message has terminated exactly at this path (topic node, not group). */
  isTopic: boolean;
  msgCount: number;
  /** Last activity in this subtree (bubbles up to ancestors for the pulse rail). */
  lastSeen: number;
  /** Recent arrival timestamps, topic nodes only — sliding window for Hz. */
  hits: number[];
  lastPayload: unknown;
}

const RATE_WINDOW_MS = 10_000;

function makeNode(name: string, path: string, depth: number): UNSNode {
  return {
    name,
    path,
    depth,
    children: new Map(),
    isTopic: false,
    msgCount: 0,
    lastSeen: 0,
    hits: [],
    lastPayload: null,
  };
}

function ingest(root: UNSNode, topic: string, payload: unknown) {
  const now = Date.now();
  const segments = topic.split("/").filter(Boolean);
  let node = root;
  root.lastSeen = now;
  for (const seg of segments) {
    let child = node.children.get(seg);
    if (!child) {
      child = makeNode(seg, node.path ? `${node.path}/${seg}` : seg, node.depth + 1);
      node.children.set(seg, child);
    }
    child.lastSeen = now;
    node = child;
  }
  node.isTopic = true;
  node.msgCount += 1;
  node.lastPayload = payload;
  node.hits.push(now);
  const cutoff = now - RATE_WINDOW_MS;
  while (node.hits.length && node.hits[0] < cutoff) node.hits.shift();
}

function rateHz(node: UNSNode): number {
  const now = Date.now();
  const recent = node.hits.filter((t) => t >= now - RATE_WINDOW_MS);
  return recent.length / (RATE_WINDOW_MS / 1000);
}

/* ── ISA-95 level annotation ────────────────────────────
 * In a UNS the topic path encodes the equipment hierarchy. The first four
 * levels get their standard names; deeper levels are data-class/source
 * nodes and stay unlabeled.
 */
const ISA95_LEVELS = ["Enterprise", "Site", "Line", "Device"];

function ageLabel(lastSeen: number): string {
  if (!lastSeen) return "—";
  const s = Math.max(0, Math.round((Date.now() - lastSeen) / 1000));
  if (s < 1) return "now";
  if (s < 60) return `${s}s ago`;
  const m = Math.floor(s / 60);
  return m < 60 ? `${m}m ago` : `${Math.floor(m / 60)}h ago`;
}

function formatValue(v: unknown): string {
  if (typeof v === "number") return Number.isInteger(v) ? String(v) : String(+v.toFixed(3));
  if (typeof v === "string") return v;
  if (typeof v === "boolean") return v ? "true" : "false";
  if (v === null || v === undefined) return "—";
  return JSON.stringify(v);
}

/* ── Row components ─────────────────────────────────────── */

const PulseDot: React.FC<{ lastSeen: number }> = ({ lastSeen }) => {
  const live = lastSeen && Date.now() - lastSeen < 5000;
  return (
    <span className="relative w-1.5 h-1.5 flex-none">
      <span
        className={`absolute inset-0 rounded-full ${live ? "bg-emerald-400/90" : "bg-white/15"}`}
      />
      {live ? (
        // key restarts the ripple on every observed message — this is the
        // pulse rail: watching data physically travel down the namespace.
        <span key={lastSeen} className="uns-pulse-ring absolute inset-0 rounded-full bg-emerald-400/70" />
      ) : null}
    </span>
  );
};

const TagGrid: React.FC<{ payload: unknown }> = ({ payload }) => {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    return (
      <div className="pl-9 pr-3 py-1.5 text-[10px] font-mono text-sky-200/50">
        {formatValue(payload)}
      </div>
    );
  }
  const entries = Object.entries(payload as Record<string, unknown>).filter(
    ([k]) => !k.startsWith("_"),
  );
  return (
    <div className="pl-9 pr-3 pb-2 pt-0.5 grid grid-cols-1 md:grid-cols-2 gap-x-6">
      {entries.map(([k, v]) => (
        <div
          key={k}
          className="flex items-baseline justify-between gap-3 py-[3px] border-b border-white/[0.03] last:border-0"
        >
          <span className="text-[10px] font-mono text-sky-200/45 truncate">{k}</span>
          {/* key = value → the flash restarts only when the reading changes */}
          <span
            key={formatValue(v)}
            className="uns-value-flash text-[10px] font-mono tabular-nums text-cyan-50/90 rounded px-1"
          >
            {formatValue(v)}
          </span>
        </div>
      ))}
    </div>
  );
};

const TreeRow: React.FC<{
  node: UNSNode;
  collapsed: Set<string>;
  openTopics: Set<string>;
  onToggle: (node: UNSNode) => void;
}> = ({ node, collapsed, openTopics, onToggle }) => {
  const hasChildren = node.children.size > 0;
  const isOpen = hasChildren ? !collapsed.has(node.path) : openTopics.has(node.path);
  const levelLabel = !node.isTopic && node.depth <= ISA95_LEVELS.length
    ? ISA95_LEVELS[node.depth - 1]
    : null;
  const tagCount =
    node.isTopic && node.lastPayload && typeof node.lastPayload === "object" && !Array.isArray(node.lastPayload)
      ? Object.keys(node.lastPayload as object).filter((k) => !k.startsWith("_")).length
      : null;
  const stale = !node.lastSeen || Date.now() - node.lastSeen > 15_000;

  return (
    <div>
      <button
        onClick={() => onToggle(node)}
        className={`w-full flex items-center gap-2 px-3 py-[5px] rounded-lg text-left transition-colors duration-150 hover:bg-white/[0.04] ${
          stale ? "opacity-45" : ""
        }`}
        style={{ paddingLeft: `${12 + (node.depth - 1) * 18}px` }}
      >
        {/* chevron / spacer */}
        <span className="w-3 flex-none text-white/30">
          {hasChildren || node.isTopic ? (
            <svg
              width="8"
              height="8"
              viewBox="0 0 8 8"
              className={`transition-transform duration-200 ${isOpen ? "rotate-90" : ""}`}
            >
              <path d="M2 1l4 3-4 3z" fill="currentColor" />
            </svg>
          ) : null}
        </span>

        <PulseDot lastSeen={node.lastSeen} />

        <span className={`text-[11px] font-mono truncate ${node.isTopic ? "text-cyan-50/90" : "text-white/70"}`}>
          {node.name}
        </span>

        {levelLabel && (
          <span className="flex-none text-[8px] uppercase tracking-[0.14em] text-cyan-300/45 border border-cyan-300/12 rounded px-1 py-px">
            {levelLabel}
          </span>
        )}

        <span className="flex-1" />

        {node.isTopic && (
          <>
            <span className="flex-none text-[9px] font-mono tabular-nums text-sky-200/55 w-14 text-right">
              {rateHz(node).toFixed(1)} Hz
            </span>
            {tagCount !== null && (
              <span className="flex-none text-[9px] font-mono tabular-nums text-white/35 w-14 text-right">
                {tagCount} tags
              </span>
            )}
            <span className="flex-none text-[9px] font-mono text-white/30 w-14 text-right">
              {ageLabel(node.lastSeen)}
            </span>
          </>
        )}
      </button>

      {/* children, with a hairline depth guide that encodes the hierarchy */}
      {hasChildren && isOpen && (
        <div
          className="relative"
          style={{ marginLeft: `${12 + (node.depth - 1) * 18 + 5}px` }}
        >
          <div className="absolute left-0 top-0 bottom-1 w-px bg-cyan-300/[0.08]" />
          <div style={{ marginLeft: `-${12 + (node.depth - 1) * 18 + 5}px` }}>
            {[...node.children.values()]
              .sort((a, b) => a.name.localeCompare(b.name))
              .map((child) => (
                <TreeRow
                  key={child.path}
                  node={child}
                  collapsed={collapsed}
                  openTopics={openTopics}
                  onToggle={onToggle}
                />
              ))}
          </div>
        </div>
      )}

      {node.isTopic && isOpen && <TagGrid payload={node.lastPayload} />}
    </div>
  );
};

/* ── Panel ──────────────────────────────────────────────── */

const UNSExplorerPanel: React.FC<UNSExplorerPanelProps> = ({ open, onClose }) => {
  const rootRef = useRef<UNSNode>(makeNode("", "", 0));
  const statsRef = useRef({ topics: 0, messages: 0 });
  const [, setVersion] = useState(0);
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  const [openTopics, setOpenTopics] = useState<Set<string>>(new Set());

  // Ingest every broker envelope; throttle re-renders to ~4 fps — the trie
  // itself is mutated per message, React only needs to repaint periodically.
  useEffect(() => {
    let pending = false;
    const unsubscribe = subscribeAnyMessage((topic, payload) => {
      ingest(rootRef.current, topic, payload);
      statsRef.current.messages += 1;
      if (!pending) {
        pending = true;
        setTimeout(() => {
          pending = false;
          setVersion((v) => v + 1);
        }, 250);
      }
    });
    // 1s heartbeat keeps ages/rates honest even when a branch goes quiet.
    const tick = setInterval(() => setVersion((v) => v + 1), 1000);
    return () => {
      unsubscribe();
      clearInterval(tick);
    };
  }, []);

  if (!open) return null;

  const root = rootRef.current;
  const countTopics = (n: UNSNode): number =>
    (n.isTopic ? 1 : 0) + [...n.children.values()].reduce((acc, c) => acc + countTopics(c), 0);
  const topicCount = countTopics(root);

  const onToggle = (node: UNSNode) => {
    if (node.children.size > 0) {
      setCollapsed((prev) => {
        const next = new Set(prev);
        if (next.has(node.path)) next.delete(node.path);
        else next.add(node.path);
        return next;
      });
    } else if (node.isTopic) {
      setOpenTopics((prev) => {
        const next = new Set(prev);
        if (next.has(node.path)) next.delete(node.path);
        else next.add(node.path);
        return next;
      });
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <style>{`
        @keyframes uns-pulse {
          0% { transform: scale(1); opacity: 0.7; }
          100% { transform: scale(3.2); opacity: 0; }
        }
        @keyframes uns-flash {
          0% { background-color: rgba(103, 232, 249, 0.14); }
          100% { background-color: transparent; }
        }
        .uns-pulse-ring { animation: uns-pulse 0.9s ease-out 1; }
        .uns-value-flash { animation: uns-flash 0.7s ease-out 1; }
        @media (prefers-reduced-motion: reduce) {
          .uns-pulse-ring, .uns-value-flash { animation: none; }
        }
      `}</style>

      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={onClose}
        style={{ animation: "fadeIn 0.25s ease" }}
      />

      <div
        className="relative w-[90vw] max-w-[760px] h-[82vh] bg-[#0a1628]/95 backdrop-blur-2xl border border-cyan-300/12 rounded-2xl shadow-[0_20px_80px_rgba(0,0,0,0.8)] flex flex-col overflow-hidden"
        style={{ animation: "modalIn 0.32s cubic-bezier(0.16, 1, 0.3, 1)" }}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-cyan-300/[0.08]">
          <div>
            <h2 className="text-[16px] font-semibold text-cyan-50 tracking-tight">UNS Explorer</h2>
            <p className="text-[11px] text-sky-200/60 font-medium mt-0.5">
              Unified Namespace — discovered live from broker traffic
            </p>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-lg bg-white/[0.04] border border-cyan-300/[0.08] flex items-center justify-center text-sky-200/60 hover:text-white hover:bg-white/[0.08] hover:rotate-90 transition-all duration-300"
          >
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
              <path d="M3 3l8 8M11 3l-8 8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
            </svg>
          </button>
        </div>

        {/* Tree */}
        <div className="flex-1 overflow-y-auto px-3 py-3">
          {root.children.size === 0 ? (
            <div className="h-full flex flex-col items-center justify-center gap-2 text-center px-10">
              <div className="text-[12px] text-sky-200/60 font-medium">Waiting for broker traffic</div>
              <div className="text-[10px] text-white/30 max-w-[340px]">
                The namespace builds itself from live messages — as soon as a device
                publishes, its branch appears here.
              </div>
            </div>
          ) : (
            [...root.children.values()]
              .sort((a, b) => a.name.localeCompare(b.name))
              .map((child) => (
                <TreeRow
                  key={child.path}
                  node={child}
                  collapsed={collapsed}
                  openTopics={openTopics}
                  onToggle={onToggle}
                />
              ))
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center gap-4 px-6 py-2.5 border-t border-cyan-300/[0.08] text-[9px] font-mono tabular-nums text-white/35">
          <span>{topicCount} topics</span>
          <span className="text-white/10">|</span>
          <span>{statsRef.current.messages.toLocaleString()} messages this session</span>
          <span className="flex-1" />
          <span className="uppercase tracking-[0.14em] text-cyan-300/40">ISA-95 · MQTT</span>
        </div>
      </div>
    </div>
  );
};

export default UNSExplorerPanel;
