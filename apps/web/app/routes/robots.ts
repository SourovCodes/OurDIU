import { robotsTxt } from "~/lib/seo";
import type { Route } from "./+types/robots";

export function loader({ request }: Route.LoaderArgs) {
  return new Response(robotsTxt(new URL(request.url).origin), {
    headers: {
      "content-type": "text/plain; charset=utf-8",
      "cache-control": "public, max-age=86400",
    },
  });
}
