# Concept simulations

`/sims` compares sticky sessions and stateless round-robin routing under the same
seeded workload. The homepage links to it. It starts paused, supports stepping and
scrubbing, and resets when a parameter changes.

The pure TypeScript engine lives in `src/lib/simulation.ts`. It has no React,
browser, or wall-clock dependency:

```ts
const state = simulate(42, DEFAULT_PARAMS, 150); // exactly 15 seconds
const next = stepSimulation(state); // a new state, 100 ms later
```

The seed, parameters, and tick completely determine the result. The React route
uses requestAnimationFrame to advance fixed ticks; background tabs pause the
playback clock. Runs stop at 600 ticks (60 seconds), bounding history and replay
cost. Future video renderers can map frames to ticks with
`Math.floor(frame * 1000 / fps / TICK_MS)` and call `simulate`; no MP4 export or
Remotion dependency is included yet.

Each request has unit cost. Arrivals join unbounded queues before each server
processes up to its per-tick capacity. Client 1 receives the chosen traffic share;
the remaining traffic is assigned to other clients by a deterministic hash.
Sticky routing maps a client's zero-based index modulo the number of servers.
Round-robin maps a request's index modulo the number of servers. Neither pool
drops requests, so completed plus queued always equals arrivals.

This is an illustrative queue model, not an MCP benchmark. It excludes latency,
connection overhead, shared-storage costs, caching, failures, and migration.
Stateless routing assumes every server can process every request. A hot client
can bottleneck one sticky server while other servers have spare capacity; when
there is only one server, the strategies behave identically.

Run `bun run test -- src/lib/simulation.test.ts` for deterministic replay,
request conservation, server capacity, bottleneck, and boundary tests.
