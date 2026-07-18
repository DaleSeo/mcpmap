// Fetches schema.json for every protocol version into committed snapshots.
//
// Versions are DISCOVERED (the schema/ directory is listed), never hardcoded, so
// a new protocol version — or the draft moving to a dated release — is picked up
// automatically by the weekly tracking bot. Everything is pinned to a single
// commit and recorded in manifest.json for reproducibility and drift detection.

import { mkdir, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  branchUrl,
  contentsUrl,
  DEFAULT_BRANCH,
  githubHeaders,
  rawUrl,
  SCHEMA_DIR,
  SCHEMA_FILE,
} from "./sources.ts";

const HERE = dirname(fileURLToPath(import.meta.url));
export const SCHEMAS_DIR = join(HERE, "schemas");
const MANIFEST_PATH = join(SCHEMAS_DIR, "manifest.json");

export interface VersionEntry {
  /** Version id, e.g. "2025-11-25" or "draft". */
  version: string;
  /** Path within the upstream repo. */
  path: string;
  /** sha256 of the fetched schema.json, for drift detection. */
  sha256: string;
}

export interface Manifest {
  /** Upstream repo commit the snapshots were pinned to. */
  commit: string;
  /** ISO timestamp of the fetch (passed in, since Date is nondeterministic). */
  fetchedAt: string;
  versions: VersionEntry[];
}

interface ContentsItem {
  type: string;
  name: string;
  path: string;
}

async function getJson<T>(url: string): Promise<T> {
  const res = await fetch(url, { headers: githubHeaders() });
  if (!res.ok) {
    throw new Error(`GET ${url} → ${res.status} ${res.statusText}`);
  }
  return (await res.json()) as T;
}

async function resolveCommit(branch: string): Promise<string> {
  const commit = await getJson<{ sha: string }>(branchUrl(branch));
  return commit.sha;
}

async function discoverVersions(commit: string): Promise<string[]> {
  const items = await getJson<ContentsItem[]>(contentsUrl(SCHEMA_DIR, commit));
  return items
    .filter((item) => item.type === "dir")
    .map((item) => item.name)
    .toSorted();
}

function sha256(text: string): string {
  return createHash("sha256").update(text).digest("hex");
}

async function fetchSchema(commit: string, version: string): Promise<string> {
  const path = `${SCHEMA_DIR}/${version}/${SCHEMA_FILE}`;
  const res = await fetch(rawUrl(commit, path), { headers: githubHeaders() });
  if (!res.ok) {
    throw new Error(`GET ${path} → ${res.status} ${res.statusText}`);
  }
  return await res.text();
}

/** Fetch all versions at `branch`, writing snapshots + manifest. */
export async function fetchAll(
  branch = DEFAULT_BRANCH,
  now = new Date().toISOString(),
): Promise<Manifest> {
  const commit = await resolveCommit(branch);
  const versions = await discoverVersions(commit);

  const entries: VersionEntry[] = [];
  for (const version of versions) {
    const raw = await fetchSchema(commit, version);
    // Re-serialize through JSON.parse so snapshots are canonically formatted and
    // stable regardless of upstream whitespace.
    const parsed = JSON.parse(raw) as unknown;
    const pretty = `${JSON.stringify(parsed, null, 2)}\n`;
    const dir = join(SCHEMAS_DIR, version);
    await mkdir(dir, { recursive: true });
    await writeFile(join(dir, SCHEMA_FILE), pretty);
    entries.push({
      version,
      path: `${SCHEMA_DIR}/${version}/${SCHEMA_FILE}`,
      sha256: sha256(pretty),
    });
    console.log(`fetched ${version} (${(pretty.length / 1024).toFixed(0)} KB)`);
  }

  const manifest: Manifest = { commit, fetchedAt: now, versions: entries };
  await mkdir(SCHEMAS_DIR, { recursive: true });
  await writeFile(MANIFEST_PATH, `${JSON.stringify(manifest, null, 2)}\n`);
  console.log(`\npinned to ${commit.slice(0, 10)} · ${entries.length} versions`);
  return manifest;
}

if (import.meta.main) {
  await fetchAll();
}
