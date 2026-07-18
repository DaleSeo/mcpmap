// Directional breaking-change classifier. Judges each method diff twice — once
// for client implementers, once for server implementers — from mechanical rules
// over field optionality, message direction, and position (request vs result).
//
// The core idea is writer/reader roles. A request's params are written by the
// sender and read by the receiver; a result is written by the receiver and read
// back by the sender. Message direction says which of those is the client and
// which is the server, so the same structural change lands as breaking for one
// implementer and additive for the other.

import type { MethodEntry } from "../pipeline/ir/inventory.ts";
import type { CapabilityDiff, FieldChange, MethodDiff } from "./diff.ts";

export type Severity = "breaking" | "additive" | "none";
export type Role = "client" | "server";

export interface Verdict {
  client: Severity;
  server: Severity;
}

const RANK: Record<Severity, number> = { none: 0, additive: 1, breaking: 2 };

function worse(a: Severity, b: Severity): Severity {
  return RANK[a] >= RANK[b] ? a : b;
}

/** Severity for the party who produces a value vs the party who consumes it. */
interface SidedSeverity {
  writer: Severity;
  reader: Severity;
}

/** Which implementer writes vs reads a position, given the request direction. */
function rolesFor(
  position: "params" | "result",
  direction: MethodEntry["direction"],
): { writer: Role | "both"; reader: Role | "both" } {
  if (direction === "both") return { writer: "both", reader: "both" };
  // The request sender writes params and reads the result; the receiver is the mirror.
  const sender: Role = direction === "clientToServer" ? "client" : "server";
  const receiver: Role = sender === "client" ? "server" : "client";
  return position === "params"
    ? { writer: sender, reader: receiver }
    : { writer: receiver, reader: sender };
}

/** How a single field change affects the value's writer and reader. */
function fieldSeverity(change: FieldChange): SidedSeverity {
  switch (change.status) {
    case "added":
      // A new required field forces writers to start producing it; readers only gain data.
      return change.requiredAfter
        ? { writer: "breaking", reader: "additive" }
        : { writer: "additive", reader: "additive" };
    case "removed":
      // A field disappears: readers that consumed it break; writers just stop sending.
      return { writer: "additive", reader: "breaking" };
    case "changed": {
      const before = change.requiredBefore;
      const after = change.requiredAfter;
      if (before === false && after === true) return { writer: "breaking", reader: "additive" };
      if (before === true && after === false) return { writer: "additive", reader: "breaking" };
      // Type change with no optionality flip: incompatible for both ends.
      return { writer: "breaking", reader: "breaking" };
    }
  }
}

function assign(verdict: Record<Role, Severity>, role: Role | "both", severity: Severity) {
  if (role === "both") {
    verdict.client = worse(verdict.client, severity);
    verdict.server = worse(verdict.server, severity);
  } else {
    verdict[role] = worse(verdict[role], severity);
  }
}

export function classifyMethod(diff: MethodDiff): Verdict {
  // A whole method appearing or disappearing is judged for both roles at once.
  if (diff.status === "added") return { client: "additive", server: "additive" };
  if (diff.status === "removed") return { client: "breaking", server: "breaking" };
  if (diff.status === "unchanged") return { client: "none", server: "none" };

  const direction = diff.directionAfter ?? diff.directionBefore ?? "both";
  const verdict: Record<Role, Severity> = { client: "none", server: "none" };

  for (const position of ["params", "result"] as const) {
    const roles = rolesFor(position, direction);
    for (const change of diff[position].fields) {
      const sev = fieldSeverity(change);
      assign(verdict, roles.writer, sev.writer);
      assign(verdict, roles.reader, sev.reader);
    }
  }
  return verdict;
}

/**
 * Capability changes are one-sided: a capability is declared by one role, so a
 * removal breaks that role's negotiated feature set and an addition is additive.
 */
export function classifyCapability(diff: CapabilityDiff): Verdict {
  const none: Verdict = { client: "none", server: "none" };
  if (diff.status === "unchanged") return none;
  const severity: Severity = diff.status === "removed" ? "breaking" : "additive";
  return { ...none, [diff.side]: severity };
}
