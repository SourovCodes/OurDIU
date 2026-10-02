// The e2e server runs beside `pnpm dev`: on its own port, with its own local D1 and
// R2, which `e2e/prepare-state.mjs` recreates (migrated and seeded) on every run.
export const E2E_PORT = 5174;
export const E2E_ORIGIN = `http://localhost:${E2E_PORT}`;
/** The e2e server's local state, relative to apps/web (`pnpm dev` uses `.wrangler/state`). */
export const E2E_STATE = ".wrangler/e2e-state";
