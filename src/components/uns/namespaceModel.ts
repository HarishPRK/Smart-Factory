import { isFactoryTopic, PLC_NAMESPACE_FILTER } from "../../services/plcTopics";

export const NAMESPACE_LEVELS = ["Location", "Site", "Area", "Line", "Cell", "Equipment"] as const;

export type PayloadType = "number" | "boolean" | "string" | "array" | "object" | "null" | "undefined";
export interface PayloadChange { key: string; kind: "added" | "changed" | "removed"; before: unknown; after: unknown }
export interface NamespaceReceipt { sequence: number; timestamp: number; changed: number; added: number; removed: number; first: boolean }
export interface NamespaceSecond { second: number; messages: number; bytes: number; changed: number; added: number; removed: number; unchanged: number; first: number }

export interface NamespaceNode {
  name: string;
  path: string;
  depth: number;
  children: Map<string, NamespaceNode>;
  isTopic: boolean;
  messageCount: number;
  lastSeen: number | null;
  hits: number[];
  payload: unknown;
  firstSeen: number | null;
  payloadBytes: number | null;
  lastChanges: PayloadChange[];
  receipts: NamespaceReceipt[];
  seconds: NamespaceSecond[];
  numericHistory: Map<string, { timestamp: number; value: number }[]>;
}

export const FACTORY_UNS_FILTER = PLC_NAMESPACE_FILTER;

/** Match the configured factory namespace exactly; meter traffic is separate. */
export function isFactoryNamespaceTopic(topic: string): boolean {
  return isFactoryTopic(topic);
}

export function createNamespaceNode(name = "", path = "", depth = 0): NamespaceNode {
  return { name, path, depth, children: new Map(), isTopic: false, messageCount: 0, lastSeen: null, hits: [], payload: undefined, firstSeen: null, payloadBytes: null, lastChanges: [], receipts: [], seconds: [], numericHistory: new Map() };
}

/** Preserve discovery from every received broker topic; no configured equipment list. */
export function ingestNamespace(root: NamespaceNode, topic: string, payload: unknown, timestamp: number): boolean {
  const segments = topic.split("/").filter(Boolean);
  if (!segments.length || !Number.isFinite(timestamp)) return false;
  let node = root;
  root.lastSeen = timestamp;
  root.firstSeen ??= timestamp;
  for (const name of segments) {
    let child = node.children.get(name);
    if (!child) {
      child = createNamespaceNode(name, node.path ? `${node.path}/${name}` : name, node.depth + 1);
      node.children.set(name, child);
    }
    child.lastSeen = timestamp;
    child.firstSeen ??= timestamp;
    node = child;
  }
  const first = !node.isTopic;
  node.lastChanges = first ? [] : comparePayloads(node.payload, payload);
  node.isTopic = true;
  node.messageCount += 1;
  node.payload = payload;
  const serialized = JSON.stringify(payload);
  node.payloadBytes = serialized === undefined ? null : new TextEncoder().encode(serialized).length;
  node.receipts = [...node.receipts, {
    sequence: node.messageCount, timestamp, first,
    changed: node.lastChanges.filter((change) => change.kind === "changed").length,
    added: node.lastChanges.filter((change) => change.kind === "added").length,
    removed: node.lastChanges.filter((change) => change.kind === "removed").length,
  }].slice(-12);
  // Aggregate receipt facts by second so history stays bounded at high rates.
  const second = Math.floor(timestamp / 1000);
  node.seconds = node.seconds.filter((entry) => entry.second > second - 60);
  let bucket = node.seconds.find((entry) => entry.second === second);
  if (!bucket) {
    bucket = { second, messages: 0, bytes: 0, changed: 0, added: 0, removed: 0, unchanged: 0, first: 0 };
    node.seconds.push(bucket);
  }
  const receipt = node.receipts.at(-1)!;
  bucket.messages++; bucket.bytes += node.payloadBytes ?? 0;
  bucket.changed += receipt.changed; bucket.added += receipt.added; bucket.removed += receipt.removed;
  if (first) bucket.first++; else if (!node.lastChanges.length) bucket.unchanged++;
  // Keep small, bounded traces for the latest payload's first 64 numeric fields.
  const nextHistory: NamespaceNode["numericHistory"] = new Map();
  for (const [key, value] of payloadEntries(payload).filter(([, value]) => typeof value === "number" && Number.isFinite(value)).slice(0, 64)) {
    nextHistory.set(key, [...(node.numericHistory.get(key) ?? []), { timestamp, value: value as number }].slice(-120));
  }
  node.numericHistory = nextHistory;
  node.hits.push(timestamp);
  node.hits = node.hits.filter((hit) => hit >= timestamp - 60_000);
  return true;
}

