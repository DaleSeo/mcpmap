// Wire-identity version differ. Compares two version artifacts by protocol role
// — JSON-RPC method names and capability paths — not by definition names, so the
// SEP-1319 reorganization (inline params promoted to named `…Params` types) and
// the SEP-1613 dialect change (draft-07 → 2020-12, already normalized in the IR)
// don't show up as spurious added/removed churn.
//
// The unit of identity is the method's effective wire shape: the `params` field
// of a request type is resolved to its real object shape whether it's inline
// (older versions) or a `$ref` to a named type (newer ones), then compared
// field by field. Named-type renames that leave the wire shape unchanged are
// collected in a separate reorganization bucket. Pure and version-independent.

import type { VersionArtifact } from "../pipeline/artifact.ts";
import type { MethodEntry } from "../pipeline/ir/inventory.ts";
import type { TypeRef } from "../pipeline/ir/types.ts";
import { formatType, objectFields } from "./typeref.ts";
import { effectiveParams, effectiveResult, resolver, type Resolve } from "./wire.ts";

export type ChangeKind = "added" | "removed" | "changed" | "unchanged";

export interface FieldChange {
  name: string;
  status: "added" | "removed" | "changed";
  requiredBefore?: boolean;
  requiredAfter?: boolean;
  typeBefore?: string;
  typeAfter?: string;
}

export interface ShapeDiff {
  status: ChangeKind;
  fields: FieldChange[];
}

export interface MethodDiff {
  method: string;
  status: ChangeKind;
  messageType: MethodEntry["messageType"];
  /** Direction on each side — feeds the directional breaking-change classifier. */
  directionBefore?: MethodEntry["direction"];
  directionAfter?: MethodEntry["direction"];
  params: ShapeDiff;
  result: ShapeDiff;
}

export interface CapabilityDiff {
  name: string;
  side: "client" | "server";
  status: "added" | "removed" | "unchanged";
}

export interface Reorganization {
  /** A named type that vanished, and the differently-named type that replaced it. */
  before: string;
  after: string;
}

export interface VersionDiff {
  before: string;
  after: string;
  methods: MethodDiff[];
  capabilities: CapabilityDiff[];
  reorganizations: Reorganization[];
}

const MAX_DEPTH = 6;

/**
 * A canonical, name-independent signature of a type's resolved structure. Two
 * types with the same signature are the same on the wire even if their
 * definitions were renamed; a real structural change yields a different one.
 */
function signature(
  t: TypeRef | undefined,
  resolve: Resolve,
  depth = 0,
  seen: ReadonlySet<string> = new Set(),
): string {
  if (!t || depth > MAX_DEPTH) return "…";
  switch (t.kind) {
    case "scalar":
      return `scalar:${t.scalar}`;
    case "const":
      return `const:${JSON.stringify(t.value)}`;
    case "enum":
      return `enum:${[...t.values]
        .map((v) => JSON.stringify(v))
        .toSorted()
        .join("|")}`;
    case "array":
      return `array<${signature(t.items, resolve, depth + 1, seen)}>`;
    case "object": {
      const fields = t.fields
        .map(
          (f) => `${f.name}${f.required ? "" : "?"}:${signature(f.type, resolve, depth + 1, seen)}`,
        )
        .toSorted();
      const extra = t.additionalProperties ? "+" : "";
      return `{${fields.join(",")}${extra}}`;
    }
    case "union":
      return `union<${t.of
        .map((x) => signature(x, resolve, depth + 1, seen))
        .toSorted()
        .join("|")}>`;
    case "allOf":
      return `allOf<${t.of
        .map((x) => signature(x, resolve, depth + 1, seen))
        .toSorted()
        .join("&")}>`;
    case "ref":
      if (seen.has(t.name)) return "@rec";
      return signature(resolve(t.name)?.shape, resolve, depth + 1, new Set(seen).add(t.name));
    case "any":
      return "any";
  }
}

/** Diff two effective shapes field by field, comparing field types structurally. */
function diffShape(
  before: TypeRef | undefined,
  beforeResolve: Resolve,
  after: TypeRef | undefined,
  afterResolve: Resolve,
): ShapeDiff {
  if (!before && !after) return { status: "unchanged", fields: [] };
  if (!before) return { status: "added", fields: [] };
  if (!after) return { status: "removed", fields: [] };

  const bFields = objectFields(before) ?? [];
  const aFields = objectFields(after) ?? [];

  // Non-object shapes (unions, scalars): compare whole-signature only.
  if (bFields.length === 0 && aFields.length === 0) {
    const changed = signature(before, beforeResolve) !== signature(after, afterResolve);
    return { status: changed ? "changed" : "unchanged", fields: [] };
  }

  const bByName = new Map(bFields.map((f) => [f.name, f]));
  const aByName = new Map(aFields.map((f) => [f.name, f]));
  const names = [...new Set([...bByName.keys(), ...aByName.keys()])].toSorted();

  const fields: FieldChange[] = [];
  for (const name of names) {
    const b = bByName.get(name);
    const a = aByName.get(name);
    if (b && !a) {
      fields.push({ name, status: "removed", requiredBefore: b.required });
    } else if (!b && a) {
      fields.push({ name, status: "added", requiredAfter: a.required });
    } else if (b && a) {
      const typeChanged = signature(b.type, beforeResolve) !== signature(a.type, afterResolve);
      if (typeChanged || b.required !== a.required) {
        fields.push({
          name,
          status: "changed",
          requiredBefore: b.required,
          requiredAfter: a.required,
          typeBefore: formatType(b.type),
          typeAfter: formatType(a.type),
        });
      }
    }
  }
  return { status: fields.length > 0 ? "changed" : "unchanged", fields };
}

