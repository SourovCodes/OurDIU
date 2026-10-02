import { MOVE_DATE, MOVE_FAQ, MOVE_PATH } from "~/lib/move";
import { llmsTxt } from "~/lib/seo";
import { loadTaxonomy } from "~/lib/taxonomy.server";
import type { Route } from "./+types/llms";

export async function loader({ request }: Route.LoaderArgs) {
  const taxonomy = await loadTaxonomy(request);
  const body = llmsTxt(new URL(request.url).origin, taxonomy, {
    path: MOVE_PATH,
    date: MOVE_DATE,
    faq: MOVE_FAQ,
  });
  return new Response(body, {
    headers: {
      "content-type": "text/markdown; charset=utf-8",
      "cache-control": "public, max-age=3600",
    },
  });
}
