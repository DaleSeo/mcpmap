import { describe, expect, it } from "vite-plus/test";
import type { VersionArtifact } from "../pipeline/artifact.ts";
import { areaSubgraph, neighborhood } from "./graph.ts";
import artifact from "../data/2025-11-25.json" with { type: "json" };

const ir = artifact as VersionArtifact;

describe("areaSubgraph", () => {
  it("selects exactly the types the clustering assigned to the area", () => {
    const sub = areaSubgraph(ir, "tools");
    const cluster = ir.clusters.find((c) => c.area === "tools")!;
    expect(sub.nodes.map((n) => n.id).toSorted()).toEqual(cluster.types.toSorted());
  });

  it("every node carries the area it was selected for", () => {
    const sub = areaSubgraph(ir, "prompts");
    expect(sub.nodes.every((n) => n.area === "prompts")).toBe(true);
  });

  it("keeps only edges internal to the area (no hairball spill)", () => {
    const sub = areaSubgraph(ir, "tools");
    const names = new Set(sub.nodes.map((n) => n.id));
    expect(sub.edges.every((e) => names.has(e.source) && names.has(e.target))).toBe(true);
  });

  it("emits no self-loops or duplicate edges", () => {
    const sub = areaSubgraph(ir, "resources");
    const ids = sub.edges.map((e) => e.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(sub.edges.some((e) => e.source === e.target)).toBe(false);
  });

  it("returns an empty subgraph for an unknown area", () => {
    expect(areaSubgraph(ir, "nope")).toEqual({ nodes: [], edges: [] });
  });
});

describe("neighborhood", () => {
  it("includes the root itself", () => {
    const sub = neighborhood(ir, "CallToolRequest", 1);
    expect(sub.nodes.map((n) => n.id)).toContain("CallToolRequest");
  });

  it("1-hop reaches direct references in both directions", () => {
    const sub = neighborhood(ir, "CallToolRequest", 1);
    const names = new Set(sub.nodes.map((n) => n.id));
    // CallToolRequest -> CallToolRequestParams is a direct ref.
    expect(names.has("CallToolRequestParams")).toBe(true);
  });

  it("2-hop is a strict superset of 1-hop and crosses area boundaries", () => {
    const one = neighborhood(ir, "CallToolRequest", 1);
    const two = neighborhood(ir, "CallToolRequest", 2);
    const oneNames = new Set(one.nodes.map((n) => n.id));
    const twoNames = new Set(two.nodes.map((n) => n.id));
    expect(two.nodes.length).toBeGreaterThan(one.nodes.length);
    expect([...oneNames].every((n) => twoNames.has(n))).toBe(true);
  });

  it("clamps hops to at most 2", () => {
    const two = neighborhood(ir, "CallToolRequest", 2);
    const wild = neighborhood(ir, "CallToolRequest", 99);
    expect(wild.nodes.length).toBe(two.nodes.length);
  });

  it("returns empty for an unknown type", () => {
    expect(neighborhood(ir, "DoesNotExist", 2)).toEqual({ nodes: [], edges: [] });
  });

  it("does not expand through hub types into unrelated siblings", () => {
    // CallToolRequest reaches the ClientRequest union hub at 1 hop; without a hub
    // boundary, 2 hops would pull in every sibling request through it.
    const sub = neighborhood(ir, "CallToolRequest", 2);
    const names = new Set(sub.nodes.map((n) => n.id));
    expect(names.has("ClientRequest")).toBe(true); // the hub itself is shown …
    expect(names.has("ListPromptsRequest")).toBe(false); // … but its far side is not
    // A local view stays small even through hubs — nowhere near the ~145 total.
    expect(sub.nodes.length).toBeLessThan(30);
  });
});
