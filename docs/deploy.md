# Deploying mcpmap

The site is a prerendered TanStack Start app deployed to **Cloudflare Workers**.
Config lives in `wrangler.jsonc` and the Cloudflare Vite plugin in `vite.config.ts`.

CI deploys automatically on push to `main` (see `.github/workflows/`). The steps
below are the one-time manual setup and the local escape hatch.

## One-time setup (manual)

These require your Cloudflare account and can't be scripted here.

1. **Authenticate wrangler locally** (only needed for manual deploys):

   ```sh
   bunx wrangler login
   ```

2. **Create an API token for CI** — Cloudflare dashboard → My Profile → API Tokens
   → Create Token → "Edit Cloudflare Workers" template. Then add it as a GitHub
   Actions secret named `CLOUDFLARE_API_TOKEN`, and add your account id as
   `CLOUDFLARE_ACCOUNT_ID`:

   ```sh
   gh secret set CLOUDFLARE_API_TOKEN --repo DaleSeo/mcpmap
   gh secret set CLOUDFLARE_ACCOUNT_ID --repo DaleSeo/mcpmap
   ```

3. **Bind the custom domain** — after the first deploy creates the `mcpmap` Worker,
   attach `mcpmap.dev` under Workers & Pages → mcpmap → Settings → Domains & Routes
   → Add custom domain. (mcpmap.dev is already on the same Cloudflare account, so
   DNS is handled automatically.)

## Manual deploy

```sh
bun run deploy   # vite build && wrangler deploy
```

## Notes

- `compatibility_date` in `wrangler.jsonc` is pinned; bump it deliberately.
- v1 prerenders every route, so the Worker mostly serves static assets. The server
  entry is wired anyway so a future dynamic route needs no migration.
