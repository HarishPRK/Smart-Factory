import { describe, expect, it } from "vitest";
import { fitNamespaceChart, focusNamespaceChart, layoutNamespaceChart, zoomNamespaceChart } from "./namespaceChart";
import { createNamespaceNode, ingestNamespace } from "./namespaceModel";

function discovered(paths: string[]) {
  const root = createNamespaceNode();
  for (const path of paths) ingestNamespace(root, path, { voltage: 0 }, 100_000);
  return root;
}

function geometry(root: ReturnType<typeof createNamespaceNode>) {
  const chart = layoutNamespaceChart(root, new Set(), "");
  return { ...chart, nodes: chart.nodes.map(({ node, ...position }) => ({ path: node.path, ...position })) };
}

describe("Unified Namespace chart layout", () => {
  it("renders every discovered segment once and centers parents between their visible children", () => {
    const chart = layoutNamespaceChart(discovered(["plant/plc/boardB", "plant/plc/boardA", "meter/data"]), new Set(), "");
    expect(chart.nodes.map(({ node }) => node.path)).toEqual(["meter", "meter/data", "plant", "plant/plc", "plant/plc/boardA", "plant/plc/boardB"]);
    const plc = chart.nodes.find(({ node }) => node.path === "plant/plc")!;
    const boards = chart.nodes.filter(({ node }) => node.path.startsWith("plant/plc/"));
    expect(plc.x).toBe((boards[0].x + boards[1].x) / 2);
    expect(chart.nodes.every(({ width, height }) => width === 200 && height === 104)).toBe(true);
    expect(chart.nodes.find(({ node }) => node.path === "meter")?.x).toBe(32);
    expect(chart.nodes.find(({ node }) => node.path === "meter")?.y).toBe(32);
    expect(chart.nodes.find(({ node }) => node.path === "meter/data")?.y).toBe(212);
    expect(boards[0].y).toBe(392);
    expect(boards[1].x - boards[0].x).toBe(232);
    expect(chart.links).toHaveLength(4);
    expect(chart.links.find(({ target }) => target === "meter/data")?.path).toBe("M 132 136 V 174 H 132 V 212");
  });

  it("keeps unbalanced branches and independent roots apart with space around the entire forest", () => {
    const chart = layoutNamespaceChart(discovered(["a/p/q/r/s", "a/p/t", "a/u", "b/c/d", "b/e", "c"]), new Set(), "");
    for (let i = 0; i < chart.nodes.length; i++) {
      const a = chart.nodes[i];
      expect(a.x).toBeGreaterThanOrEqual(32);
      expect(a.y).toBeGreaterThanOrEqual(32);
      expect(a.x + a.width).toBeLessThanOrEqual(chart.width - 32);
      expect(a.y + a.height).toBeLessThanOrEqual(chart.height - 32);
      for (const b of chart.nodes.slice(i + 1)) {
        if (a.y !== b.y) continue;
        expect(Math.abs(a.x - b.x)).toBeGreaterThanOrEqual(232);
      }
    }
  });

  it("has deterministic positions independent of discovery order or repeated receipts", () => {
    const paths = ["plant/line/plc/boardB", "meter/data", "plant/line/plc/boardA", "plant/line/plc"];
    const root = discovered(paths);
    const initial = geometry(root);
    expect(initial).toEqual(geometry(discovered([...paths].reverse())));
    ingestNamespace(root, "plant/line/plc/boardB", { voltage: 6 }, 100_100);
    expect(geometry(root)).toEqual(initial);
  });

  it("collapses only descendants, including when a published topic is also a parent", () => {
    const root = discovered(["plant/plc", "plant/plc/boardA", "plant/plc/boardB", "meter/data"]);
    const chart = layoutNamespaceChart(root, new Set(["plant/plc"]), "");
    expect(chart.nodes.map(({ node }) => node.path)).toEqual(["meter", "meter/data", "plant", "plant/plc"]);
    expect(chart.nodes.find(({ node }) => node.path === "plant/plc")?.node.isTopic).toBe(true);
    expect(chart.links.some(({ target }) => target.includes("board"))).toBe(false);
  });

  it("searches payload tags, retains all matching ancestors and ignores collapse on matching paths", () => {
    const root = discovered(["plant/plc/boardA", "plant/plc/boardB", "meter/data"]);
    ingestNamespace(root, "plant/plc/boardB", { pressure_sensor: 65 }, 100_100);
    const chart = layoutNamespaceChart(root, new Set(["plant", "plant/plc"]), " PRESSURE ");
    expect(chart.nodes.map(({ node }) => node.path)).toEqual(["plant", "plant/plc", "plant/plc/boardB"]);
    expect(chart.links).toHaveLength(2);
    expect(layoutNamespaceChart(root, new Set(), "missing").nodes).toEqual([]);
  });

  it("has no fabricated root or empty-namespace nodes and retains finite extents", () => {
    expect(layoutNamespaceChart(createNamespaceNode(), new Set(), "")).toEqual({ nodes: [], links: [], width: 64, height: 64 });
  });
});

describe("Unified Namespace chart camera", () => {
  it("fits within the viewport with a margin and clamps the scale for very large or small trees", () => {
    expect(fitNamespaceChart(500, 300, 1000, 600)).toEqual({ x: 250, y: 150, zoom: 1 });
    const fit = fitNamespaceChart(1000, 600, 800, 600);
    expect(fit.zoom).toBe(.736);
    expect(fit.x).toBe(32);
    expect(fit.y).toBeGreaterThanOrEqual(32);
    expect(fitNamespaceChart(10000, 10000, 400, 300).zoom).toBe(.35);
    expect(Object.values(fitNamespaceChart(0, 0, 0, 0)).every(Number.isFinite)).toBe(true);
    expect(Object.values(fitNamespaceChart(Number.NaN, Infinity, -1, Number.NaN)).every(Number.isFinite)).toBe(true);
  });

  it("centers the selected node without changing a valid zoom", () => {
    const node = layoutNamespaceChart(discovered(["plant/plc/data"]), new Set(), "").nodes[2];
    const focused = focusNamespaceChart(node, 800, 600, .8);
    expect(focused.x + (node.x + node.width / 2) * focused.zoom).toBe(400);
    expect(focused.y + (node.y + node.height / 2) * focused.zoom).toBe(300);
    expect(focused.zoom).toBe(.8);
  });

  it("keeps the anchored world position fixed through zoom and applies finite limits", () => {
    const camera = { x: 45, y: -20, zoom: .8 };
    const anchor = { x: 500, y: 240 };
    const next = zoomNamespaceChart(camera, 1.2, anchor.x, anchor.y);
    expect((anchor.x - next.x) / next.zoom).toBeCloseTo((anchor.x - camera.x) / camera.zoom);
    expect((anchor.y - next.y) / next.zoom).toBeCloseTo((anchor.y - camera.y) / camera.zoom);
    expect(zoomNamespaceChart(camera, 5, 0, 0).zoom).toBe(1.5);
    expect(zoomNamespaceChart(camera, -5, 0, 0).zoom).toBe(.35);
    expect(Object.values(zoomNamespaceChart({ x: NaN, y: Infinity, zoom: 0 }, NaN, NaN, Infinity)).every(Number.isFinite)).toBe(true);
  });
});
