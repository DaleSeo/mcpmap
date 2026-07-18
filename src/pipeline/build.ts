// Orchestrator: committed schema snapshots → per-version artifacts in src/data.
//
// Reads only the pinned snapshots (never the network), so builds are reproducible
// and CI needs no credentials. Run `bun run pipeline:fetch` first to refresh them.

import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { buildIr } from "./ir/build.ts";
import { buildInventory } from "./ir/inventory.ts";
import { buildClustering } from "./ir/clusters.ts";
import type { DataIndex, VersionArtifact } from "./artifact.ts";
import type { Manifest } from "./fetch.ts";

const HERE = dirname(fileURLToPath(import.meta.url));
const SCHEMAS_DIR = join(HERE, "schemas");
const DATA_DIR = join(HERE, "..", "data");

/** Order versions newest-first, with `draft` pinned to the front. */
export function orderVersions(versions: string[]): string[] {
  const dated = versions
    .filter((v) => v !== "draft")
    .toSorted()
    .toReversed();
  return versions.includes("draft") ? ["draft", ...dated] : dated;
}

async function readJson<T>(path: string): Promise<T> {
  return JSON.parse(await readFile(path, "utf8")) as T;
}

/** Build the artifact for a single version from its snapshot. */
export async function buildVersion(version: string): Promise<VersionArtifact> {
  const schema = await readJson<Record<string, unknown>>(join(SCHEMAS_DIR, version, "schema.json"));
  const ir = buildIr(version, schema);
  const inventory = buildInventory(ir);
  const clustering = buildClustering(ir, inventory);
  return {
    version,
    dialect: ir.dialect,
    types: ir.types,
    refs: ir.refs,
    methods: inventory.methods,
    capabilities: inventory.capabilities,
    clusters: clustering.clusters,
    areaOf: clustering.areaOf,
  };
}

export async function buildAll(now = new Date().toISOString()): Promise<void> {
  const manifest = await readJson<Manifest>(join(SCHEMAS_DIR, "manifest.json"));
  const versions = orderVersions(manifest.versions.map((v) => v.version));

  await mkdir(DATA_DIR, { recursive: true });
  for (const version of versions) {
    const artifact = await buildVersion(version);
    await writeFile(join(DATA_DIR, `${version}.json`), `${JSON.stringify(artifact)}\n`);
    console.log(
      `built ${version}: ${artifact.types.length} types, ` +
        `${artifact.methods.length} methods, ${artifact.clusters.length} clusters`,
    );
  }

  const index: DataIndex = {
    versions,
    commit: manifest.commit,
    generatedAt: now,
  };
  await writeFile(join(DATA_DIR, "index.json"), `${JSON.stringify(index, null, 2)}\n`);
  console.log(`\nwrote index: ${versions.join(", ")}`);
}

if (import.meta.main) {
  await buildAll();
}
