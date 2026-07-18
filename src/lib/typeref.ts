// Rendering helpers for the type detail panel. Turns a recursive `TypeRef`
// into a human-readable type label and a minimal JSON example. Pure and
// version-independent — the panel resolves named refs through a lookup so
// examples can expand one level into referenced types.

import type { TypeNode, TypeRef } from "../pipeline/ir/types.ts";

/** A short, readable type label, e.g. `string`, `Content[]`, `A | B`. */
export function formatType(t: TypeRef): string {
  switch (t.kind) {
    case "ref":
      return t.name;
    case "scalar":
      return t.scalar;
    case "const":
      return JSON.stringify(t.value);
    case "enum":
      return t.values.map((v) => JSON.stringify(v)).join(" | ");
    case "array":
      return `${wrap(t.items)}[]`;
    case "object":
      return "object";
    case "union":
      return t.of.map(formatType).join(" | ");
    case "allOf":
      return t.of.map(formatType).join(" & ");
    case "any":
      return "any";
  }
}

/** Parenthesize composite items so `(A | B)[]` doesn't read as `A | B[]`. */
function wrap(t: TypeRef): string {
  return t.kind === "union" || t.kind === "allOf" ? `(${formatType(t)})` : formatType(t);
}

function scalarExample(scalar: string): unknown {
  switch (scalar) {
    case "string":
      return "…";
    case "number":
    case "integer":
      return 0;
    case "boolean":
      return true;
    default:
      return null;
  }
}

const MAX_DEPTH = 5;

/**
 * A minimal JSON example for a type. Named refs are resolved through `lookup`
 * (one instance per name on the current path, so cycles terminate); the top
 * level includes every field, deeper levels only required ones, to stay concise.
 */
export function exampleFor(
  t: TypeRef,
  lookup: (name: string) => TypeNode | undefined,
  depth = 0,
  seen: ReadonlySet<string> = new Set(),
): unknown {
  if (depth > MAX_DEPTH) return null;
  switch (t.kind) {
    case "scalar":
      return scalarExample(t.scalar);
    case "const":
      return t.value;
    case "enum":
      return t.values[0] ?? null;
    case "array":
      return [exampleFor(t.items, lookup, depth + 1, seen)];
    case "object": {
      const out: Record<string, unknown> = {};
      for (const f of t.fields) {
        if (f.required || depth === 0) out[f.name] = exampleFor(f.type, lookup, depth + 1, seen);
      }
      return out;
    }
    case "union":
      return t.of[0] ? exampleFor(t.of[0], lookup, depth + 1, seen) : null;
    case "allOf":
      return Object.assign({}, ...t.of.map((x) => exampleFor(x, lookup, depth + 1, seen)));
    case "ref": {
      if (seen.has(t.name)) return t.name; // cycle — stop with the type name
      const target = lookup(t.name);
      if (!target) return t.name;
      return exampleFor(target.shape, lookup, depth + 1, new Set(seen).add(t.name));
    }
    case "any":
      return {};
  }
}

/** The fields to list for a type, or `undefined` when it isn't an object. */
export function objectFields(t: TypeRef) {
  if (t.kind === "object") return t.fields;
  if (t.kind === "allOf") {
    const merged = t.of.flatMap((x) => (x.kind === "object" ? x.fields : []));
    return merged.length > 0 ? merged : undefined;
  }
  return undefined;
}

/** Link to the type in the official spec's schema reference for its version. */
export function schemaReferenceUrl(version: string, typeName: string): string {
  return `https://modelcontextprotocol.io/specification/${version}/schema#${typeName.toLowerCase()}`;
}
