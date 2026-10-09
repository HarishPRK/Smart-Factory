import { isFactoryTopic, PLC_NAMESPACE_FILTER } from "../../services/plcTopics";

export const NAMESPACE_LEVELS = ["Location", "Site", "Area", "Line", "Cell", "Equipment"] as const;

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
}

export const FACTORY_UNS_FILTER = PLC_NAMESPACE_FILTER;

/** Match the configured factory namespace exactly; meter traffic is separate. */
export function isFactoryNamespaceTopic(topic: string): boolean {
  return isFactoryTopic(topic);
}

export function createNamespaceNode(name = "", path = "", depth = 0): NamespaceNode {
  return { name, path, depth, children: new Map(), isTopic: false, messageCount: 0, lastSeen: null, hits: [], payload: undefined };
}

/** Preserve discovery from every received broker topic; no configured equipment list. */
export function ingestNamespace(root: NamespaceNode, topic: string, payload: unknown, timestamp: number): boolean {
  const segments = topic.split("/").filter(Boolean);
  if (!segments.length || !Number.isFinite(timestamp)) return false;
  let node = root;
  root.lastSeen = timestamp;
  for (const name of segments) {
    let child = node.children.get(name);
    if (!child) {
      child = createNamespaceNode(name, node.path ? `${node.path}/${name}` : name, node.depth + 1);
      node.children.set(name, child);
    }
    child.lastSeen = timestamp;
    node = child;
  }
  node.isTopic = true;
  node.messageCount += 1;
  node.payload = payload;
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
