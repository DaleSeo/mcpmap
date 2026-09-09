# mcpmap

**A visual map of the Model Context Protocol spec.**

The MCP specification is text-heavy, and its schema — one directory per protocol
version, six versions and counting — is hard to hold in your head. mcpmap renders
it visually and interactively:

- **Type explorer** — an interactive graph of protocol types per version, clustered
  by feature area, with request/response pairing and deep links to every type
- **Version diff** — structural, wire-level diffs between any two protocol versions,
  with breaking changes classified separately for client and server implementers
- **Message flows** — sequence diagrams generated from the schema itself (validated
  at build time, so they can't drift), with clickable per-step payloads
- **Auth flow explorer** — the full OAuth dance as an interactive step-through,
  with a version-by-version evolution matrix
- **Concept simulations** — a seeded, replayable comparison of sticky sessions
  and stateless round-robin routing with live queues and throughput

The protocol views are generated from the official
[MCP schema files](https://github.com/modelcontextprotocol/modelcontextprotocol/tree/main/schema)
at build time — never hand-drawn — so it cannot drift from the spec.

The [concept simulation](docs/simulations.md) is an illustrative model with
explicit assumptions, not measured MCP performance.

> 🚧 **Status: early development.** Watch the
> [milestones](https://github.com/DaleSeo/mcpmap/milestones) for progress.

mcpmap is an unofficial community project and is not affiliated with the Model
Context Protocol project or Anthropic.

Schema updates are checked weekly and proposed as manually reviewed PRs.
See [upstream schema tracking](docs/upstream-schemas.md) for setup and local commands.

## License

[MIT](LICENSE)
