import { Search, SlidersHorizontal } from "lucide-react";
import { Link } from "react-router";
import { CourseSearchTrigger } from "~/components/course-search";
import { DepartmentTile } from "~/components/qb-tiles";
import { buttonVariants } from "~/components/ui/button";
import { rememberedDepartment } from "~/lib/department-preference";
import { formatNumber } from "~/lib/format";
import { loadTaxonomy } from "~/lib/taxonomy.server";
import { cn } from "~/lib/utils";
import type { Route } from "./+types/questions-departments";
import { pageMeta, QB_NAME } from "~/lib/seo";

export const meta: Route.MetaFunction = () =>
  pageMeta({
    title: `Departments — ${QB_NAME} (CSE, SWE, EEE and more)`,
    description:
      "Past exam question papers from every department of Daffodil International University (DIU). Pick yours to see its courses.",
  });

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
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <CourseSearchTrigger className="flex h-12 items-center gap-3 rounded-full bg-surface pr-5 pl-4 text-muted-foreground transition-colors hover:state-layer focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-none sm:w-72">
            <Search className="size-5 shrink-0" aria-hidden />
            <span className="truncate">Know the course? Search it</span>
          </CourseSearchTrigger>
          <Link
            to="/questions/browse"
            className={cn(
              buttonVariants({ variant: "ghost" }),
              "h-12 text-primary max-sm:self-start",
            )}
          >
            <SlidersHorizontal aria-hidden />
            Filter every paper
          </Link>
        </div>
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
