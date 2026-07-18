import { describe, expect, it } from "vite-plus/test";
import type { VersionArtifact } from "../pipeline/artifact.ts";
import {
  FLOWS,
  flowPresence,
  isDeprecated,
  presentSteps,
  stepShape,
  validateFlows,
} from "./flows.ts";
import v20241105 from "../data/2024-11-05.json" with { type: "json" };
import v20251125 from "../data/2025-11-25.json" with { type: "json" };
import draft from "../data/draft.json" with { type: "json" };

const artifacts = [v20241105, v20251125, draft] as VersionArtifact[];
const first = v20251125 as VersionArtifact;
const draftArt = draft as VersionArtifact;
const oldest = v20241105 as VersionArtifact;

// #19 — the build-time drift gate. Every referenced method must exist somewhere.
describe("validateFlows (#19)", () => {
  it("every flow method exists in at least one version's IR", () => {
    expect(validateFlows(FLOWS, artifacts)).toEqual([]);
  });

  it("flags a method that exists in no version (the `tool/call` typo class)", () => {
    const bad = [
      { ...FLOWS[0]!, id: "bad", steps: [{ ...FLOWS[0]!.steps[0]!, method: "tool/call" }] },
    ];
    expect(validateFlows(bad, artifacts)).toEqual([{ flow: "bad", method: "tool/call" }]);
  });
});

// #20 — presence and deprecation are per version.
describe("flowPresence (#20)", () => {
  it("the initialize handshake is present in dated versions but absent in the stateless draft", () => {
    const init = FLOWS.find((f) => f.id === "initialize")!;
    expect(flowPresence(init, first)).toBe("present");
    expect(flowPresence(init, draftArt)).toBe("absent");
  });

  it("elicitation is absent in the oldest version (feature not yet introduced)", () => {
    const elicit = FLOWS.find((f) => f.id === "elicitation")!;
    expect(flowPresence(elicit, oldest)).toBe("absent");
    expect(flowPresence(elicit, first)).toBe("present");
  });

  it("the tool-call flow is present everywhere its core method exists", () => {
    const call = FLOWS.find((f) => f.id === "tool-call")!;
    expect(flowPresence(call, oldest)).toBe("present");
    expect(flowPresence(call, draftArt)).toBe("present");
  });

  it("drops optional steps whose method is absent, keeps required ones", () => {
    // resources/subscribe is removed in the draft; the read steps remain.
    const resources = FLOWS.find((f) => f.id === "resources")!;
    const draftSteps = presentSteps(resources, draftArt).map((s) => s.method);
    expect(draftSteps).toContain("resources/read");
    expect(draftSteps).not.toContain("resources/subscribe");
  });

  it("marks sampling and roots deprecated in the draft only", () => {
    const sampling = FLOWS.find((f) => f.id === "sampling")!;
    expect(isDeprecated(sampling, "draft")).toBe(true);
    expect(isDeprecated(sampling, "2025-11-25")).toBe(false);
  });
});

describe("stepShape", () => {
  it("resolves a request step to its params and a result step to its result", () => {
    const call = FLOWS.find((f) => f.id === "tool-call")!;
    const req = call.steps.find((s) => s.message === "request")!;
    const res = call.steps.find((s) => s.message === "result")!;
    expect(stepShape(req, first)).toBeDefined();
    expect(stepShape(res, first)).toBeDefined();
  });

  it("returns undefined for a method absent from the version", () => {
    const init = FLOWS.find((f) => f.id === "initialize")!;
    expect(stepShape(init.steps[0]!, draftArt)).toBeUndefined();
  });
});
