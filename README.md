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

Everything is generated from the official
[MCP schema files](https://github.com/modelcontextprotocol/modelcontextprotocol/tree/main/schema)
at build time — never hand-drawn — so it cannot drift from the spec.

> 🚧 **Status: early development.** Watch the
> [milestones](https://github.com/DaleSeo/mcpmap/milestones) for progress.

mcpmap is an unofficial community project and is not affiliated with the Model
Context Protocol project or Anthropic.

## License

[MIT](LICENSE)
