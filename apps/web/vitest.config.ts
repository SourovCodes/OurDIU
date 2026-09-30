import { defineConfig } from "vitest/config";

// Unit/component tests run in happy-dom without the Cloudflare/React Router plugins.
// Full-stack behaviour is covered by Playwright (e2e/).
export default defineConfig({
  resolve: {
    tsconfigPaths: true,
  },
  test: {
    environment: "happy-dom",
    include: ["app/**/*.test.{ts,tsx}"],
  },
});
