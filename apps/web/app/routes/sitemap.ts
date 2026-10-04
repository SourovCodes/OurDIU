import type { Sitemap } from "@ourdiu/shared";
import { waitUntil } from "cloudflare:workers";
import { apiGetJson } from "~/lib/api.server";
import { sitemapXml } from "~/lib/seo";
import { routineSitemap } from "~/lib/routine.server";
import { loadTaxonomy } from "~/lib/taxonomy.server";
import type { Route } from "./+types/sitemap";

/** Crawlers fetch the sitemap often; it only needs to catch up within the hour. */
const MAX_AGE_S = 3600;

export async function loader({ request }: Route.LoaderArgs) {
  const origin = new URL(request.url).origin;
  // Cloudflare's cache in this data centre, keyed without the query string, so
  // repeat fetches skip the Worker's D1 queries until the entry expires.
  const cache = await caches.open("sitemap");
  const key = new Request(`${origin}/sitemap.xml`);
  const hit = await cache.match(key);
  if (hit) return hit;

  const [sitemap, taxonomy, routine] = await Promise.all([
    apiGetJson<Sitemap>(request, "/api/v1/sitemap"),
    loadTaxonomy(request),
    routineSitemap(request),
  ]);
  const departmentIds = taxonomy.departments
    .filter((d) => d.publishedCount > 0)
    .map((d) => d.id);
  const courseIds = taxonomy.courses
    .filter((c) => c.publishedCount > 0)
    .map((c) => c.id);
  const response = new Response(
    sitemapXml(origin, sitemap, { departmentIds, courseIds, routine }),
    {
      headers: {
        "content-type": "application/xml; charset=utf-8",
        "cache-control": `public, max-age=${MAX_AGE_S}`,
      },
    },
  );
  waitUntil(cache.put(key, response.clone()));
  return response;
}
