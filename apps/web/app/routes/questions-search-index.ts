import { courseEntries } from "~/lib/courses";
import { loadTaxonomy } from "~/lib/taxonomy.server";
import type { Route } from "./+types/questions-search-index";

/**
 * Every course with its department, for the course search (`CourseSearch`), which
 * loads it when first opened. A resource route, so pages don't carry 300 courses.
 */
export async function loader({ request }: Route.LoaderArgs) {
  return Response.json(courseEntries(await loadTaxonomy(request)), {
    headers: { "cache-control": "public, max-age=60" },
  });
}
