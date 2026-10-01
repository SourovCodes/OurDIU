import { SlidersHorizontal } from "lucide-react";
import { Link } from "react-router";
import { DepartmentTile } from "~/components/qb-tiles";
import { buttonVariants } from "~/components/ui/button";
import { rememberedDepartment } from "~/lib/department-preference";
import { formatNumber } from "~/lib/format";
import { loadTaxonomy } from "~/lib/taxonomy.server";
import type { Route } from "./+types/questions-departments";

export const meta: Route.MetaFunction = () => [
  { title: "Browse departments — OurDIU Question Bank" },
  {
    name: "description",
    content:
      "Past exam question papers from every DIU department. Pick yours to see its courses.",
  },
];

export async function loader({ request }: Route.LoaderArgs) {
  const { departments, courses } = await loadTaxonomy(request);
  const withPapers = departments
    .filter((d) => d.publishedCount > 0)
    .sort((a, b) => b.publishedCount - a.publishedCount);
  // The visitor's own department leads, if we know it; otherwise the biggest.
  const remembered = rememberedDepartment(request.headers.get("cookie"));
  const mine = withPapers.find((d) => String(d.id) === remembered);
  const ordered = mine
    ? [mine, ...withPapers.filter((d) => d !== mine)]
    : withPapers;
  const courseCounts: Record<number, number> = {};
  for (const course of courses) {
    courseCounts[course.departmentId] =
      (courseCounts[course.departmentId] ?? 0) + 1;
  }
  return { departments: ordered, courseCounts };
}

/** "Browse": every department as a tile, like the app's Browse tab. */
export default function Departments({ loaderData }: Route.ComponentProps) {
  const { departments, courseCounts } = loaderData;
  const papers = departments.reduce((sum, d) => sum + d.publishedCount, 0);
  const [featured, ...others] = departments;

  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
        <div className="space-y-3">
          <h1 className="font-display-xl text-6xl sm:text-7xl">Browse</h1>
          <p className="text-muted-foreground">
            {departments.length} departments, {formatNumber(papers)} papers.
            Pick yours to see its courses.
          </p>
        </div>
        <Link
          to="/questions/browse"
          className={buttonVariants({ variant: "outline" })}
        >
          <SlidersHorizontal aria-hidden />
          Filter every paper instead
        </Link>
      </div>

      {featured && (
        <ul className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-4">
          <li className="col-span-2 grid">
            <DepartmentTile
              department={featured}
              courseCount={courseCounts[featured.id]}
              featured
            />
          </li>
          {others.map((department) => (
            <li key={department.id} className="grid">
              <DepartmentTile
                department={department}
                courseCount={courseCounts[department.id]}
              />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
