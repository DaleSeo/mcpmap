import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, expect, it, vi } from "vite-plus/test";
import { fetchAll } from "./fetch.ts";

let schemasDir: string;
let commit: string;
let schemas: Record<string, string>;

beforeEach(async () => {
  schemasDir = await mkdtemp(join(tmpdir(), "mcpmap-fetch-"));
  commit = "first-commit";
  schemas = { draft: '{"type":"object"}' };
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string) => {
      if (url.includes("/commits/")) return Response.json({ sha: commit });
      if (url.includes("/contents/")) {
        return Response.json(Object.keys(schemas).map((name) => ({ name, type: "dir" })));
      }
      const version = url.split("/").at(-2)!;
      return new Response(schemas[version], { status: schemas[version] ? 200 : 404 });
    }),
  );
});

afterEach(async () => {
  vi.unstubAllGlobals();
  await rm(schemasDir, { recursive: true, force: true });
});

it("keeps the pin and manifest bytes when only upstream commit, time, or whitespace change", async () => {
  const first = await fetchAll("main", "first-time", schemasDir);
  const before = await readFile(join(schemasDir, "manifest.json"), "utf8");
  commit = "second-commit";
  schemas.draft = '{ "type": "object" }';

  expect(await fetchAll("main", "second-time", schemasDir)).toEqual(first);
  expect(await readFile(join(schemasDir, "manifest.json"), "utf8")).toBe(before);
});

it("refreshes the pin and canonical snapshot when schema content changes", async () => {
  const first = await fetchAll("main", "first-time", schemasDir);
  commit = "second-commit";
  schemas.draft = '{"type":"string"}';

  const next = await fetchAll("main", "second-time", schemasDir);
  expect(next.commit).toBe(commit);
  expect(next.versions[0]!.sha256).not.toBe(first.versions[0]!.sha256);
  expect(JSON.parse(await readFile(join(schemasDir, "draft/schema.json"), "utf8"))).toEqual({
    type: "string",
  });
});

it("detects added and removed versions even when existing schemas are unchanged", async () => {
  await fetchAll("main", "first-time", schemasDir);
  schemas["2026-01-01"] = schemas.draft!;
  const added = await fetchAll("main", "second-time", schemasDir);
  expect(added.versions.map((entry) => entry.version)).toEqual(["2026-01-01", "draft"]);

  delete schemas.draft;
  const removed = await fetchAll("main", "third-time", schemasDir);
  expect(removed.versions.map((entry) => entry.version)).toEqual(["2026-01-01"]);
});

it("leaves snapshots and the manifest intact if a later schema cannot be parsed", async () => {
  await fetchAll("main", "first-time", schemasDir);
  const before = await readFile(join(schemasDir, "manifest.json"), "utf8");
  schemas.draft = '{"type":"string"}';
  schemas.z = "invalid JSON";

  await expect(fetchAll("main", "second-time", schemasDir)).rejects.toThrow();
  expect(await readFile(join(schemasDir, "manifest.json"), "utf8")).toBe(before);
  expect(JSON.parse(await readFile(join(schemasDir, "draft/schema.json"), "utf8"))).toEqual({
    type: "object",
  });
});
