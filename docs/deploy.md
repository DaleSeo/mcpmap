# Deploying mcpmap

The site is a prerendered TanStack Start app deployed to **Cloudflare Workers**.
Config lives in `wrangler.jsonc` and the Cloudflare Vite plugin in `vite.config.ts`.

Deployment runs through **[Cloudflare Workers Builds](https://developers.cloudflare.com/workers/ci-cd/builds/)**:
Cloudflare watches this repo and builds + deploys on every push to `main`. No
GitHub secrets or API tokens to manage — Cloudflare owns the account auth.

## One-time setup (dashboard)

Workers Builds is connected in the dashboard; there is no wrangler/CLI command
for the Git link (it needs the GitHub OAuth authorization).

1. Cloudflare dashboard → **Workers & Pages** → the `mcpmap` Worker → **Settings**
   → **Builds** → **Connect**. The Worker name must match `name` in `wrangler.jsonc`
   (`mcpmap`).
2. Configure the build:
   - **Repository**: `DaleSeo/mcpmap`, **production branch**: `main`
   - **Build command**: `bun run build` (runs `vp build`, including prerender)
   - **Deploy command**: `bunx wrangler deploy` (default `npx wrangler deploy` also
     works; Workers Builds uses the wrangler version pinned in `package.json`)
   - **Root directory**: empty
3. Push to `main` to trigger the first build. `bun.lock` makes Cloudflare use bun
   automatically; `vp` resolves from `node_modules/.bin`.

The `mcpmap.dev` custom domain is already bound (see `wrangler.jsonc` `routes`), so
deploys serve it directly.

## Manual deploy (escape hatch)

Requires a local `bunx wrangler login` once. Useful for deploying without a push:

```sh
bun run deploy   # vp build && wrangler deploy
```

## Notes

- `compatibility_date` in `wrangler.jsonc` is pinned; bump it deliberately.
- v1 prerenders every route, so the Worker mostly serves static assets. The server
  entry is wired anyway so a future dynamic route needs no migration.
- Non-production branches get preview URLs if "non-production branch builds" is
  enabled in the Workers Builds settings.
