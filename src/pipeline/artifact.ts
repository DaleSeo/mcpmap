// The per-version artifact the pipeline emits into src/data and the site imports.
// One flat object per protocol version, combining the IR with the derived
// inventory and clustering — everything a view needs, already denormalized.

import type { Dialect, RefEdge, TypeNode } from "./ir/types.ts";
import type { CapabilityEntry, MethodEntry } from "./ir/inventory.ts";
import type { Cluster } from "./ir/clusters.ts";

export interface VersionArtifact {
  version: string;
  dialect: Dialect;
  types: TypeNode[];
  refs: RefEdge[];
  methods: MethodEntry[];
  capabilities: CapabilityEntry[];
  clusters: Cluster[];
  /** type name → area id */
  areaOf: Record<string, string>;
}

export interface DataIndex {
  /** Version ids, newest first. `draft` sorts to the front. */
  versions: string[];
  /** Upstream commit the artifacts were generated from. */
  commit: string;
  generatedAt: string;
}
