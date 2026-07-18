// Method lookup and direction presentation for the type explorer. A type can
// take part in a JSON-RPC method as its request/notification type, its params,
// or its result; this maps any of those back to the method so the detail panel
// can show the method name, its direction, and the request/result pairing.

import type { MethodEntry } from "../pipeline/ir/inventory.ts";

export type MethodRole = "request" | "params" | "result";

export interface MethodMatch {
  method: MethodEntry;
  /** How the looked-up type participates in the method. */
  role: MethodRole;
}

/**
 * Find the method a type participates in, and how. A single type maps to at most
 * one method here (params/result names are method-specific), so the first match
 * wins in request → result → params order.
 */
export function methodForType(
  methods: readonly MethodEntry[],
  typeName: string,
): MethodMatch | undefined {
  for (const method of methods) {
    if (method.typeName === typeName) return { method, role: "request" };
    if (method.resultType === typeName) return { method, role: "result" };
    if (method.paramsType === typeName) return { method, role: "params" };
  }
  return undefined;
}

export interface DirectionBadge {
  label: string;
  color: string;
}

/** Human-readable direction with a stable color for the badge. */
export function directionBadge(direction: MethodEntry["direction"]): DirectionBadge {
  switch (direction) {
    case "clientToServer":
      return { label: "client → server", color: "#0ea5e9" };
    case "serverToClient":
      return { label: "server → client", color: "#f59e0b" };
    case "both":
      return { label: "client ↔ server", color: "#a855f7" };
  }
}
