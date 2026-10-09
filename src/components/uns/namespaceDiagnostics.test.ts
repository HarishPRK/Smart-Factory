import { describe, expect, it } from "vitest";
import { createNamespaceNode, findNamespaceNode, ingestNamespace } from "./namespaceModel";
import { namespaceTraffic, numericFieldStats, topicCadence } from "./namespaceMetrics";

describe("UNS diagnostics from actual receipts", () => {
  it("counts exact topic receipts without double-counting child topics", () => {
    const root = createNamespaceNode();
    ingestNamespace(root, "factory/plc", { status: true }, 100_000);
    ingestNamespace(root, "factory/plc/data", { voltage: 0 }, 100_100);
    ingestNamespace(root, "factory/plc/data", { voltage: 0 }, 100_200);
    const traffic = namespaceTraffic(root, 100_500);
    expect(traffic.totals.messages).toBe(3);
    expect(traffic.bins[59]).toBe(3);
    expect(traffic.series.map((row) => row.count)).toEqual([1, 2]);
    expect(traffic.totals).toMatchObject({ first: 2, unchanged: 1, changed: 0 });
    expect(traffic.totals.bytes).toBe(new TextEncoder().encode('{"status":true}').length + new TextEncoder().encode('{"voltage":0}').length * 2);
    expect(namespaceTraffic(root, 161_000).totals.messages).toBe(0);
  });
  it("aggregates field additions, removals and changes beyond the twelve-receipt feed", () => {
    const root = createNamespaceNode();
    ingestNamespace(root, "factory/data", { value: 0, removed: false, _ts: 1 }, 100_000);
    ingestNamespace(root, "factory/data", { value: 1, added: null, _ts: 2 }, 100_100);
    for (let i = 0; i < 50; i++) ingestNamespace(root, "factory/data", { value: 1, added: null, _ts: i + 3 }, 100_200 + i);
    const traffic = namespaceTraffic(root, 101_000);
    expect(traffic.totals).toMatchObject({ messages: 52, first: 1, changed: 1, added: 1, removed: 1, unchanged: 50 });
    expect(traffic.changes.reduce((sum, bucket) => sum + bucket.changed, 0)).toBe(1);
    expect(findNamespaceNode(root, "factory/data")!.receipts).toHaveLength(12);
  });
  it("prunes second buckets and caps field history at 120 actual samples", () => {
    const root = createNamespaceNode();
    for (let i = 0; i < 150; i++) ingestNamespace(root, "factory/data", { value: i }, i * 1000);
    const node = findNamespaceNode(root, "factory/data")!;
    expect(node.seconds).toHaveLength(60);
    expect(node.numericHistory.get("value")).toHaveLength(120);
    expect(node.numericHistory.get("value")![0]).toEqual({ timestamp: 30_000, value: 30 });
    expect(namespaceTraffic(root, 149_000).totals.messages).toBe(60);
    expect(node.messageCount).toBe(150);
  });
  it("measures interval statistics, including legitimate simultaneous receipts", () => {
    const root = createNamespaceNode();
    for (const timestamp of [100_000, 100_000, 101_000, 103_000, 108_000]) ingestNamespace(root, "factory/data", { value: 0 }, timestamp);
    const node = findNamespaceNode(root, "factory/data")!;
    expect(topicCadence(node, 109_000)).toEqual({ min: 0, median: 1500, p95: 5000, max: 5000, count: 4 });
    expect(topicCadence(node, 200_000)).toBeNull();
    expect(numericFieldStats(node.numericHistory.get("value")!)).toEqual({ min: 0, max: 0, average: 0, latest: 0, count: 5 });
    expect(numericFieldStats([])).toBeNull();
  });
});
