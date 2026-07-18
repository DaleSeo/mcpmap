// Wire-level inventory extracted from the IR: the methods a version defines
// (with direction and request/result pairing) and the capabilities that gate them.

import type { Ir, TypeNode, TypeRef } from "./types.ts";

/** A message may be sent by one side, or by either ("both", e.g. ping, cancelled). */
export type Direction = "clientToServer" | "serverToClient" | "both";
export type MessageType = "request" | "notification";
export type Side = "client" | "server";

/** The one-way directions a union can imply (never "both"). */
type OneWay = "clientToServer" | "serverToClient";

export interface MethodEntry {
  /** JSON-RPC method name, e.g. "tools/call". */
  method: string;
  /** The request/notification type defining it, e.g. "CallToolRequest". */
  typeName: string;
  messageType: MessageType;
  direction: Direction;
  /** Named params type when params is a `$ref` (post-SEP-1319); absent when inline. */
  paramsType?: string;
  /** Paired result type for requests (by `<X>Result` convention; empty → EmptyResult). */
  resultType?: string;
  /** Set when direction couldn't be resolved from unions or naming — surfaces drift. */
  directionUnknown?: true;
}

export interface CapabilityEntry {
  name: string;
  side: Side;
  description?: string;
}

export interface Inventory {
  methods: MethodEntry[];
  capabilities: CapabilityEntry[];
}

// Direction is derived from the top-level "role" unions rather than a hardcoded
// list, because the grouping shifts across versions: the dated versions use
// Client/Server{Request,Notification}, while the 2026-07-28 draft dropped
// ServerRequest and regrouped server-initiated requests under `InputRequest`.
const UNION_ALIASES: Record<string, OneWay> = {
  InputRequest: "serverToClient", // draft: server solicits input from the client
};

/** Direction implied by a union type's name, if any. */
function unionDirection(unionName: string): OneWay | undefined {
  if (/^Client(Request|Notification)$/.test(unionName)) return "clientToServer";
  if (/^Server(Request|Notification)$/.test(unionName)) return "serverToClient";
  return UNION_ALIASES[unionName];
}

/** Direction implied by a type's own name prefix (fallback for lone types). */
function prefixDirection(typeName: string): OneWay | undefined {
  if (typeName.startsWith("Client")) return "clientToServer";
  if (typeName.startsWith("Server")) return "serverToClient";
  return undefined;
}

function messageTypeOf(typeName: string, method: string): MessageType {
  return typeName.endsWith("Notification") || method.startsWith("notifications/")
    ? "notification"
    : "request";
}

// Container/union types, not concrete messages. In the draft these can collapse
// to a single object with a `method` const (e.g. ClientNotification ≡ cancelled),
// which would otherwise double-count against the concrete type (CancelledNotification).
const ROLE_CONTAINERS: ReadonlySet<string> = new Set([
  "ClientRequest",
  "ServerRequest",
  "ClientNotification",
  "ServerNotification",
  "InputRequest",
  "InputResponse",
]);

function memberNames(node: TypeRef | undefined): string[] {
  if (!node || node.kind !== "union") return [];
  return node.of.flatMap((m) => (m.kind === "ref" ? [m.name] : []));
}

/** The literal string of a `const` field, if present. */
function constString(shape: TypeRef, field: string): string | undefined {
  if (shape.kind !== "object") return undefined;
  const f = shape.fields.find((x) => x.name === field);
  if (f?.type.kind === "const" && typeof f.type.value === "string") {
    return f.type.value;
  }
  return undefined;
}

/** The referenced type name of an object field, if the field is a `$ref`. */
function fieldRef(shape: TypeRef, field: string): string | undefined {
  if (shape.kind !== "object") return undefined;
  const f = shape.fields.find((x) => x.name === field);
  return f?.type.kind === "ref" ? f.type.name : undefined;
}

/** Resolve a type's direction, accounting for messages that belong to both a
 * client and a server union (bidirectional, e.g. ping / cancelled / progress). */
function resolveDirection(
  typeName: string,
  memberships: Map<string, Set<OneWay>>,
): { direction: Direction; unknown: boolean } {
  const seen = memberships.get(typeName);
  if (seen && seen.size === 2) return { direction: "both", unknown: false };
  if (seen && seen.size === 1) {
    return { direction: [...seen][0] as OneWay, unknown: false };
  }
  const prefix = prefixDirection(typeName);
  if (prefix) return { direction: prefix, unknown: false };
  return { direction: "clientToServer", unknown: true };
}

function extractMethods(ir: Ir, byName: Map<string, TypeNode>): MethodEntry[] {
  // Accumulate every directional union a type belongs to; belonging to both a
  // client and a server union means the message is bidirectional.
  const memberships = new Map<string, Set<OneWay>>();
  for (const type of ir.types) {
    const direction = unionDirection(type.name);
    if (!direction) continue;
    for (const member of memberNames(type.shape)) {
      const set = memberships.get(member) ?? new Set<OneWay>();
      set.add(direction);
      memberships.set(member, set);
    }
  }

  const hasEmptyResult = byName.has("EmptyResult");
  const methods: MethodEntry[] = [];

  for (const type of ir.types) {
    if (ROLE_CONTAINERS.has(type.name)) continue;
    const method = constString(type.shape, "method");
    if (!method) continue; // no method const → the generic JSONRPCRequest base, etc.

    const messageType = messageTypeOf(type.name, method);
    const { direction, unknown } = resolveDirection(type.name, memberships);

    const paramsType = fieldRef(type.shape, "params");
    let resultType: string | undefined;
    if (messageType === "request") {
      const paired = type.name.replace(/Request$/, "Result");
      resultType = byName.has(paired) ? paired : hasEmptyResult ? "EmptyResult" : undefined;
    }

    methods.push({
      method,
      typeName: type.name,
      messageType,
      direction,
      ...(unknown ? { directionUnknown: true } : {}),
      ...(paramsType ? { paramsType } : {}),
      ...(resultType ? { resultType } : {}),
    });
  }

  return methods.toSorted((a, b) => a.method.localeCompare(b.method));
}

function extractCapabilities(byName: Map<string, TypeNode>): CapabilityEntry[] {
  const out: CapabilityEntry[] = [];
  const sides: Array<[string, Side]> = [
    ["ClientCapabilities", "client"],
    ["ServerCapabilities", "server"],
  ];
  for (const [typeName, side] of sides) {
    const shape = byName.get(typeName)?.shape;
    if (shape?.kind !== "object") continue;
    for (const field of shape.fields) {
      out.push({
        name: field.name,
        side,
        ...(field.description ? { description: field.description } : {}),
      });
    }
  }
  return out;
}

export function buildInventory(ir: Ir): Inventory {
  const byName = new Map(ir.types.map((t) => [t.name, t]));
  return {
    methods: extractMethods(ir, byName),
    capabilities: extractCapabilities(byName),
  };
}
