# Deploying mcpmap

The site is a prerendered TanStack Start app deployed to **Cloudflare Workers**.
Config lives in `wrangler.jsonc` and the Cloudflare Vite plugin in `vite.config.ts`.

Deployment runs through **GitHub Actions** (`.github/workflows/deploy.yml`): every
push to `main` runs `bun install`, `bun run build` (`vp build`, including prerender),
and `wrangler deploy`. Re-run it from the Actions tab (`workflow_dispatch`) to
redeploy without a push. History shows up under the repo's **Deployments**
(`production` environment).

## Credentials

- `production` environment secret `CLOUDFLARE_API_TOKEN`: Account API Token
  `mcpmap` (Workers Scripts Edit, Account Settings Read, `mcpmap.dev` Workers Routes
  Edit + Zone Read). The value is in 1Password `dev/CF_MCPMAP`.
- The environment only allows the `main` branch, so branch and PR workflows can't
  read the token.
- Workers Builds was disconnected on 2026-11-01: its build tokens only support user
  API tokens. Don't reconnect it, or every push deploys twice. Non-production
  preview builds were dropped with it.

The `mcpmap.dev` custom domain is bound in `wrangler.jsonc` `routes`, so deploys
serve it directly.

## Manual deploy (escape hatch)

Requires a local `bunx wrangler login` once. Useful for deploying without a push:

```sh
bun run deploy   # vp build && wrangler deploy
```

## Notes

- `compatibility_date` in `wrangler.jsonc` is pinned; bump it deliberately.
- v1 prerenders every route, so the Worker mostly serves static assets. The server
  entry is wired anyway so a future dynamic route needs no migration.
