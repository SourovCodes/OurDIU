import { createApp } from "./app";

const app = createApp();

// Not a Worker of its own: apps/web's Worker serves this under /api/*
// (apps/web/workers/app.ts, which also holds the wrangler config).
export default {
  fetch: app.fetch,
} satisfies ExportedHandler<Env>;
