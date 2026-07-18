import { defineConfig } from "vite";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import { cloudflare } from "@cloudflare/vite-plugin";
import viteReact from "@vitejs/plugin-react";

export default defineConfig({
  server: {
    port: 3000,
  },
  resolve: {
    tsconfigPaths: true,
  },
  plugins: [
    // Cloudflare Workers runtime target. v1 prerenders every page to static HTML,
    // so the worker is only a fallback — but keeping it wired means a future
    // dynamic route (e.g. on-demand version-pair diffs) is not a rewrite.
    cloudflare({ viteEnvironment: { name: "ssr" } }),
    tanstackStart({
      prerender: {
        enabled: true,
        crawlLinks: true,
      },
      sitemap: {
        enabled: true,
        host: "https://mcpmap.dev",
      },
    }),
    // react's vite plugin must come after start's vite plugin
    viteReact(),
  ],
});
