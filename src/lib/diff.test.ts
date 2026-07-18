import { describe, expect, it } from "vite-plus/test";
import type { VersionArtifact } from "../pipeline/artifact.ts";
import { diffVersions } from "./diff.ts";
import v20250618 from "../data/2025-06-18.json" with { type: "json" };
import v20251125 from "../data/2025-11-25.json" with { type: "json" };

const before = v20250618 as VersionArtifact;
const after = v20251125 as VersionArtifact;

describe("diffVersions identity", () => {
  it("diffing a version against itself reports no changes", () => {
    const d = diffVersions(after, after);
    expect(d.methods.every((m) => m.status === "unchanged")).toBe(true);
    expect(d.capabilities.every((c) => c.status === "unchanged")).toBe(true);
    expect(d.reorganizations).toEqual([]);
  });

  it("every method's params/result are unchanged in a self-diff", () => {
    const d = diffVersions(after, after);
    expect(
      d.methods.every((m) => m.params.status === "unchanged" && m.result.status === "unchanged"),
    ).toBe(true);
  });
});

// #17 — the acceptance gate for the wire-identity approach. The 2025-06-18 →
// 2025-11-25 boundary carries SEP-1319 (inline params promoted to named types)
// and SEP-1613 (draft-07 → 2020-12 dialect change). Neither is a wire change, so
// they must not manifest as added/removed churn.
describe("diffVersions across the 2025-06-18 → 2025-11-25 boundary (#17)", () => {
  const d = diffVersions(before, after);
  const status = (s: string) => d.methods.filter((m) => m.status === s).map((m) => m.method);

  it("removes no methods — SEP-1319 renaming is not a removal", () => {
    expect(status("removed")).toEqual([]);
  });

  it("only adds methods that are genuinely new (the Tasks feature)", () => {
    // Every added method is a tasks method or a new notification, never a
    // renamed pre-existing one.
    for (const method of status("added")) {
      expect(method === "notifications/elicitation/complete" || /task/i.test(method)).toBe(true);
    }
  });

  it("does not mistake the SEP-1319 named-params types for a mass rename", () => {
    // Inline → named promotion has no pre-existing named counterpart, so it
    // produces no reorganization pairs and no churn here.
    expect(d.reorganizations.length).toBe(0);
  });

  it("surfaces the real field additions on tools/call (_meta, task)", () => {
    const call = d.methods.find((m) => m.method === "tools/call")!;
    const added = call.params.fields.filter((f) => f.status === "added").map((f) => f.name);
    expect(added).toContain("task");
    expect(added).toContain("_meta");
  });

  it("carries method direction from both sides for the classifier", () => {
    const call = d.methods.find((m) => m.method === "tools/call")!;
    expect(call.directionBefore).toBe("clientToServer");
    expect(call.directionAfter).toBe("clientToServer");
  });

  it("adds the tasks capability on both sides", () => {
    const changed = d.capabilities.filter((c) => c.status !== "unchanged");
    expect(changed).toEqual(
      expect.arrayContaining([
        { name: "tasks", side: "client", status: "added" },
        { name: "tasks", side: "server", status: "added" },
      ]),
    );
  });

  it("keeps genuinely-untouched methods unchanged (no over-reporting)", () => {
    // A major release still leaves some methods alone; the differ must not mark
    // everything changed.
    expect(status("unchanged").length).toBeGreaterThan(0);
  });

  it("every changed method has a concrete field-level reason", () => {
    for (const m of d.methods.filter((x) => x.status === "changed")) {
      expect(m.params.fields.length + m.result.fields.length).toBeGreaterThan(0);
    }
  });
});
