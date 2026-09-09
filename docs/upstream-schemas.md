# Upstream schema tracking

The `Track upstream schemas` workflow checks the official MCP repository every
Monday at 09:23 UTC. It can also be run from the Actions tab with **Run workflow**.
The workflow must be merged into `main` before scheduled runs begin.

In repository **Settings → Actions → General → Workflow permissions**, enable
**Allow GitHub Actions to create and approve pull requests**. The workflow uses
the built-in `GITHUB_TOKEN`; no personal token is needed.

Schema contents and the discovered version list determine whether an update is
needed. Changes to upstream commits or fetch timestamps alone do not produce a
PR. When schemas change, the workflow rebuilds bundles, updates the pipeline's
IR snapshots, and runs formatting, lint, build, typecheck, and tests. A failed
regeneration or validation fails the workflow for investigation.

Successful updates create or refresh a single draft PR on `bot/upstream-schemas`.
Review new versions, feature-area mappings, flow coverage, and snapshot changes.
Mark the PR ready for review to trigger CI: PR creation with the built-in token
does not trigger another workflow. Subsequent bot updates return the PR to draft.
Merging is always manual.

To reproduce an update locally:

```sh
bun run pipeline:fetch
bun run pipeline:build
bun run test -- src/pipeline/pipeline.test.ts --update
bun run format
bun run build
bun run typecheck
bun run test
```
