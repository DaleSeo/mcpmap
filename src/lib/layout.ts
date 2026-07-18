// elkjs layout for explorer subgraphs. Runs a layered ("hierarchical") layout
// so reference chains read top-to-bottom, and returns node positions keyed by
// type name for React Flow to consume. Async because elk.layout is async.

import type { ELK as ElkInstance } from "elkjs/lib/elk-api.js";
import type { Subgraph } from "./graph.ts";

export const NODE_WIDTH = 190;
export const NODE_HEIGHT = 48;

// elkjs is a large, browser-only module (it constructs a Worker on init, which
// SSR/prerender lacks). Load it lazily on first layout so it code-splits out of
// the route's initial bundle and never runs during server rendering.
let elkPromise: Promise<ElkInstance> | undefined;
function getElk(): Promise<ElkInstance> {
  elkPromise ??= import("elkjs/lib/elk.bundled.js").then((m) => new m.default());
  return elkPromise;
}

const LAYOUT_OPTIONS = {
  "elk.algorithm": "layered",
  "elk.direction": "DOWN",
  "elk.spacing.nodeNode": "36",
  "elk.layered.spacing.nodeNodeBetweenLayers": "64",
  "elk.layered.considerModelOrder.strategy": "NODES_AND_EDGES",
};

export type Positions = Map<string, { x: number; y: number }>;

export async function layout(sub: Subgraph): Promise<Positions> {
  const positions: Positions = new Map();
  if (sub.nodes.length === 0) return positions;

  const elk = await getElk();
  const graph = await elk.layout({
    id: "root",
    layoutOptions: LAYOUT_OPTIONS,
    children: sub.nodes.map((n) => ({ id: n.id, width: NODE_WIDTH, height: NODE_HEIGHT })),
    edges: sub.edges.map((e) => ({ id: e.id, sources: [e.source], targets: [e.target] })),
  });

  for (const child of graph.children ?? []) {
    positions.set(child.id, { x: child.x ?? 0, y: child.y ?? 0 });
  }
  return positions;
}
