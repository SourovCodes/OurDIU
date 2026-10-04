import { ArrowRight } from "lucide-react";
import { data, Link } from "react-router";
import { ComingSoon } from "~/components/coming-soon";
import { DepartmentSwitch, SectionSearch } from "~/components/routine";
import { formatDate } from "~/lib/dates";
import { product as findProduct } from "~/lib/products";
import {
  isRoutineDepartment,
  isTeacherPick,
  routineHref,
  savedRoutine,
  sectionChoices,
  sectionGroup,
  sectionGroups,
  teachersHref,
} from "~/lib/routine";
import { routineLists } from "~/lib/routine.server";
import { pageMeta } from "~/lib/seo";
import { cn } from "~/lib/utils";
import type { Route } from "./+types/routine-sections";

const product = findProduct("routine");

export const meta: Route.MetaFunction = ({ params }) => {
  const name = params.department?.toUpperCase();
  return pageMeta({
    title: `DIU ${name} Class Routine — every section | OurDIU`,
    description: `The DIU ${name} class routine by section: today's classes, your week with lab groups, rooms and teachers, and a PDF to download.`,
  });
};

/** /routine/cse: a department's sections, by batch (CSE) or level and term (EEE). */
export async function loader({ request, params }: Route.LoaderArgs) {
  const { department } = params;
  if (!isRoutineDepartment(department)) {
    throw data("Not found", { status: 404 });
  }
  const { lists, live, departments } = await routineLists(request);
  const saved = savedRoutine(request.headers.get("cookie"));
  return {
    anyLive: live.length > 0,
    department,
    departments,
    list: lists.find((l) => l.department === department)!.list,
    // "My section", highlighted among the sections.
    mine:
      saved && !isTeacherPick(saved) && saved.department === department
        ? saved.section
        : null,
  };
}

export default function RoutineSections({ loaderData }: Route.ComponentProps) {
  const { anyLive, department, departments, list, mine } = loaderData;
  if (!anyLive) return <ComingSoon product={product} />;
  const name = department.toUpperCase();
  const groups = list ? sectionGroups(list.sections.map((s) => s.section)) : [];

  return (
    <div className="space-y-10 pt-2 sm:pt-6">
      <header className="space-y-6">
        <div className="space-y-2">
          <p className="text-sm font-semibold text-muted-foreground">
            {list
              ? `DIU’s ${name} routine v${list.version.version}${
                  list.version.publishedOn
                    ? ` · published ${formatDate(list.version.publishedOn)}`
                    : ""
                }`
              : `DIU’s ${name} routine`}
          </p>
          <h1 className="font-display-xl text-5xl sm:text-7xl">Students</h1>
        </div>
        <div className="flex flex-col gap-3 md:flex-row md:items-center">
          <DepartmentSwitch
            departments={departments}
            current={department}
            hrefFor={(d) => `/routine/${d}`}
          />
          {list && (
            <div className="min-w-0 md:max-w-xl md:flex-1">
              <SectionSearch
                key={department}
                department={department}
                choices={sectionChoices(list.sections)}
              />
            </div>
          )}
        </div>
        {list && (
          <p className="text-sm text-muted-foreground">
            Looking for a teacher’s week?{" "}
            <Link
              to={teachersHref(department)}
              className="inline-flex items-center gap-1 font-semibold text-primary underline-offset-4 hover:underline"
            >
              {name} teachers
              <ArrowRight className="size-3.5" aria-hidden />
            </Link>
          </p>
        )}
      </header>

      {list ? (
        <section aria-label={`Every ${name} section`}>
          <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {groups.map((group) => (
              <li
                key={group.key}
                className="flex flex-col gap-4 rounded-[1.75rem] bg-surface p-5"
              >
                <div className="flex items-baseline justify-between gap-3">
                  <h2 className="font-display-xl text-5xl">{group.title}</h2>
                  <span className="text-sm text-muted-foreground first-letter:uppercase">
                    {group.name ?? "and others"} · {group.sections.length}{" "}
                    section{group.sections.length === 1 ? "" : "s"}
                  </span>
                </div>
                <ul className="flex flex-wrap gap-1.5">
                  {group.sections.map((section) => (
                    <li key={section}>
                      <Link
                        to={routineHref({ department, section, group: null })}
                        prefetch="intent"
                        className={cn(
                          "inline-flex h-10 items-center rounded-xl border px-3.5 text-sm font-semibold transition-colors",
                          mine === section
                            ? "border-primary-container bg-primary-container text-primary-container-foreground"
                            : "border-input bg-background hover:state-layer",
                        )}
                      >
                        {group.name
                          ? (sectionGroup(section)?.letter ?? section)
                          : section}
                        <span className="sr-only"> ({section})</span>
                      </Link>
                    </li>
                  ))}
                </ul>
              </li>
            ))}
          </ul>
        </section>
      ) : (
        <p className="rounded-[1.75rem] bg-surface px-6 py-10 text-center text-muted-foreground">
          <span className="block font-expressive text-2xl text-foreground">
            DIU’s {name} routine is coming soon
          </span>
          Until then, pick another department above.
        </p>
      )}
    </div>
  );
}
