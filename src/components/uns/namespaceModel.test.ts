import { describe, expect, it } from "vitest";
import { createNamespaceNode, findNamespaceNode, formatNamespaceValue, ingestNamespace, namespaceActivity, namespaceMatches, namespaceTopics, payloadEntries } from "./namespaceModel";

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
});
