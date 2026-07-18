import { defineConfig } from "vite-plus";

// Standalone test config so Vitest does not load the app's vite.config.ts (whose
// Cloudflare Worker plugin conflicts with Vitest's SSR environment). The pipeline
// tests are plain Node/TypeScript and need no framework plugins.
export default defineConfig({
  test: {
    include: ["src/**/*.test.ts"],
    environment: "node",
  },
});
