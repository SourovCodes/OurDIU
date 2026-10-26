import api, { type QueueJob } from "@ourdiu/api";
import { createRequestHandler } from "react-router";
import { withCacheControl } from "../app/lib/cache-control";
import { canonicalHostRedirect } from "../app/lib/redirect";

const requestHandler = createRequestHandler(
  () => import("virtual:react-router/server-build"),
  import.meta.env.MODE,
);

async function handle(request: Request, env: Env, ctx: ExecutionContext) {
  const redirect = canonicalHostRedirect(request, env.SITE_URL);
  if (redirect) return redirect;
  // The API (and Better Auth) lives under /api/* on the same origin, so session
  // cookies stay first-party and no CORS is needed. Native apps call it here too.
  if (new URL(request.url).pathname.startsWith("/api/")) {
    return api.fetch(request, env, ctx);
  }
  return requestHandler(request);
}

export default {
  async fetch(request, env, ctx) {
    return withCacheControl(request, await handle(request, env, ctx));
  },
  // Upload analysis and PDF watermarks (queue consumers in wrangler.jsonc).
  queue: api.queue,
  // "Most viewed today", every 10 minutes (triggers in wrangler.jsonc).
  scheduled: api.scheduled,
} satisfies ExportedHandler<Env, QueueJob>;
