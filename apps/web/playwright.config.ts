import { defineConfig, devices } from "@playwright/test";

const isCI = !!process.env.CI;

export default defineConfig({
  testDir: "./e2e",
  // Signed-in sessions for the tests (sign-in is Google-only): see e2e/sessions.ts.
  globalSetup: "./e2e/global-setup.ts",
  fullyParallel: true,
  forbidOnly: isCI,
  retries: isCI ? 2 : 0,
  reporter: isCI ? [["github"], ["html", { open: "never" }]] : "list",
  use: {
    baseURL: "http://localhost:5173",
    trace: "on-first-retry",
  },
  projects: [
    { name: "chromium", use: { ...devices["Desktop Chrome"] } },
    { name: "mobile", use: { ...devices["Pixel 7"] } },
  ],
  // Local D1 must be migrated first: `pnpm db:migrate` from the repo root.
  webServer: {
    command: "pnpm --filter @ourdiu/web dev",
    url: "http://localhost:5173/api/v1/health",
    reuseExistingServer: !isCI,
  },
});
