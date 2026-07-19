# Launch checklist (#24)

Ready-to-use content for launch. The code side of the site is done; the items
below are the human/dashboard actions that can't be scripted from here.

## Before announcing

- [ ] **Enable Cloudflare Web Analytics.** For `mcpmap.dev` (a Worker on a
      Cloudflare-proxied domain) this can be turned on from the dashboard with no
      code change: **Analytics & Logs → Web Analytics → Add a site → mcpmap.dev**.
      If you prefer the beacon route instead, add the `cloudflareinsights.com`
      beacon script to `src/routes/__root.tsx` with the token from that page.
- [ ] Smoke-test the four pillars on prod: `/explore`, `/diff`, `/flows`, `/auth`.
- [ ] Confirm the footer's unofficial-status note is visible on the homepage.

## Announcements

### rust-sdk discussions

> **mcpmap — a schema-generated visual map of the MCP spec**
>
> I built [mcpmap.dev](https://mcpmap.dev): an interactive type explorer, message-flow
> diagrams, a version diff with directional breaking-change analysis, and an
> authorization step-through — all generated from the official `schema.json`, so they
> can't drift from the spec. Feedback from SDK implementers especially welcome; the
> version-diff "what breaks for a client vs a server" view came directly from
> thinking about SDK maintenance.

### MCP Discord

> Made a thing: **mcpmap.dev** — visual, interactive map of the MCP spec generated
> from the schema (type graph, message flows with typed payloads, version diff with
> breaking-change classification, OAuth step-through). Unofficial. Would love notes on
> what's confusing or missing.

### Blog / socials

Angle: "The MCP spec is big and moves fast. I generated an interactive map from the
schema so it can never drift — and used it to understand the 2026-07-28 overhaul
(stateless core, `initialize` removed, roots/sampling deprecated)." Link the diff
view for the `2025-11-25 → draft` boundary as the hook.

## Upstreaming (spec-repo discussion)

Open a discussion on `modelcontextprotocol/modelcontextprotocol` offering the
schema-validated diagram pipeline upstream:

> **Offer: schema-derived, drift-proof diagrams for the spec docs**
>
> The spec's hand-written mermaid diagrams have drifted before (e.g. PR #2765 fixed a
> diagram using a non-existent `tool/call` method). I've built a pipeline that derives
> message-flow diagrams and type maps directly from `schema.json` and fails CI if a
> flow references a method or type absent from the target version's IR. Happy to
> contribute this (or just the validation gate) upstream if there's interest — it would
> make the "diagram references a real method" property mechanical rather than manual.

## After launch

- [ ] Watch Web Analytics for the first traffic; note which pillar draws the most.
- [ ] File follow-ups from feedback as GitHub issues.
