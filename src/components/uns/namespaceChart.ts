import { namespaceChildren, namespaceMatches, type NamespaceNode } from "./namespaceModel";

export interface NamespaceChartNode {
  node: NamespaceNode;
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface NamespaceChartLink {
  source: string;
  target: string;
  path: string;
}

export interface NamespaceChart {
  nodes: NamespaceChartNode[];
  links: NamespaceChartLink[];
  width: number;
  height: number;
}

export interface NamespaceChartCamera {
  x: number;
  y: number;
  zoom: number;
}

const NODE_WIDTH = 200;
const NODE_HEIGHT = 104;
const COLUMN_GAP = 32;
const ROW_GAP = 76;
const PADDING = 32;
const MIN_ZOOM = .35;
const MAX_ZOOM = 1.5;

/** Top-to-bottom forest of discovered segments, with no invented broker/root node. */
export function layoutNamespaceChart(root: NamespaceNode, collapsed: Set<string>, search: string): NamespaceChart {
  const nodes: NamespaceChartNode[] = [];
  const links: NamespaceChartLink[] = [];
  const query = search.trim();
  let leafSlot = 0;

  const visit = (node: NamespaceNode, row: number): NamespaceChartNode => {
    const children = query || !collapsed.has(node.path)
      ? namespaceChildren(node).filter((child) => namespaceMatches(child, query))
      : [];
    // Keep traversal order predictable even though parent positions depend on their descendants.
    const placed: NamespaceChartNode = {
      node,
      x: 0,
      y: PADDING + row * (NODE_HEIGHT + ROW_GAP),
      width: NODE_WIDTH,
      height: NODE_HEIGHT,
    };
    nodes.push(placed);
    const descendants = children.map((child) => visit(child, row + 1));
    placed.x = descendants.length
      ? (descendants[0].x + descendants[descendants.length - 1].x) / 2
      : PADDING + leafSlot++ * (NODE_WIDTH + COLUMN_GAP);

    for (const child of descendants) {
      const sourceX = placed.x + NODE_WIDTH / 2;
      const sourceY = placed.y + NODE_HEIGHT;
      const targetX = child.x + NODE_WIDTH / 2;
      const targetY = child.y;
      const elbowY = sourceY + ROW_GAP / 2;
      links.push({
        source: node.path,
        target: child.node.path,
        path: `M ${sourceX} ${sourceY} V ${elbowY} H ${targetX} V ${targetY}`,
      });
    }
    return placed;
  };

  for (const child of namespaceChildren(root)) {
    if (namespaceMatches(child, query)) visit(child, 0);
  }

  return {
    nodes,
    links,
    width: nodes.length ? PADDING * 2 + leafSlot * (NODE_WIDTH + COLUMN_GAP) - COLUMN_GAP : PADDING * 2,
    height: nodes.length ? Math.max(...nodes.map((node) => node.y + node.height)) + PADDING : PADDING * 2,
  };
}

function nonnegativeFinite(value: number): number {
  return Number.isFinite(value) ? Math.max(0, value) : 0;
}

function boundedZoom(value: number, maximum = MAX_ZOOM): number {
  return Math.min(maximum, Math.max(MIN_ZOOM, Number.isFinite(value) ? value : 1));
}

/** Fit with a visible margin; large trees remain pannable instead of becoming unreadably tiny. */
export function fitNamespaceChart(chartWidth: number, chartHeight: number, viewportWidth: number, viewportHeight: number): NamespaceChartCamera {
  const width = nonnegativeFinite(chartWidth);
  const height = nonnegativeFinite(chartHeight);
  const viewportW = nonnegativeFinite(viewportWidth);
  const viewportH = nonnegativeFinite(viewportHeight);
  const zoom = boundedZoom(Math.min(
    width ? Math.max(0, viewportW - PADDING * 2) / width : 1,
    height ? Math.max(0, viewportH - PADDING * 2) / height : 1,
  ), 1);
  return { x: (viewportW - width * zoom) / 2, y: (viewportH - height * zoom) / 2, zoom };
}

export function focusNamespaceChart(node: NamespaceChartNode, viewportWidth: number, viewportHeight: number, zoom: number): NamespaceChartCamera {
  const scale = boundedZoom(zoom);
  return {
    x: nonnegativeFinite(viewportWidth) / 2 - (node.x + node.width / 2) * scale,
    y: nonnegativeFinite(viewportHeight) / 2 - (node.y + node.height / 2) * scale,
    zoom: scale,
  };
}

/** Preserve the world point under the cursor (or viewport center) while zooming. */
export function zoomNamespaceChart(camera: NamespaceChartCamera, nextZoom: number, anchorX: number, anchorY: number): NamespaceChartCamera {
  const previousZoom = boundedZoom(camera.zoom);
  const zoom = boundedZoom(nextZoom);
  const x = Number.isFinite(camera.x) ? camera.x : 0;
  const y = Number.isFinite(camera.y) ? camera.y : 0;
  const anchorLeft = Number.isFinite(anchorX) ? anchorX : 0;
  const anchorTop = Number.isFinite(anchorY) ? anchorY : 0;
  return {
    x: anchorLeft - (anchorLeft - x) / previousZoom * zoom,
    y: anchorTop - (anchorTop - y) / previousZoom * zoom,
    zoom,
  };
}
