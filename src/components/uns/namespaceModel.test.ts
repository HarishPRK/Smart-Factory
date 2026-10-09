import { describe, expect, it } from "vitest";
import { comparePayloads, createNamespaceNode, findNamespaceNode, formatNamespaceValue, ingestNamespace, namespaceActivity, namespaceCoverage, namespaceMatches, namespaceSnapshot, namespaceTopics, payloadEntries, payloadType } from "./namespaceModel";

describe("received Unified Namespace model", () => {
  it("discovers arbitrary equipment paths and retains every terminal topic", () => {
    const root = createNamespaceNode();
    ingestNamespace(root, "enterprise/site/line/device/data", { voltage: 0 }, 100_000);
    ingestNamespace(root, "meter/data", 0, 100_100);
    ingestNamespace(root, "enterprise/site/line/device", { status: "running" }, 100_200);
    expect(namespaceTopics(root).map((node) => node.path)).toEqual(["enterprise/site/line/device", "enterprise/site/line/device/data", "meter/data"]);
    expect(findNamespaceNode(root, "enterprise/site/line/device/data")?.payload).toEqual({ voltage: 0 });
    expect(root.lastSeen).toBe(100_200);
  });
  it("counts actual arrivals, including unchanged values, and updates the latest payload", () => {
    const root = createNamespaceNode();
    ingestNamespace(root, "plant/plc/data", { value: 0 }, 99_000);
    ingestNamespace(root, "plant/plc/data", { value: 0 }, 100_000);
    expect(namespaceActivity(root, 100_000)).toMatchObject({ rateHz: .2, messages: 2, topics: 1 });
    expect(namespaceActivity(root, 100_000).bins.reduce((sum, count) => sum + count, 0)).toBe(2);
    expect(namespaceActivity(root, 120_000).rateHz).toBe(0);
    expect(namespaceActivity(root, 170_000).bins.every((count) => count === 0)).toBe(true);
  });
  it("does not treat parent activity as an extra topic or fabricate traffic", () => {
    const root = createNamespaceNode();
    ingestNamespace(root, "plant/plc/boardA", { value: 1 }, 100_000);
    ingestNamespace(root, "plant/plc/boardB", { value: 2 }, 100_000);
    expect(namespaceActivity(findNamespaceNode(root, "plant")!, 100_000)).toMatchObject({ rateHz: .2, messages: 2, topics: 2 });
    expect(namespaceActivity(root, 99_000).bins.every((count) => count === 0)).toBe(true);
  });
  it("keeps ancestors when topic paths or payload tag names match a search", () => {
    const root = createNamespaceNode();
    ingestNamespace(root, "plant/plc/boardA", { pressure_sensor: 65 }, 100_000);
    ingestNamespace(root, "meter/data", {}, 100_000);
    expect(namespaceMatches(findNamespaceNode(root, "plant")!, "PRESSURE")).toBe(true);
    expect(namespaceMatches(findNamespaceNode(root, "meter")!, "pressure")).toBe(false);
    expect(namespaceMatches(findNamespaceNode(root, "plant")!, "boardA")).toBe(true);
  });
  it("preserves raw value precision and valid zero, false, null and array payloads", () => {
    expect(formatNamespaceValue(0)).toBe("0");
    expect(formatNamespaceValue(false)).toBe("false");
    expect(formatNamespaceValue(null)).toBe("null");
    expect(formatNamespaceValue(4.310234)).toBe("4.310234");
    expect(formatNamespaceValue([0, 1])).toBe("[0,1]");
    expect(payloadEntries({ _meta: 5, actual: 0 })).toEqual([["actual", 0]]);
  });
  it("rejects empty topics and invalid timestamps without adding data", () => {
    const root = createNamespaceNode();
    expect(ingestNamespace(root, "///", {}, 100_000)).toBe(false);
    expect(ingestNamespace(root, "meter/data", {}, Number.NaN)).toBe(false);
    expect(namespaceTopics(root)).toEqual([]);
    expect(root.lastSeen).toBeNull();
  });

  it("distinguishes field changes from missing values, types and metadata updates", () => {
    const changes = comparePayloads(
      { voltage: 0, enabled: false, removed: null, nested: { a: 1, b: [0, false] }, _ts: 1 },
      { voltage: "0", enabled: false, added: 0, nested: { b: [0, false], a: 1 }, _ts: 2 },
    );
    expect(changes).toEqual([
      { key: "voltage", kind: "changed", before: 0, after: "0" },
      { key: "removed", kind: "removed", before: null, after: undefined },
      { key: "added", kind: "added", before: undefined, after: 0 },
    ]);
    expect(comparePayloads([0, false], [0, false])).toEqual([]);
    expect(comparePayloads(false, 0)).toEqual([{ key: "Payload", kind: "changed", before: false, after: 0 }]);
    expect([0, false, "0", null, [], {}].map(payloadType)).toEqual(["number", "boolean", "string", "null", "array", "object"]);
  });

  it("keeps bounded actual traces and receipts without truncating session counts", () => {
    const root = createNamespaceNode();
    for (let i = 0; i < 40; i++) ingestNamespace(root, "plant/data", { value: i % 2 ? 0 : 4.31, fixed: 0, _ts: i }, 100_000 + i * 1000);
    const topic = findNamespaceNode(root, "plant/data")!;
    expect(topic.messageCount).toBe(40);
    expect(topic.receipts).toHaveLength(12);
    expect(topic.receipts[0].sequence).toBe(29);
    expect(topic.numericHistory.get("value")).toHaveLength(40);
    expect(topic.numericHistory.get("value")?.[0]).toEqual({ timestamp: 100_000, value: 4.31 });
    expect(topic.numericHistory.get("fixed")?.every((point) => point.value === 0)).toBe(true);
    expect(topic.numericHistory.has("_ts")).toBe(false);
    ingestNamespace(root, "plant/data", { value: "missing", label: "°C" }, 140_000);
    expect(topic.numericHistory.size).toBe(0);
    expect(topic.firstSeen).toBe(100_000);
    expect(topic.payloadBytes).toBe(new TextEncoder().encode(JSON.stringify(topic.payload)).length);
    expect(topic.receipts.at(-1)).toMatchObject({ sequence: 41, changed: 1, added: 1, removed: 1, first: false });
  });

  it("caps numeric fields while preserving the entire latest payload", () => {
    const root = createNamespaceNode();
    const payload = Object.fromEntries(Array.from({ length: 80 }, (_, index) => [`field${index}`, index]));
    ingestNamespace(root, "plant/data", payload, 100_000);
    const topic = findNamespaceNode(root, "plant/data")!;
    expect(topic.numericHistory.size).toBe(64);
    expect(payloadEntries(topic.payload)).toHaveLength(80);
    expect(topic.receipts[0]).toMatchObject({ first: true, changed: 0, added: 0, removed: 0 });
  });

  it("counts actual hierarchy nodes and exports only received topic snapshots", () => {
    const root = createNamespaceNode();
    const equipment = "prplInnovationHub/McKinney/production/lineA/cell1/plc1";
    ingestNamespace(root, `${equipment}/data/boardA`, { voltage: 4.31, enabled: false }, 100_000);
    ingestNamespace(root, `${equipment}/data/boardB`, { pressure: 0 }, 100_100);
    expect(namespaceCoverage(root)).toEqual([1, 1, 1, 1, 1, 1]);
    const snapshot = namespaceSnapshot(root, 101_000);
    expect(snapshot.filter).toBe("prplInnovationHub/#");
    expect(snapshot.topics).toHaveLength(2);
    expect(snapshot.topics[0]).toMatchObject({ topic: `${equipment}/data/boardA`, firstReceivedAt: 100_000, lastReceivedAt: 100_000, sessionMessages: 1, rateHzOver10Seconds: .1, latestPayload: { voltage: 4.31, enabled: false } });
    expect(snapshot.hierarchy).toEqual(["Location", "Site", "Area", "Line", "Cell", "Equipment"]);
  });
});
