import path from "node:path";
import { cloudflareTest, readD1Migrations } from "@cloudflare/vitest-plugin";
import { defineConfig } from "vitest/config";

export default defineConfig(async () => {
  const migrations = await readD1Migrations(
    path.join(import.meta.dirname, "migrations"),
  );

  return {
    plugins: [
      cloudflareTest({
        // The web Worker's config (bindings, vars), running just the API.
        main: "./src/index.ts",
        wrangler: { configPath: "../web/wrangler.jsonc" },
        miniflare: {
          bindings: {
            TEST_MIGRATIONS: migrations,
            BETTER_AUTH_SECRET: "test-only-secret-that-is-long-enough-1234",
            GOOGLE_CLIENT_ID: "test-google-client-id",
            GOOGLE_CLIENT_SECRET: "test-google-client-secret",
            ADMIN_EMAILS: "boss@gmail.com",
            // Never call the real AI services from tests (.dev.vars may hold keys).
            // Queued analyses then fail fast as "not configured".
            GEMINI_API_KEY: "",
            COMPRESSOR_API_KEY: "",
          },
        },
      }),
    ],
    test: {
      setupFiles: ["./test/setup.ts"],
    },
  };
});
