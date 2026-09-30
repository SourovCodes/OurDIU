import { defineConfig } from "drizzle-kit";

// drizzle-kit only generates SQL here; Wrangler applies it to D1 (`pnpm db:migrate:local`).
export default defineConfig({
  dialect: "sqlite",
  schema: "./src/db/schema/index.ts",
  out: "./migrations",
  casing: "snake_case",
});