function diffMethods(before: VersionArtifact, after: VersionArtifact): MethodDiff[] {
  const bResolve = resolver(before);
  const aResolve = resolver(after);
  const bByName = new Map(before.methods.map((m) => [m.method, m]));
  const aByName = new Map(after.methods.map((m) => [m.method, m]));
  const names = [...new Set([...bByName.keys(), ...aByName.keys()])].toSorted();

  const empty: ShapeDiff = { status: "unchanged", fields: [] };
  return names.map((method): MethodDiff => {
    const b = bByName.get(method);
    const a = aByName.get(method);

    if (b && !a) {
      return {
        method,
        status: "removed",
        messageType: b.messageType,
        directionBefore: b.direction,
        params: empty,
        result: empty,
      };
    }
    if (!b && a) {
      return {
        method,
        status: "added",
        messageType: a.messageType,
        directionAfter: a.direction,
        params: empty,
        result: empty,
      };
    }
    // both present
    const params = diffShape(
      effectiveParams(b!, bResolve),
      bResolve,
      effectiveParams(a!, aResolve),
      aResolve,
    );
    const result = diffShape(
      effectiveResult(b!, bResolve),
      bResolve,
      effectiveResult(a!, aResolve),
      aResolve,
    );
    const status: ChangeKind =
      params.status !== "unchanged" || result.status !== "unchanged" ? "changed" : "unchanged";
    return {
      method,
      status,
      messageType: a!.messageType,
      directionBefore: b!.direction,
      directionAfter: a!.direction,
      params,
      result,
    };
  });
}

function diffCapabilities(before: VersionArtifact, after: VersionArtifact): CapabilityDiff[] {
  const key = (name: string, side: string) => `${side}:${name}`;
  const b = new Set(before.capabilities.map((c) => key(c.name, c.side)));
  const a = new Set(after.capabilities.map((c) => key(c.name, c.side)));
  const all = [
    ...new Set([...before.capabilities, ...after.capabilities].map((c) => key(c.name, c.side))),
  ].toSorted();

  return all.map((k): CapabilityDiff => {
    const [side, name] = k.split(":") as ["client" | "server", string];
    const status = b.has(k) && a.has(k) ? "unchanged" : b.has(k) ? "removed" : "added";
    return { name, side, status };
  });
}

/**
 * Types unique to one version by name but structurally identical to a type
 * unique to the other — i.e. a definition rename/move, not a wire change. These
 * are pulled out so they never read as added/removed churn in the diff.
 */
function diffReorganizations(before: VersionArtifact, after: VersionArtifact): Reorganization[] {
  const bResolve = resolver(before);
  const aResolve = resolver(after);
  const bNames = new Set(before.types.map((t) => t.name));
  const aNames = new Set(after.types.map((t) => t.name));

  const onlyBefore = before.types.filter((t) => !aNames.has(t.name));
  const onlyAfter = after.types.filter((t) => !bNames.has(t.name));

  const afterBySig = new Map<string, string[]>();
  for (const t of onlyAfter) {
    const sig = signature(t.shape, aResolve);
    afterBySig.set(sig, [...(afterBySig.get(sig) ?? []), t.name]);
  }

  const reorgs: Reorganization[] = [];
  const claimed = new Set<string>();
  for (const t of onlyBefore) {
    const sig = signature(t.shape, bResolve);
    const candidates = (afterBySig.get(sig) ?? []).filter((n) => !claimed.has(n));
    if (candidates.length > 0) {
      const match = candidates[0]!;
      claimed.add(match);
      reorgs.push({ before: t.name, after: match });
    }
  }
  return reorgs.toSorted((x, y) => x.after.localeCompare(y.after));
}

export function diffVersions(before: VersionArtifact, after: VersionArtifact): VersionDiff {
  return {
    before: before.version,
    after: after.version,
    methods: diffMethods(before, after),
    capabilities: diffCapabilities(before, after),
    reorganizations: diffReorganizations(before, after),
  };
}
