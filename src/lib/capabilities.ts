// Capability matrix derivation. Each capability gates a feature area; the
// clustering already groups capabilities and methods into those areas, so a
// capability's enabled methods are the methods of the area it belongs to.
// Pure and version-independent — the route renders whatever this returns.

import type { VersionArtifact } from "../pipeline/artifact.ts";
import type { MethodEntry, Side } from "../pipeline/ir/inventory.ts";

export interface CapabilityRow {
  name: string;
  side: Side;
  description?: string;
  area: string;
  /** Methods this capability enables — the methods of its feature area. */
  methods: MethodEntry[];
}

/**
 * One row per declared capability, carrying the methods its feature area
 * enables. Capabilities are the source of truth for name/side/description;
 * the area and its methods come from the clustering.
 */
export function capabilityMatrix(artifact: VersionArtifact): CapabilityRow[] {
  const methodByName = new Map(artifact.methods.map((m) => [m.method, m]));

  const clusterOf = new Map<string, { area: string; methods: string[] }>();
  for (const cluster of artifact.clusters) {
    for (const capName of cluster.capabilities) {
      clusterOf.set(capName, { area: cluster.area, methods: cluster.methods });
    }
  }

  return artifact.capabilities.map((cap) => {
    const cluster = clusterOf.get(cap.name);
    const methods = (cluster?.methods ?? [])
      .map((name) => methodByName.get(name))
      .filter((m): m is MethodEntry => m !== undefined);
    return {
      name: cap.name,
      side: cap.side,
      description: cap.description,
      area: cluster?.area ?? "common",
      methods,
    };
  });
}

/** Split the matrix into client- and server-declared capabilities. */
export function bySide(rows: CapabilityRow[]): {
  client: CapabilityRow[];
  server: CapabilityRow[];
} {
  return {
    client: rows.filter((r) => r.side === "client"),
    server: rows.filter((r) => r.side === "server"),
  };
}
