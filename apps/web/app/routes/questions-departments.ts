import { redirect } from "react-router";
import { rememberedDepartment } from "~/lib/department-preference";
import { loadTaxonomy } from "~/lib/taxonomy.server";
import type { Route } from "./+types/questions-departments";

/**
 * "Browse": the department the visitor looked at last, otherwise the one with the
 * most papers. Each department page lists its courses and links to the others.
 */
export async function loader({ request }: Route.LoaderArgs) {
  const { departments } = await loadTaxonomy(request);
  const remembered = rememberedDepartment(request.headers.get("cookie"));
  const department =
    departments.find((d) => String(d.id) === remembered) ??
    [...departments].sort((a, b) => b.publishedCount - a.publishedCount)[0];
  if (!department) throw redirect("/questions/browse");
  throw redirect(`/questions/departments/${department.id}`);
}
