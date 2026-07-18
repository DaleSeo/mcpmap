import { describe, expect, it } from "vite-plus/test";
import type { TypeNode, TypeRef } from "../pipeline/ir/types.ts";
import { exampleFor, formatType, objectFields, schemaReferenceUrl } from "./typeref.ts";

describe("formatType", () => {
  it("renders scalars, refs, and consts", () => {
    expect(formatType({ kind: "scalar", scalar: "string" })).toBe("string");
    expect(formatType({ kind: "ref", name: "ProgressToken" })).toBe("ProgressToken");
    expect(formatType({ kind: "const", value: "text" })).toBe('"text"');
  });

  it("renders unions and enums", () => {
    expect(
      formatType({
        kind: "union",
        of: [
          { kind: "ref", name: "A" },
          { kind: "ref", name: "B" },
        ],
      }),
    ).toBe("A | B");
    expect(formatType({ kind: "enum", values: ["a", "b"] })).toBe('"a" | "b"');
  });

  it("parenthesizes composite array items", () => {
    const t: TypeRef = {
      kind: "array",
      items: {
        kind: "union",
        of: [
          { kind: "ref", name: "A" },
          { kind: "ref", name: "B" },
        ],
      },
    };
    expect(formatType(t)).toBe("(A | B)[]");
  });
});

describe("exampleFor", () => {
  const registry = new Map<string, TypeNode>([
    [
      "Inner",
      {
        name: "Inner",
        kind: "object",
        shape: {
          kind: "object",
          fields: [{ name: "id", type: { kind: "scalar", scalar: "string" }, required: true }],
        },
      },
    ],
  ]);
  const lookup = (name: string) => registry.get(name);

  it("includes all top-level fields but only required nested ones", () => {
    const shape: TypeRef = {
      kind: "object",
      fields: [
        { name: "required", type: { kind: "scalar", scalar: "string" }, required: true },
        { name: "optional", type: { kind: "scalar", scalar: "boolean" }, required: false },
      ],
    };
    expect(exampleFor(shape, lookup)).toEqual({ required: "…", optional: true });
  });

  it("resolves refs one level via the lookup", () => {
    expect(exampleFor({ kind: "ref", name: "Inner" }, lookup)).toEqual({ id: "…" });
  });

  it("terminates on reference cycles", () => {
    const cyclic = new Map<string, TypeNode>([
      [
        "Node",
        {
          name: "Node",
          kind: "object",
          shape: {
            kind: "object",
            fields: [{ name: "next", type: { kind: "ref", name: "Node" }, required: true }],
          },
        },
      ],
    ]);
    // Should not throw or hang; the cycle collapses to the type name.
    const ex = exampleFor({ kind: "ref", name: "Node" }, (n) => cyclic.get(n));
    expect(ex).toEqual({ next: "Node" });
  });

  it("falls back to the type name for unresolved refs", () => {
    expect(exampleFor({ kind: "ref", name: "Unknown" }, lookup)).toBe("Unknown");
  });
});

describe("objectFields", () => {
  it("returns fields for objects and merges allOf object members", () => {
    expect(
      objectFields({
        kind: "object",
        fields: [{ name: "a", type: { kind: "any" }, required: true }],
      }),
    ).toHaveLength(1);
    const allOf: TypeRef = {
      kind: "allOf",
      of: [
        { kind: "object", fields: [{ name: "a", type: { kind: "any" }, required: true }] },
        { kind: "object", fields: [{ name: "b", type: { kind: "any" }, required: false }] },
      ],
    };
    expect(objectFields(allOf)).toHaveLength(2);
  });

  it("returns undefined for non-object types", () => {
    expect(objectFields({ kind: "scalar", scalar: "string" })).toBeUndefined();
  });
});

describe("schemaReferenceUrl", () => {
  it("builds a version-scoped anchor link", () => {
    expect(schemaReferenceUrl("2025-11-25", "CallToolRequest")).toBe(
      "https://modelcontextprotocol.io/specification/2025-11-25/schema#calltoolrequest",
    );
  });
});
