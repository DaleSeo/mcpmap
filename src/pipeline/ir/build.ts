// schema.json (either dialect) → normalized IR.

import type {
  Dialect,
  Field,
  Ir,
  RefEdge,
  ScalarType,
  TypeKind,
  TypeNode,
  TypeRef,
} from "./types.ts";

/** A raw JSON Schema node (only the keywords the MCP schema actually uses). */
interface JsonSchema {
  $schema?: string;
  $ref?: string;
  type?: string | string[];
  const?: string | number | boolean | null;
  enum?: Array<string | number>;
  properties?: Record<string, JsonSchema>;
  required?: string[];
  additionalProperties?: boolean | JsonSchema;
  items?: JsonSchema;
  anyOf?: JsonSchema[];
  oneOf?: JsonSchema[];
  allOf?: JsonSchema[];
  description?: string;
  definitions?: Record<string, JsonSchema>;
  $defs?: Record<string, JsonSchema>;
}

const SCALARS: ReadonlySet<string> = new Set(["string", "number", "integer", "boolean", "null"]);

function detectDialect(schema: JsonSchema): Dialect {
  const s = schema.$schema ?? "";
  if (s.includes("2020-12")) return "2020-12";
  if (s.includes("draft-07")) return "draft-07";
  if (schema.$defs) return "2020-12";
  if (schema.definitions) return "draft-07";
  return "unknown";
}

/** `#/definitions/Foo` or `#/$defs/Foo` → `Foo`. */
function refName(ref: string): string {
  const idx = ref.lastIndexOf("/");
  return idx === -1 ? ref : ref.slice(idx + 1);
}

function parseNode(schema: JsonSchema): TypeRef {
  if (schema.$ref) return { kind: "ref", name: refName(schema.$ref) };
  if ("const" in schema && schema.const !== undefined) {
    return { kind: "const", value: schema.const };
  }
  if (schema.enum) {
    const scalar =
      typeof schema.type === "string" && SCALARS.has(schema.type)
        ? (schema.type as ScalarType)
        : undefined;
    return { kind: "enum", values: schema.enum, ...(scalar ? { scalar } : {}) };
  }
  if (schema.anyOf) return { kind: "union", of: schema.anyOf.map(parseNode) };
  if (schema.oneOf) return { kind: "union", of: schema.oneOf.map(parseNode) };
  if (schema.allOf) return { kind: "allOf", of: schema.allOf.map(parseNode) };

  const t = schema.type;
  if (Array.isArray(t)) {
    // e.g. ["string", "null"] — a union of scalars.
    return { kind: "union", of: t.map((s) => scalarRef(s)) };
  }
  if (t === "array") {
    return { kind: "array", items: schema.items ? parseNode(schema.items) : { kind: "any" } };
  }
  if (t === "object" || schema.properties || "additionalProperties" in schema) {
    return parseObject(schema);
  }
  if (typeof t === "string" && SCALARS.has(t)) return scalarRef(t);
  return { kind: "any" };
}

function scalarRef(t: string): TypeRef {
  return SCALARS.has(t) ? { kind: "scalar", scalar: t as ScalarType } : { kind: "any" };
}

function parseObject(schema: JsonSchema): TypeRef {
  const required = new Set(schema.required ?? []);
  const fields: Field[] = Object.entries(schema.properties ?? {}).map(([name, prop]) => ({
    name,
    type: parseNode(prop),
    required: required.has(name),
    ...(prop.description ? { description: prop.description } : {}),
  }));

  let additionalProperties: TypeRef | boolean | undefined;
  const ap = schema.additionalProperties;
  if (ap === true || ap === false) {
    additionalProperties = ap;
  } else if (ap && typeof ap === "object") {
    // `additionalProperties: {}` (empty schema) means "any value" — an open map.
    additionalProperties = Object.keys(ap).length === 0 ? true : parseNode(ap);
  }

  return {
    kind: "object",
    fields,
    ...(additionalProperties === undefined ? {} : { additionalProperties }),
  };
}

function classify(shape: TypeRef): TypeKind {
  switch (shape.kind) {
    case "object":
      return "object";
    case "union":
      return "union";
    case "enum":
      return "enum";
    case "scalar":
      return "scalar";
    default:
      return "alias";
  }
}

/** Collect every named type reachable from a shape (for the reference graph). */
function collectRefs(shape: TypeRef, out: Set<string>): void {
  switch (shape.kind) {
    case "ref":
      out.add(shape.name);
      return;
    case "array":
      collectRefs(shape.items, out);
      return;
    case "object":
      for (const field of shape.fields) collectRefs(field.type, out);
      if (shape.additionalProperties && typeof shape.additionalProperties === "object") {
        collectRefs(shape.additionalProperties, out);
      }
      return;
    case "union":
    case "allOf":
      for (const member of shape.of) collectRefs(member, out);
      return;
    default:
      return;
  }
}

export function buildIr(version: string, schema: JsonSchema): Ir {
  const dialect = detectDialect(schema);
  const defs = schema.$defs ?? schema.definitions ?? {};

  const types: TypeNode[] = [];
  const refs: RefEdge[] = [];

  for (const name of Object.keys(defs).toSorted()) {
    const def = defs[name];
    if (!def) continue;
    const shape = parseNode(def);
    types.push({
      name,
      kind: classify(shape),
      ...(def.description ? { description: def.description } : {}),
      shape,
    });

    const seen = new Set<string>();
    collectRefs(shape, seen);
    for (const to of [...seen].toSorted()) refs.push({ from: name, to });
  }

  return { version, dialect, types, refs };
}
