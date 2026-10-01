import { ChevronRight, ListFilter, SearchX } from "lucide-react";
import { useMemo, useState } from "react";
import { data, Link } from "react-router";
import { courseHref } from "~/components/course-search";
import { EmptyState } from "~/components/empty-state";
import { Breadcrumbs } from "~/components/page-header";
import { byInitial, courseEntries, searchCourses } from "~/lib/courses";
import { rememberDepartmentCookie } from "~/lib/department-preference";
import { formatNumber } from "~/lib/format";
import { plural } from "~/lib/submissions";
import { loadTaxonomy } from "~/lib/taxonomy.server";
import { cn } from "~/lib/utils";
import type { Route } from "./+types/questions-department";

export async function loader({ request, params }: Route.LoaderArgs) {
  const taxonomy = await loadTaxonomy(request);
  const department = taxonomy.departments.find(
    (d) => String(d.id) === params.id,
  );
  if (!department) throw data("Department not found", { status: 404 });
  // "Browse" opens on it next time, and so do the question lists.
  const remember = {
    headers: { "set-cookie": rememberDepartmentCookie(String(department.id)) },
  };
  return data(
    {
      department,
      // Most papers first, as on the Question Bank's home.
      departments: [...taxonomy.departments]
        .filter((d) => d.publishedCount > 0 || d.id === department.id)
        .sort((a, b) => b.publishedCount - a.publishedCount),
      courses: courseEntries(taxonomy).filter(
        (c) => c.departmentId === department.id,
      ),
    },
    remember,
  );
}

export const meta: Route.MetaFunction = ({ loaderData }) => {
  if (!loaderData) return [{ title: "Department not found — OurDIU" }];
  const { department, courses } = loaderData;
  return [
    {
      title: `${department.name} (${department.shortName}) past papers — OurDIU Question Bank`,
    },
    {
      name: "description",
      content: `Past exam question papers for ${courses.length} ${department.shortName} courses at DIU, free to read and download.`,
    },
  ];
};

export default function Department({ loaderData }: Route.ComponentProps) {
  const { department, departments, courses } = loaderData;
  const [filter, setFilter] = useState("");
  const shown = useMemo(
    () => (filter.trim() ? searchCourses(courses, filter) : courses),
    [courses, filter],
  );
  const groups = useMemo(() => byInitial(shown), [shown]);
  const withPapers = courses.filter((c) => c.publishedCount > 0).length;

  return (
    <div className="space-y-7">
      <Breadcrumbs
        crumbs={[
          { label: "Questions", to: "/questions" },
          { label: "Browse", to: "/questions/departments" },
          { label: department.shortName },
        ]}
      />

      <nav aria-label="Departments" className="flex flex-wrap gap-2">
        {departments.map((d) => (
          <Link
            key={d.id}
            to={`/questions/departments/${d.id}`}
            title={d.name}
            aria-current={d.id === department.id ? "page" : undefined}
            className={cn(
              "flex h-9 items-center rounded-xl border px-3.5 text-sm font-semibold transition-colors",
              d.id === department.id
                ? "border-primary-container bg-primary-container text-primary-container-foreground"
                : "border-input hover:bg-accent",
            )}
          >
            {d.shortName}
          </Link>
        ))}
      </nav>

      <div className="flex flex-col gap-5 md:flex-row md:items-end md:justify-between">
        <div className="space-y-3">
          <h1 className="font-display-xl text-4xl text-balance sm:text-6xl">
            {department.name}
          </h1>
          <p className="text-muted-foreground">
            {plural(department.publishedCount, "paper")} across{" "}
            {plural(withPapers, "course")}
            {withPapers < courses.length &&
              ` (${formatNumber(courses.length - withPapers)} more without papers yet)`}
          </p>
        </div>
        <label className="flex h-11 w-full shrink-0 items-center gap-2.5 rounded-full bg-surface px-4 text-muted-foreground focus-within:ring-[3px] focus-within:ring-ring/50 md:w-80">
          <ListFilter className="size-4 shrink-0" aria-hidden />
          <span className="sr-only">Filter courses</span>
          <input
            type="search"
            value={filter}
            onChange={(event) => setFilter(event.target.value)}
            placeholder={`Filter ${formatNumber(courses.length)} courses`}
            className="h-full flex-1 bg-transparent text-[0.9375rem] text-foreground outline-hidden placeholder:text-muted-foreground"
          />
        </label>
      </div>

      {groups.length === 0 ? (
        <EmptyState
          icon={SearchX}
          title="No course matches"
          description={
            filter.trim()
              ? `No ${department.shortName} course has every word of “${filter.trim()}”.`
              : `${department.shortName} has no courses yet.`
          }
        />
      ) : (
        <div className="columns-1 gap-5 sm:columns-2 lg:columns-3">
          {groups.map(({ letter, courses: list }) => (
            <section
              key={letter}
              aria-labelledby={`letter-${letter}`}
              className="mb-5 break-inside-avoid rounded-3xl bg-surface px-2 pt-4 pb-2"
            >
              <h2
                id={`letter-${letter}`}
                className="mb-1 px-3 font-expressive text-3xl text-primary"
              >
                {letter}
              </h2>
              <ul>
                {list.map((course) => (
                  <li key={course.id}>
                    <Link
                      to={courseHref(course.id)}
                      prefetch="intent"
                      className={cn(
                        "flex min-h-11 items-center justify-between gap-3 rounded-xl px-3 py-2 text-[0.9375rem] transition-colors hover:bg-surface-high active:bg-surface-high",
                        course.publishedCount === 0 && "text-muted-foreground",
                      )}
                    >
                      <span className="min-w-0">{course.name}</span>
                      <span className="flex shrink-0 items-center gap-1.5 text-sm text-muted-foreground tabular-nums">
                        {course.publishedCount > 0 ? (
                          <>
                            {formatNumber(course.publishedCount)}
                            <span className="sr-only">
                              {course.publishedCount === 1 ? "paper" : "papers"}
                            </span>
                          </>
                        ) : (
                          <span className="text-xs">No papers yet</span>
                        )}
                        <ChevronRight className="size-4" aria-hidden />
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}
