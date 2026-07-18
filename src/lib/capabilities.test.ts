import { describe, expect, it } from "vite-plus/test";
import type { VersionArtifact } from "../pipeline/artifact.ts";
import { bySide, capabilityMatrix } from "./capabilities.ts";
import artifact from "../data/2025-11-25.json" with { type: "json" };

const ir = artifact as VersionArtifact;

describe("capabilityMatrix", () => {
  const rows = capabilityMatrix(ir);

  it("emits one row per declared capability", () => {
    expect(rows).toHaveLength(ir.capabilities.length);
  });

  it("links the tools capability to the tools/* methods", () => {
    const tools = rows.find((r) => r.name === "tools" && r.side === "server")!;
    const methods = tools.methods.map((m) => m.method);
    expect(methods).toContain("tools/call");
    expect(methods).toContain("tools/list");
    // The area also gathers the tools notification, not just tools/* requests.
    expect(methods).toContain("notifications/tools/list_changed");
  });

  it("carries side and description straight from the capability", () => {
    const logging = rows.find((r) => r.name === "logging")!;
    expect(logging.side).toBe("server");
  });

  it("tolerates capabilities with no enabled methods", () => {
    const experimental = rows.filter((r) => r.name === "experimental");
    expect(experimental.length).toBeGreaterThan(0);
    expect(experimental.every((r) => Array.isArray(r.methods))).toBe(true);
  });
});

describe("bySide", () => {
  it("partitions rows into client and server", () => {
    const { client, server } = bySide(capabilityMatrix(ir));
    expect(client.every((r) => r.side === "client")).toBe(true);
    expect(server.every((r) => r.side === "server")).toBe(true);
    expect(client.length + server.length).toBe(ir.capabilities.length);
  });
});
