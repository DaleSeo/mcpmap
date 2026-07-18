// Feature-area clustering: groups types, methods, and capabilities into the
// conceptual areas of the protocol (tools, resources, sampling, …) inferred from
// method-name prefixes. The type explorer renders these as graph clusters so the
// default view is per-area rather than a full-schema hairball.

import type { Ir } from "./types.ts";
import type { Inventory } from "./inventory.ts";

export interface Cluster {
  area: string;
  label: string;
  types: string[];
  methods: string[];
  capabilities: string[];
}

export interface Clustering {
  /** type name → area id */
  areaOf: Record<string, string>;
  clusters: Cluster[];
}

/** Canonical areas, in the order the UI should present them. */
const AREAS: Array<{ area: string; label: string }> = [
  { area: "lifecycle", label: "Lifecycle" },
  { area: "tools", label: "Tools" },
  { area: "resources", label: "Resources" },
  { area: "prompts", label: "Prompts" },
  { area: "sampling", label: "Sampling" },
  { area: "elicitation", label: "Elicitation" },
  { area: "roots", label: "Roots" },
  { area: "logging", label: "Logging" },
  { area: "completion", label: "Completion" },
  { area: "tasks", label: "Tasks" },
  { area: "progress", label: "Progress" },
  { area: "common", label: "Common" },
];

const LABELS = new Map(AREAS.map((a) => [a.area, a.label]));

/** Capability field name → area (handles the completion(s) singular/plural gap). */
const CAPABILITY_AREA: Record<string, string> = {
  tools: "tools",
  resources: "resources",
  prompts: "prompts",
  sampling: "sampling",
  elicitation: "elicitation",
  roots: "roots",
  logging: "logging",
  completions: "completion",
  tasks: "tasks",
  experimental: "common",
};

/** Map a JSON-RPC method name to its feature area. */
export function methodArea(method: string): string {
  const [head, second] = method.split("/");
  if (head === "notifications") {
    switch (second) {
      case "message":
        return "logging";
      case "progress":
        return "progress";
      case "cancelled":
      case "initialized":
        return "lifecycle";
      case "resources":
        return "resources";
      case "tools":
        return "tools";
      case "prompts":
        return "prompts";
      case "roots":
        return "roots";
      case "tasks":
        return "tasks";
      default:
        return "lifecycle";
    }
  }
  switch (head) {
    case "initialize":
    case "ping":
      return "lifecycle";
    case "tools":
      return "tools";
    case "resources":
      return "resources";
    case "prompts":
      return "prompts";
    case "sampling":
      return "sampling";
    case "elicitation":
      return "elicitation";
    case "roots":
      return "roots";
    case "logging":
      return "logging";
    case "completion":
      return "completion";
    case "tasks":
      return "tasks";
    default:
      return "common";
  }
}

export function buildClustering(ir: Ir, inventory: Inventory): Clustering {
  const areaOf: Record<string, string> = {};

  // Message types (and their params/results) take their method's area.
  const methodsByArea = new Map<string, string[]>();
  for (const m of inventory.methods) {
    const area = methodArea(m.method);
    methodsByArea.set(area, [...(methodsByArea.get(area) ?? []), m.method]);
    areaOf[m.typeName] = area;
    if (m.paramsType) areaOf[m.paramsType] = area;
    if (m.resultType) areaOf[m.resultType] = area;
  }

  // Capabilities land in the area they gate.
  const capsByArea = new Map<string, string[]>();
  for (const c of inventory.capabilities) {
    const area = CAPABILITY_AREA[c.name] ?? "common";
    capsByArea.set(area, [...(capsByArea.get(area) ?? []), c.name]);
  }

  // Everything else — shared building blocks (Content, Role, JSONRPC*, …) — is common.
  for (const t of ir.types) {
    if (!(t.name in areaOf)) areaOf[t.name] = "common";
  }

  const typesByArea = new Map<string, string[]>();
  for (const [name, area] of Object.entries(areaOf)) {
    typesByArea.set(area, [...(typesByArea.get(area) ?? []), name]);
  }

  const clusters: Cluster[] = AREAS.map(({ area, label }) => ({
    area,
    label,
    types: (typesByArea.get(area) ?? []).toSorted(),
    methods: (methodsByArea.get(area) ?? []).toSorted(),
    capabilities: [...new Set(capsByArea.get(area) ?? [])].toSorted(),
  })).filter((c) => c.types.length > 0 || c.methods.length > 0 || c.capabilities.length > 0);

  return { areaOf, clusters };
}

export function areaLabel(area: string): string {
  return LABELS.get(area) ?? area;
}
