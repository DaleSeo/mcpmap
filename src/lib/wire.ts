// Shared wire-shape resolution: given a JSON-RPC method, find the effective
// object shape of its params or result in a version, resolving through the
// request type's `params` field whether it is inline (older versions) or a
// `$ref` to a named type (newer ones). Used by both the version differ and the
// message-flow payloads so they agree on what a message looks like on the wire.

import type { VersionArtifact } from "../pipeline/artifact.ts";
import type { MethodEntry } from "../pipeline/ir/inventory.ts";
import type { TypeNode, TypeRef } from "../pipeline/ir/types.ts";

export type Resolve = (name: string) => TypeNode | undefined;

export function resolver(artifact: VersionArtifact): Resolve {
  const index = new Map(artifact.types.map((t) => [t.name, t]));
  return (name) => index.get(name);
}

/**
 * The effective params object of a method: the `params` field of its request
 * type, resolved through a `$ref` when the version names it. `undefined` when
 * the method takes no params.
 */
export function effectiveParams(method: MethodEntry, resolve: Resolve): TypeRef | undefined {
  const request = resolve(method.typeName);
  if (!request || request.shape.kind !== "object") return undefined;
  const params = request.shape.fields.find((f) => f.name === "params");
  if (!params) return undefined;
  return params.type.kind === "ref" ? resolve(params.type.name)?.shape : params.type;
}

/** The effective result object of a request method, resolved from its result type. */
export function effectiveResult(method: MethodEntry, resolve: Resolve): TypeRef | undefined {
  if (!method.resultType) return undefined;
  return resolve(method.resultType)?.shape;
}
