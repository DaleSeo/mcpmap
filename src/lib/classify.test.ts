import { describe, expect, it } from "vite-plus/test";
import type { MethodDiff, ShapeDiff } from "./diff.ts";
import { classifyCapability, classifyMethod } from "./classify.ts";

const empty: ShapeDiff = { status: "unchanged", fields: [] };

function method(over: Partial<MethodDiff>): MethodDiff {
  return {
    method: "x/y",
    status: "changed",
    messageType: "request",
    directionBefore: "clientToServer",
    directionAfter: "clientToServer",
    params: empty,
    result: empty,
    ...over,
  };
}

describe("classifyMethod — whole-method changes", () => {
  it("added is additive for both roles", () => {
    expect(classifyMethod(method({ status: "added" }))).toEqual({
      client: "additive",
      server: "additive",
    });
  });
  it("removed is breaking for both roles", () => {
    expect(classifyMethod(method({ status: "removed" }))).toEqual({
      client: "breaking",
      server: "breaking",
    });
  });
  it("unchanged is none for both roles", () => {
    expect(classifyMethod(method({ status: "unchanged" }))).toEqual({
      client: "none",
      server: "none",
    });
  });
});

describe("classifyMethod — request params (written by the sender)", () => {
  it("a new required param breaks the writer, is additive for the reader", () => {
    // clientToServer: client writes params, server reads them.
    const v = classifyMethod(
      method({
        params: {
          status: "changed",
          fields: [{ name: "f", status: "added", requiredAfter: true }],
        },
      }),
    );
    expect(v).toEqual({ client: "breaking", server: "additive" });
  });

  it("a new optional param is additive for both", () => {
    const v = classifyMethod(
      method({
        params: {
          status: "changed",
          fields: [{ name: "f", status: "added", requiredAfter: false }],
        },
      }),
    );
    expect(v).toEqual({ client: "additive", server: "additive" });
  });

  it("a removed param breaks the reader", () => {
    const v = classifyMethod(
      method({
        params: {
          status: "changed",
          fields: [{ name: "f", status: "removed", requiredBefore: true }],
        },
      }),
    );
    expect(v).toEqual({ client: "additive", server: "breaking" });
  });

  it("optional→required breaks the writer; required→optional breaks the reader", () => {
    const tighten = classifyMethod(
      method({
        params: {
          status: "changed",
          fields: [{ name: "f", status: "changed", requiredBefore: false, requiredAfter: true }],
        },
      }),
    );
    expect(tighten).toEqual({ client: "breaking", server: "additive" });

    const loosen = classifyMethod(
      method({
        params: {
          status: "changed",
          fields: [{ name: "f", status: "changed", requiredBefore: true, requiredAfter: false }],
        },
      }),
    );
    expect(loosen).toEqual({ client: "additive", server: "breaking" });
  });

  it("a param type change is breaking for both ends", () => {
    const v = classifyMethod(
      method({
        params: {
          status: "changed",
          fields: [
            {
              name: "f",
              status: "changed",
              requiredBefore: true,
              requiredAfter: true,
              typeBefore: "string",
              typeAfter: "number",
            },
          ],
        },
      }),
    );
    expect(v).toEqual({ client: "breaking", server: "breaking" });
  });
});

describe("classifyMethod — result (written by the receiver) and direction", () => {
  it("a new required result field breaks the server writer on a client→server call", () => {
    // result writer = server, reader = client.
    const v = classifyMethod(
      method({
        result: {
          status: "changed",
          fields: [{ name: "f", status: "added", requiredAfter: true }],
        },
      }),
    );
    expect(v).toEqual({ client: "additive", server: "breaking" });
  });

  it("direction flips which implementer is the writer", () => {
    // serverToClient params: server writes, client reads. New required param → server breaking.
    const v = classifyMethod(
      method({
        directionBefore: "serverToClient",
        directionAfter: "serverToClient",
        params: {
          status: "changed",
          fields: [{ name: "f", status: "added", requiredAfter: true }],
        },
      }),
    );
    expect(v).toEqual({ client: "additive", server: "breaking" });
  });

  it("direction 'both' applies the change to both roles", () => {
    const v = classifyMethod(
      method({
        directionBefore: "both",
        directionAfter: "both",
        params: {
          status: "changed",
          fields: [{ name: "f", status: "added", requiredAfter: true }],
        },
      }),
    );
    expect(v).toEqual({ client: "breaking", server: "breaking" });
  });

  it("takes the worst severity across many field changes", () => {
    const v = classifyMethod(
      method({
        params: {
          status: "changed",
          fields: [
            { name: "opt", status: "added", requiredAfter: false }, // additive for client
            { name: "req", status: "added", requiredAfter: true }, // breaking for client
          ],
        },
      }),
    );
    expect(v.client).toBe("breaking");
  });
});

describe("classifyCapability", () => {
  it("a removed capability breaks the declaring role only", () => {
    expect(classifyCapability({ name: "tools", side: "server", status: "removed" })).toEqual({
      client: "none",
      server: "breaking",
    });
  });
  it("an added capability is additive for the declaring role only", () => {
    expect(classifyCapability({ name: "tasks", side: "client", status: "added" })).toEqual({
      client: "additive",
      server: "none",
    });
  });
  it("an unchanged capability is none", () => {
    expect(classifyCapability({ name: "tools", side: "server", status: "unchanged" })).toEqual({
      client: "none",
      server: "none",
    });
  });
});
