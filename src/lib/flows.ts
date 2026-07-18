// Canonical message-flow definitions and their validation. Each flow is a small
// data structure whose steps reference JSON-RPC methods by name; those names are
// checked against the IR so a typo like the infamous `tool/call` fails the build
// rather than shipping. Flow presence per version is derived from the IR — a flow
// is present only where all its required methods exist — so the initialize
// handshake correctly disappears in the stateless-core draft without any
// hand-maintained version list.

import type { VersionArtifact } from "../pipeline/artifact.ts";
import type { TypeNode, TypeRef } from "../pipeline/ir/types.ts";
import { effectiveParams, effectiveResult, resolver } from "./wire.ts";

export type MessageKind = "request" | "result" | "notification";

export interface FlowStep {
  /** JSON-RPC method, validated against the IR. */
  method: string;
  /** Which payload the arrow carries: request/notification params, or a result. */
  message: MessageKind;
  from: string;
  to: string;
  label: string;
  /** Steps that only occur conditionally (progress, cancellation) — absence is fine. */
  optional?: boolean;
}

export interface FlowActor {
  id: string;
  label: string;
}

export interface Flow {
  id: string;
  title: string;
  summary: string;
  actors: FlowActor[];
  steps: FlowStep[];
  /**
   * Versions where the flow's feature is deprecated. Curated: the schema carries
   * no machine-readable `deprecated` flag, so this is the only source. Presence
   * (above) stays fully derived from the IR.
   */
  deprecatedIn?: string[];
}

const client: FlowActor = { id: "client", label: "Client" };
const server: FlowActor = { id: "server", label: "Server" };

export const FLOWS: Flow[] = [
  {
    id: "initialize",
    title: "Initialization handshake",
    summary:
      "Version and capability negotiation before any other exchange. Removed in the stateless-core draft.",
    actors: [client, server],
    steps: [
      {
        method: "initialize",
        message: "request",
        from: "client",
        to: "server",
        label: "initialize",
      },
      { method: "initialize", message: "result", from: "server", to: "client", label: "result" },
      {
        method: "notifications/initialized",
        message: "notification",
        from: "client",
        to: "server",
        label: "initialized",
      },
    ],
  },
  {
    id: "tool-call",
    title: "Tool call with progress & cancellation",
    summary: "A client invokes a tool; the server may stream progress, and either side may cancel.",
    actors: [client, server],
    steps: [
      {
        method: "tools/call",
        message: "request",
        from: "client",
        to: "server",
        label: "tools/call",
      },
      {
        method: "notifications/progress",
        message: "notification",
        from: "server",
        to: "client",
        label: "progress",
        optional: true,
      },
      {
        method: "notifications/cancelled",
        message: "notification",
        from: "client",
        to: "server",
        label: "cancelled",
        optional: true,
      },
      { method: "tools/call", message: "result", from: "server", to: "client", label: "result" },
    ],
  },
  {
    id: "resources",
    title: "Resource read & subscribe",
    summary: "Read a resource, subscribe to it, and receive update notifications.",
    actors: [client, server],
    steps: [
      {
        method: "resources/read",
        message: "request",
        from: "client",
        to: "server",
        label: "resources/read",
      },
      {
        method: "resources/read",
        message: "result",
        from: "server",
        to: "client",
        label: "result",
      },
      {
        method: "resources/subscribe",
        message: "request",
        from: "client",
        to: "server",
        label: "resources/subscribe",
      },
      {
        method: "resources/subscribe",
        message: "result",
        from: "server",
        to: "client",
        label: "result",
      },
      {
        method: "notifications/resources/updated",
        message: "notification",
        from: "server",
        to: "client",
        label: "updated",
        optional: true,
      },
    ],
  },
  {
    id: "sampling",
    title: "Sampling round-trip",
    summary: "The server asks the client's LLM to generate a completion.",
    actors: [client, server],
    deprecatedIn: ["draft"],
    steps: [
      {
        method: "sampling/createMessage",
        message: "request",
        from: "server",
        to: "client",
        label: "sampling/createMessage",
      },
      {
        method: "sampling/createMessage",
        message: "result",
        from: "client",
        to: "server",
        label: "result",
      },
    ],
  },
  {
    id: "elicitation",
    title: "Elicitation",
    summary: "The server requests structured input from the user via the client.",
    actors: [client, server],
    steps: [
      {
        method: "elicitation/create",
        message: "request",
        from: "server",
        to: "client",
        label: "elicitation/create",
      },
      {
        method: "elicitation/create",
        message: "result",
        from: "client",
        to: "server",
        label: "result",
      },
    ],
  },
  {
    id: "roots",
    title: "Roots listing",
    summary: "The server lists the client's filesystem roots and is notified when they change.",
    actors: [client, server],
    deprecatedIn: ["draft"],
    steps: [
      {
        method: "roots/list",
        message: "request",
        from: "server",
        to: "client",
        label: "roots/list",
      },
      { method: "roots/list", message: "result", from: "client", to: "server", label: "result" },
      {
        method: "notifications/roots/list_changed",
        message: "notification",
        from: "client",
        to: "server",
        label: "list_changed",
        optional: true,
      },
    ],
  },
];

export interface FlowValidationError {
  flow: string;
  method: string;
}

/**
 * Every method a flow references must exist in at least one version's IR.
 * A method present in none is a typo or drift and fails the build.
 */
export function validateFlows(
  flows: readonly Flow[],
  artifacts: readonly VersionArtifact[],
): FlowValidationError[] {
  const known = new Set(artifacts.flatMap((a) => a.methods.map((m) => m.method)));
  const errors: FlowValidationError[] = [];
  for (const flow of flows) {
    for (const step of flow.steps) {
      if (!known.has(step.method)) errors.push({ flow: flow.id, method: step.method });
    }
  }
  return errors;
}

export type FlowPresence = "present" | "absent";

/** Present only where every required (non-optional) step's method exists. */
export function flowPresence(flow: Flow, artifact: VersionArtifact): FlowPresence {
  const methods = new Set(artifact.methods.map((m) => m.method));
  const required = flow.steps.filter((s) => !s.optional);
  return required.every((s) => methods.has(s.method)) ? "present" : "absent";
}

/** The steps to draw for a version: those whose method exists (optional ones drop out when absent). */
export function presentSteps(flow: Flow, artifact: VersionArtifact): FlowStep[] {
  const methods = new Set(artifact.methods.map((m) => m.method));
  return flow.steps.filter((s) => methods.has(s.method));
}

export function isDeprecated(flow: Flow, version: string): boolean {
  return flow.deprecatedIn?.includes(version) ?? false;
}

/** The effective wire shape a step's arrow carries, for the payload panel. */
export function stepShape(step: FlowStep, artifact: VersionArtifact): TypeRef | undefined {
  const method = artifact.methods.find((m) => m.method === step.method);
  if (!method) return undefined;
  const resolve = resolver(artifact);
  return step.message === "result"
    ? effectiveResult(method, resolve)
    : effectiveParams(method, resolve);
}

/** Type lookup for example generation in the payload panel. */
export function typeLookup(artifact: VersionArtifact): (name: string) => TypeNode | undefined {
  return resolver(artifact);
}
