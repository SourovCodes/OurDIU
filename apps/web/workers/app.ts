import api from "@ourdiu/api";
import { createRequestHandler } from "react-router";
import { canonicalHostRedirect } from "../app/lib/redirect";

const requestHandler = createRequestHandler(
  () => import("virtual:react-router/server-build"),
  import.meta.env.MODE,
);

export default {
  async fetch(request, env, ctx) {
    const redirect = canonicalHostRedirect(request, env.SITE_URL);
    if (redirect) return redirect;
    // The API (and Better Auth) lives under /api/* on the same origin, so session
    // cookies stay first-party and no CORS is needed. The app calls it here too.
    if (new URL(request.url).pathname.startsWith("/api/")) {
      return api.fetch(request, env, ctx);
    }
    return requestHandler(request);
  },
} satisfies ExportedHandler<Env>;
