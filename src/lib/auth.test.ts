import { describe, expect, it } from "vite-plus/test";
import { AUTH_DANCE, AUTH_VERSIONS, danceForVersion, validateAuthCitations } from "./auth.ts";

// #21 — the citation drift gate. Every anchor must be well-formed and on-domain.
describe("validateAuthCitations (#21)", () => {
  it("all feature and step citations are well-formed and on an allowed host", () => {
    expect(validateAuthCitations()).toEqual([]);
  });

  it("every dance step carries at least one citation", () => {
    expect(AUTH_DANCE.every((s) => s.citations.length > 0)).toBe(true);
  });
});

// #22 — the auth evolution matrix covers every protocol version.
describe("auth evolution matrix (#22)", () => {
  it("2024-11-05 declares no authorization model", () => {
    const first = AUTH_VERSIONS.find((v) => v.version === "2024-11-05")!;
    expect(first.features).toEqual([]);
  });

  it("features accrue over versions (2025-11-25 adds CIMD)", () => {
    const v = AUTH_VERSIONS.find((x) => x.version === "2025-11-25")!;
    expect(v.features.some((f) => /CIMD/i.test(f.name))).toBe(true);
  });
});

describe("danceForVersion (#21)", () => {
  it("hides the iss-validation step before the draft", () => {
    const labels = (v: string) => danceForVersion(v).map((s) => s.label);
    expect(labels("2025-11-25").some((l) => /iss/i.test(l))).toBe(false);
    expect(labels("draft").some((l) => /iss/i.test(l))).toBe(true);
  });

  it("the draft dance is a superset of the 2025-11-25 dance", () => {
    expect(danceForVersion("draft").length).toBeGreaterThanOrEqual(
      danceForVersion("2025-11-25").length,
    );
  });
});
