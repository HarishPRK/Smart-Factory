import { namespaceTopics, type NamespaceNode, type NamespaceSecond } from "./namespaceModel";

export const TRAFFIC_COLORS = ["#43d8f1", "#c7a4ed", "#e9bd70", "#6ed6a2", "#82b5f6", "#f18b82", "#a7bbc6", "#58c9bf"];

/** Received-traffic metrics: the current second is partial and all series share a clock. */
export function namespaceTraffic(root: NamespaceNode, now: number) {
  const end = Math.floor(now / 1000), start = end - 59;
  const series = namespaceTopics(root).map((node, index) => {
    const bins = Array.from({ length: 60 }, () => 0);
    const buckets = node.seconds.filter((entry) => entry.second >= start && entry.second <= end);
    for (const entry of buckets) bins[entry.second - start] += entry.messages;
    return { node, color: TRAFFIC_COLORS[index % TRAFFIC_COLORS.length], bins, buckets, count: bins.reduce((a, b) => a + b, 0) };
  });
  const bins = Array.from({ length: 60 }, (_, index) => series.reduce((sum, row) => sum + row.bins[index], 0));
  const changes = Array.from({ length: 12 }, (_, index) => ({ timestamp: (start + index * 5) * 1000, changed: 0, added: 0, removed: 0 }));
  const totals = { messages: 0, bytes: 0, changed: 0, added: 0, removed: 0, unchanged: 0, first: 0 };
  for (const row of series) for (const bucket of row.buckets) {
    for (const key of Object.keys(totals) as (keyof typeof totals)[]) totals[key] += bucket[key as keyof NamespaceSecond];
    const group = changes[Math.floor((bucket.second - start) / 5)];
    group.changed += bucket.changed; group.added += bucket.added; group.removed += bucket.removed;
  }
  return { series, bins, changes, totals, start, end, peak: Math.max(0, ...bins) };
}

export function topicCadence(node: NamespaceNode, now: number) {
  const hits = node.hits.filter((time) => time > now - 60_000 && time <= now);
  const gaps = hits.slice(1).map((time, index) => time - hits[index]).filter((gap) => gap >= 0).sort((a, b) => a - b);
  if (!gaps.length) return null;
  return { min: gaps[0], median: (gaps[Math.floor((gaps.length - 1) / 2)] + gaps[Math.floor(gaps.length / 2)]) / 2, p95: gaps[Math.ceil(gaps.length * .95) - 1], max: gaps.at(-1)!, count: gaps.length };
}

export function numericFieldStats(samples: { timestamp: number; value: number }[]) {
  if (!samples.length) return null;
  const values = samples.map((sample) => sample.value);
  return { min: Math.min(...values), max: Math.max(...values), average: values.reduce((a, b) => a + b / values.length, 0), latest: values.at(-1)!, count: values.length };
}
