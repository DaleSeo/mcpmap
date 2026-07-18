// Snapshot + invariant tests pinning the IR for every protocol version.
//
// Two lines of defense against upstream or parser drift:
//  1. A compact per-version summary snapshot — a readable diff when a schema
//     changes (counts, method directions, dialect), reviewed before accepting.
//  2. Invariants that must hold regardless of version, including the wire-identity
//     keystone (inline vs $ref params across the SEP-1319 split).
// Plus a freshness check that committed src/data matches a fresh build.

import { readFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vite-plus/test";
import { buildIr } from "./ir/build.ts";
import { buildInventory } from "./ir/inventory.ts";
import { buildVersion, orderVersions } from "./build.ts";
import type { Manifest } from "./fetch.ts";
import type { TypeNode } from "./ir/types.ts";

const HERE = dirname(fileURLToPath(import.meta.url));
const SCHEMAS_DIR = join(HERE, "schemas");
const DATA_DIR = join(HERE, "..", "data");

async function readJson<T>(path: string): Promise<T> {
  return JSON.parse(await readFile(path, "utf8")) as T;
}

const manifest = await readJson<Manifest>(join(SCHEMAS_DIR, "manifest.json"));
const versions = orderVersions(manifest.versions.map((v) => v.version));

function typeByName(types: TypeNode[], name: string): TypeNode | undefined {
  return types.find((t) => t.name === name);
}

/** A compact, human-readable fingerprint of a version's shape. */
async function summarize(version: string) {
  const schema = await readJson<Record<string, unknown>>(join(SCHEMAS_DIR, version, "schema.json"));
  const ir = buildIr(version, schema);
  const inv = buildInventory(ir);
  const byKind: Record<string, number> = {};
  for (const t of ir.types) byKind[t.kind] = (byKind[t.kind] ?? 0) + 1;
  return {
    dialect: ir.dialect,
    typeCount: ir.types.length,
    typesByKind: byKind,
    methods: inv.methods.map((m) => ({
      method: m.method,
      direction: m.direction,
      messageType: m.messageType,
      resultType: m.resultType,
    })),
    capabilities: inv.capabilities.map((c) => `${c.side}:${c.name}`),
  };
}

describe("pipeline IR", () => {
  it("discovers the expected versions", () => {
    expect(versions).toMatchInlineSnapshot(`
      [
        "draft",
        "2025-11-25",
        "2025-06-18",
        "2025-03-26",
        "2024-11-05",
      ]
    `);
  });

  for (const version of versions) {
    describe(version, () => {
      it("matches the shape summary snapshot", async () => {
        expect(await summarize(version)).toMatchSnapshot();
      });

      it("committed src/data is freshly built", async () => {
        const built = await buildVersion(version);
        const committed = await readJson(join(DATA_DIR, `${version}.json`));
        expect(committed).toEqual(built);
      });
    });
  }

  it("detects both JSON Schema dialects", async () => {
    const oldest = buildIr(
      "2024-11-05",
      await readJson(join(SCHEMAS_DIR, "2024-11-05", "schema.json")),
    );
    const newer = buildIr(
      "2025-11-25",
      await readJson(join(SCHEMAS_DIR, "2025-11-25", "schema.json")),
    );
    expect(oldest.dialect).toBe("draft-07");
    expect(newer.dialect).toBe("2020-12");
  });

  // The wire-identity keystone: SEP-1319 (2025-11-25) split request params into
  // standalone types. The IR must capture params inline in the old dialect and as
  // a $ref in the new one — that difference is what the version differ relies on.
  it("captures inline vs $ref params across the SEP-1319 split", async () => {
    const old = buildIr(
      "2024-11-05",
      await readJson(join(SCHEMAS_DIR, "2024-11-05", "schema.json")),
    );
    const now = buildIr(
      "2025-11-25",
      await readJson(join(SCHEMAS_DIR, "2025-11-25", "schema.json")),
    );
    const oldParams = paramsField(typeByName(old.types, "CallToolRequest"));
    const nowParams = paramsField(typeByName(now.types, "CallToolRequest"));
    expect(oldParams?.type.kind).toBe("object"); // inline
    expect(nowParams?.type.kind).toBe("ref"); // extracted
    if (nowParams?.type.kind === "ref") {
      expect(nowParams.type.name).toBe("CallToolRequestParams");
    }
  });

  it("marks ping and cancelled as bidirectional in dated versions", async () => {
    const inv = buildInventory(
      buildIr("2025-11-25", await readJson(join(SCHEMAS_DIR, "2025-11-25", "schema.json"))),
    );
    const ping = inv.methods.find((m) => m.method === "ping");
    const cancelled = inv.methods.find((m) => m.method === "notifications/cancelled");
    expect(ping?.direction).toBe("both");
    expect(cancelled?.direction).toBe("both");
  });

  it("resolves a direction for every method in dated versions", async () => {
    for (const version of versions.filter((v) => v !== "draft")) {
      const inv = buildInventory(
        buildIr(version, await readJson(join(SCHEMAS_DIR, version, "schema.json"))),
      );
      const unresolved = inv.methods.filter((m) => m.directionUnknown);
      expect(unresolved, `${version} has unresolved directions`).toEqual([]);
    }
  });
});

function paramsField(type: TypeNode | undefined) {
  if (type?.shape.kind !== "object") return undefined;
  return type.shape.fields.find((f) => f.name === "params");
}
