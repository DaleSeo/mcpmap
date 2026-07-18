// Graph selection for the type explorer. Turns a version artifact's flat
// types + refs into the two bounded views the explorer ever renders — a
// feature-area subgraph (the default) and a type's local neighborhood (the
// click-to-refocus view) — so the full-schema hairball is never built.
//
// Pure and version-independent: given an artifact it returns plain node/edge
// lists. Layout (elkjs) and rendering (React Flow) live elsewhere.

import type { VersionArtifact } from "../pipeline/artifact.ts";
import type { TypeKind } from "../pipeline/ir/types.ts";

export interface GraphNode {
  /** Type name — unique within a version, used as the node id. */
  id: string;
  kind: TypeKind;
  area: string;
  description?: string;
}

export interface GraphEdge {
  /** `${source}->${target}`, so edge sets dedupe and merge cleanly. */
  id: string;
  source: string;
  target: string;
}

export interface Subgraph {
  nodes: GraphNode[];
  edges: GraphEdge[];
}

function edgeId(from: string, to: string): string {
  return `${from}->${to}`;
}

/** Build the node record for a type, resolving its kind, area, and description. */
function nodeIndex(artifact: VersionArtifact): Map<string, GraphNode> {
  const index = new Map<string, GraphNode>();
  for (const t of artifact.types) {
    index.set(t.name, {
      id: t.name,
      kind: t.kind,
      area: artifact.areaOf[t.name] ?? "common",
      description: t.description,
    });
  }
  return index;
}

/** Edges whose endpoints are both in `names`, deduped and self-loops dropped. */
function inducedEdges(artifact: VersionArtifact, names: ReadonlySet<string>): GraphEdge[] {
  const edges = new Map<string, GraphEdge>();
  for (const { from, to } of artifact.refs) {
    if (from === to || !names.has(from) || !names.has(to)) continue;
    const id = edgeId(from, to);
    if (!edges.has(id)) edges.set(id, { id, source: from, target: to });
  }
  return [...edges.values()];
}

/**
 * The subgraph induced by one feature area: every type the clustering assigned
 * to `area`, plus the reference edges that stay inside it. Cross-area edges are
 * intentionally dropped — the area view stays legible, and following a reference
 * out of the area is what {@link neighborhood} is for.
 */
export function areaSubgraph(artifact: VersionArtifact, area: string): Subgraph {
  const index = nodeIndex(artifact);
  const nodes = [...index.values()].filter((n) => n.area === area);
  const names = new Set(nodes.map((n) => n.id));
  return { nodes, edges: inducedEdges(artifact, names) };
}

/**
 * A type referenced by more than this many others is a hub — shared scalars
 * (`RequestId`, `ProgressToken`) and role unions (`ClientRequest`, …) that nearly
 * everything touches. Traversing *through* one pulls in the whole schema, so the
 * neighborhood includes hubs as boundary nodes but never expands past them.
 */
export const HUB_DEGREE = 12;

/**
 * The local neighborhood of one type: `root` plus every type within `hops`
 * reference steps (following edges in either direction), and the edges among
 * them. This is the click-to-refocus view — it deliberately crosses area
 * boundaries, because references do. `hops` is clamped to 1–2, and traversal
 * stops at hub types (see {@link HUB_DEGREE}) so a single high-degree connector
 * can't turn the local view back into the full-schema hairball.
 */
export function neighborhood(artifact: VersionArtifact, root: string, hops: number): Subgraph {
  const index = nodeIndex(artifact);
  if (!index.has(root)) return { nodes: [], edges: [] };

  // Undirected adjacency: refocus should surface both what `root` uses and what
  // uses `root`.
  const adjacency = new Map<string, Set<string>>();
  const link = (a: string, b: string) => {
    (adjacency.get(a) ?? adjacency.set(a, new Set()).get(a)!).add(b);
  };
  for (const { from, to } of artifact.refs) {
    if (from === to) continue;
    link(from, to);
    link(to, from);
  }

  const isHub = (name: string) => (adjacency.get(name)?.size ?? 0) > HUB_DEGREE;

  const depth = Math.max(1, Math.min(2, Math.trunc(hops)));
  const reached = new Set([root]);
  let frontier = [root];
  for (let step = 0; step < depth; step++) {
    const next: string[] = [];
    for (const name of frontier) {
      // Reach a hub, but don't fan out from it — except the root itself, whose
      // neighbors are the whole point even when the root is a hub.
      if (name !== root && isHub(name)) continue;
      for (const neighbor of adjacency.get(name) ?? []) {
        if (!index.has(neighbor) || reached.has(neighbor)) continue;
        reached.add(neighbor);
        next.push(neighbor);
      }
    }
    frontier = next;
  }

  const nodes = [...reached].map((name) => index.get(name)!);
  return { nodes, edges: inducedEdges(artifact, reached) };
}
