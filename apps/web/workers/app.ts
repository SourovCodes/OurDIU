import api, { type QueueJob } from "@ourdiu/api";
import { createRequestHandler } from "react-router";
import type { ServerBuild } from "react-router";
import { withCacheHeaders } from "../app/lib/cache-control";
import { canonicalHostRedirect } from "../app/lib/redirect";
import type { RouteHandle } from "../app/root";

const serverBuild = () => import("virtual:react-router/server-build");
const requestHandler = createRequestHandler(serverBuild, import.meta.env.MODE);

/** Whether a route declares its data shared (`handle.shared`, RouteHandle in root.tsx). */
function sharedRoute(build: ServerBuild) {
  return (routeId: string, url: URL) => {
    const handle = build.routes[routeId]?.module.handle as
      RouteHandle | undefined;
    const shared = handle?.shared;
    return typeof shared === "function" ? shared(url) : shared === true;
  };
}

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
    const response = await handle(request, env, ctx);
    return withCacheHeaders(
      request,
      response,
      sharedRoute(await serverBuild()),
    );
  },
  // Upload analysis and PDF watermarks (queue consumers in wrangler.jsonc).
  queue: api.queue,
  // "Most viewed today", every 10 minutes (triggers in wrangler.jsonc).
  scheduled: api.scheduled,
} satisfies ExportedHandler<Env, QueueJob>;
