// The normalized intermediate representation (IR).
//
// The IR is a version-independent model of the protocol's types, derived from
// each version's schema.json regardless of JSON Schema dialect (draft-07 uses
// `definitions` + `#/definitions/X`; 2020-12 uses `$defs` + `#/$defs/X`). Every
// downstream artifact — type explorer, version diff, flow validation — reads the
// IR, never the raw schema, so dialect quirks are handled in exactly one place.

export type Dialect = "draft-07" | "2020-12" | "unknown";

export type ScalarType = "string" | "number" | "integer" | "boolean" | "null";

/**
 * A recursive description of a type position (a field's type, an array's items,
 * a union member). Named types are referenced by `ref`; inline shapes (e.g. the
 * pre-SEP-1319 inline `params` objects) are captured structurally, so the differ
 * can compare effective wire shapes across versions that split types out.
 */
export type TypeRef =
  | { kind: "ref"; name: string }
  | { kind: "scalar"; scalar: ScalarType }
  | { kind: "const"; value: string | number | boolean | null }
  | { kind: "enum"; values: Array<string | number>; scalar?: ScalarType }
  | { kind: "array"; items: TypeRef }
  | {
      kind: "object";
      fields: Field[];
      /** Open maps: `true` = any extra props; a TypeRef = typed value; `false` = closed. */
      additionalProperties?: TypeRef | boolean;
    }
  | { kind: "union"; of: TypeRef[] }
  | { kind: "allOf"; of: TypeRef[] }
  | { kind: "any" };

export interface Field {
  name: string;
  type: TypeRef;
  required: boolean;
  description?: string;
}

/** Coarse classification for the explorer UI, derived from the shape. */
export type TypeKind = "object" | "union" | "enum" | "scalar" | "alias";

export interface TypeNode {
  name: string;
  kind: TypeKind;
  description?: string;
  /** The full parsed shape — the single source of truth for this type. */
  shape: TypeRef;
}

/** A directed edge in the reference graph: `from` type mentions `to` type. */
export interface RefEdge {
  from: string;
  to: string;
}

export interface Ir {
  version: string;
  dialect: Dialect;
  types: TypeNode[];
  refs: RefEdge[];
}
