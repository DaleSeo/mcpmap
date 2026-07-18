import { defineConfig, lazyPlugins } from "vite-plus";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import { cloudflare } from "@cloudflare/vite-plugin";
import viteReact from "@vitejs/plugin-react";

export default defineConfig({
  fmt: {
    ignorePatterns: [
      // upstream schema snapshots — kept verbatim for drift detection, never reformatted
      "src/pipeline/schemas/",
      // generated pipeline output and route tree
      "src/data/",
      "src/routeTree.gen.ts",
    ],
  },
  lint: {
    plugins: ["react", "typescript", "unicorn"],
    categories: {
      correctness: "error",
      suspicious: "warn",
    },
    rules: {
      "react/react-in-jsx-scope": "off",
      "vite-plus/prefer-vite-plus-imports": "error",
    },
    ignorePatterns: ["src/routeTree.gen.ts", "dist", ".output", "src/data"],
    options: {
      typeAware: true,
      typeCheck: true,
    },
    jsPlugins: [
      {
        name: "vite-plus",
        specifier: "vite-plus/oxlint-plugin",
      },
    ],
  },
  server: {
    port: 3000,
  },
  resolve: {
    tsconfigPaths: true,
  },
  plugins: lazyPlugins(() => [
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
  ]),
});
