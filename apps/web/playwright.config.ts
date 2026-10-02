import { existsSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { defineConfig, devices } from "@playwright/test";
import { E2E_ORIGIN, E2E_STATE } from "./e2e/env";

const isCI = !!process.env.CI;

// The tests' dev server never calls the paid AI services: it reads
// `.dev.vars.e2e`, a copy of `.dev.vars` without their keys (CLOUDFLARE_ENV=e2e
// below; wrangler then warns that wrangler.jsonc has no "e2e" environment, which is
// harmless). Uploads' analyses and watermarks then fail as "not configured". It
// runs beside `pnpm dev`, on its own port and local D1/R2 (e2e/env.ts).
const AI_KEYS = ["GEMINI_API_KEY", "COMPRESSOR_API_KEY"];
const devVars = path.join(import.meta.dirname, ".dev.vars");
if (existsSync(devVars)) {
  const kept = readFileSync(devVars, "utf8")
    .split("\n")
    .filter((line) => !AI_KEYS.some((key) => line.startsWith(`${key}=`)));
  const content = [
    ...kept.filter((line) => !line.startsWith("SITE_URL=")),
    ...AI_KEYS.map((key) => `${key}=`),
    `SITE_URL=${E2E_ORIGIN}`,
  ].join("\n");
  const e2eVars = `${devVars}.e2e`;
  // Every test worker loads this file; rewriting it would restart the dev server.
  if (!existsSync(e2eVars) || readFileSync(e2eVars, "utf8") !== content) {
    writeFileSync(e2eVars, content);
  }
}

export default defineConfig({
  testDir: "./e2e",
  // Signed-in sessions for the tests (sign-in is Google-only): see e2e/sessions.ts.
  globalSetup: "./e2e/global-setup.ts",
  fullyParallel: true,
  forbidOnly: isCI,
  retries: isCI ? 2 : 0,
  reporter: isCI ? [["github"], ["html", { open: "never" }]] : "list",
  use: {
    baseURL: E2E_ORIGIN,
    trace: "on-first-retry",
  },
  projects: [
    { name: "chromium", use: { ...devices["Desktop Chrome"] } },
    { name: "mobile", use: { ...devices["Pixel 7"] } },
  ],
  // Always its own server, never a running `pnpm dev` (which has the AI keys), with
  // fresh local state: migrated and seeded first by e2e/prepare-state.mjs.
  webServer: {
    command: `node e2e/prepare-state.mjs ${E2E_STATE} && pnpm --filter @ourdiu/web dev`,
    url: `${E2E_ORIGIN}/api/v1/health`,
    env: { CLOUDFLARE_ENV: "e2e" },
    reuseExistingServer: false,
  },
});