export function namespaceChildren(node: NamespaceNode): NamespaceNode[] {
  return [...node.children.values()].sort((a, b) => a.name.localeCompare(b.name));
}

export function namespaceTopics(node: NamespaceNode): NamespaceNode[] {
  return [...(node.isTopic ? [node] : []), ...namespaceChildren(node).flatMap(namespaceTopics)];
}

export function findNamespaceNode(root: NamespaceNode, path: string): NamespaceNode | null {
  let node = root;
  for (const segment of path.split("/").filter(Boolean)) {
    const child = node.children.get(segment);
    if (!child) return null;
    node = child;
  }
  return node;
}

export function payloadEntries(payload: unknown): [string, unknown][] {
  return payload !== null && typeof payload === "object" && !Array.isArray(payload)
    ? Object.entries(payload).filter(([key]) => !key.startsWith("_"))
    : [];
}

export function namespaceMatches(node: NamespaceNode, search: string): boolean {
  const query = search.trim().toLocaleLowerCase();
  if (!query) return true;
  return node.path.toLocaleLowerCase().includes(query)
    || payloadEntries(node.payload).some(([key]) => key.toLocaleLowerCase().includes(query))
    || namespaceChildren(node).some((child) => namespaceMatches(child, query));
}

export function namespaceActivity(node: NamespaceNode, now: number): { rateHz: number; bins: number[]; messages: number; topics: number } {
  const topics = namespaceTopics(node);
  const hits = topics.flatMap((topic) => topic.hits).filter((hit) => hit <= now && hit > now - 60_000);
  const bins = Array.from({ length: 60 }, () => 0);
  for (const hit of hits) bins[Math.min(59, Math.floor((hit - (now - 60_000)) / 1000))] += 1;
  return {
    rateHz: hits.filter((hit) => hit > now - 10_000).length / 10,
    bins,
    messages: topics.reduce((total, topic) => total + topic.messageCount, 0),
    topics: topics.length,
  };
}

export function formatNamespaceValue(value: unknown): string {
  if (value === null) return "null";
  if (value === undefined) return "—";
  if (typeof value === "string") return value;
  if (typeof value === "object") return JSON.stringify(value);
  return String(value);
}

export function payloadType(value: unknown): PayloadType {
  if (value === null) return "null";
  if (Array.isArray(value)) return "array";
  return typeof value as PayloadType;
}

function sameValue(a: unknown, b: unknown): boolean {
  if (Object.is(a, b)) return true;
  if (payloadType(a) !== payloadType(b) || a === null || b === null || typeof a !== "object" || typeof b !== "object") return false;
  const left = Object.entries(a), right = Object.entries(b);
  return left.length === right.length && left.every(([key, value]) => Object.prototype.hasOwnProperty.call(b, key) && sameValue(value, (b as Record<string, unknown>)[key]));
}

/** Compare actual top-level payload fields. Missing keys are not numeric zero. */
export function comparePayloads(before: unknown, after: unknown): PayloadChange[] {
  const isRecord = (value: unknown) => value !== null && typeof value === "object" && !Array.isArray(value);
  if (!isRecord(before) || !isRecord(after)) return sameValue(before, after) ? [] : [{ key: "Payload", kind: "changed", before, after }];
  const previous = new Map(payloadEntries(before)), current = new Map(payloadEntries(after));
  return [...new Set([...previous.keys(), ...current.keys()])].flatMap((key) => {
    const kind = !previous.has(key) ? "added" : !current.has(key) ? "removed" : !sameValue(previous.get(key), current.get(key)) ? "changed" : null;
    return kind ? [{ key, kind, before: previous.get(key), after: current.get(key) }] : [];
  });
}

export function namespaceCoverage(root: NamespaceNode): number[] {
  const counts = NAMESPACE_LEVELS.map(() => 0);
  const visit = (node: NamespaceNode) => { if (node.depth >= 1 && node.depth <= counts.length) counts[node.depth - 1]++; node.children.forEach(visit); };
  visit(root);
  return counts;
}

export function namespaceSnapshot(root: NamespaceNode, now: number) {
  return {
    filter: FACTORY_UNS_FILTER, exportedAt: new Date(now).toISOString(), source: "received-mqtt-session",
    hierarchy: NAMESPACE_LEVELS,
    topics: namespaceTopics(root).map((topic) => ({
      topic: topic.path, firstReceivedAt: topic.firstSeen, lastReceivedAt: topic.lastSeen,
      sessionMessages: topic.messageCount, rateHzOver10Seconds: namespaceActivity(topic, now).rateHz,
      latestPayload: topic.payload,
    })),
  };
}
