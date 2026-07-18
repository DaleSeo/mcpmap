import { describe, expect, it } from "vite-plus/test";
import type { MethodEntry } from "../pipeline/ir/inventory.ts";
import { directionBadge, methodForType } from "./methods.ts";

const methods: MethodEntry[] = [
  {
    method: "tools/call",
    typeName: "CallToolRequest",
    messageType: "request",
    direction: "clientToServer",
    paramsType: "CallToolRequestParams",
    resultType: "CallToolResult",
  },
  {
    method: "notifications/cancelled",
    typeName: "CancelledNotification",
    messageType: "notification",
    direction: "both",
    paramsType: "CancelledNotificationParams",
  },
];

describe("methodForType", () => {
  it("matches the request type", () => {
    expect(methodForType(methods, "CallToolRequest")).toEqual({
      method: methods[0],
      role: "request",
    });
  });

  it("matches the result and params types", () => {
    expect(methodForType(methods, "CallToolResult")?.role).toBe("result");
    expect(methodForType(methods, "CallToolRequestParams")?.role).toBe("params");
  });

  it("matches notification types (no result)", () => {
    const match = methodForType(methods, "CancelledNotification");
    expect(match?.method.messageType).toBe("notification");
    expect(match?.method.resultType).toBeUndefined();
  });

  it("returns undefined for types outside any method", () => {
    expect(methodForType(methods, "Annotations")).toBeUndefined();
  });
});

describe("directionBadge", () => {
  it("labels each direction distinctly", () => {
    expect(directionBadge("clientToServer").label).toBe("client → server");
    expect(directionBadge("serverToClient").label).toBe("server → client");
    expect(directionBadge("both").label).toBe("client ↔ server");
  });

  it("gives each direction its own color", () => {
    const colors = new Set([
      directionBadge("clientToServer").color,
      directionBadge("serverToClient").color,
      directionBadge("both").color,
    ]);
    expect(colors.size).toBe(3);
  });
});
