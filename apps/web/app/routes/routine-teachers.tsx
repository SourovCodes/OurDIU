import type { RoutineTeacherList } from "@ourdiu/shared";
import { Search, SearchX } from "lucide-react";
import { useId, useState } from "react";
import { data, Form, Link, redirect, useNavigate } from "react-router";
import { ComingSoon } from "~/components/coming-soon";
import { DepartmentSwitch } from "~/components/routine";
import { apiFetch, readJson } from "~/lib/api.server";
import { product as findProduct } from "~/lib/products";
import {
  exactTeacher,
  isRoutineDepartment,
  isTeacherPick,
  matchTeachers,
  savedRoutine,
  teacherHref,
  teacherName,
  teachersHref,
} from "~/lib/routine";
import { routineLists } from "~/lib/routine.server";
import { pageMeta } from "~/lib/seo";
import { cn } from "~/lib/utils";
import type { Route } from "./+types/routine-teachers";

const product = findProduct("routine");

export const meta: Route.MetaFunction = ({ params }) => {
  const name = params.department?.toUpperCase();
  return pageMeta({
    title: `DIU ${name} teachers' class routines | OurDIU`,
    description: `Every teacher in DIU's ${name} class routine, by initials or name: their week with rooms and sections, and a PDF to download.`,
  });
};

/** /routine/cse/teachers: a department's teachers, to find one's week. */
export async function loader({ request, params }: Route.LoaderArgs) {
  const { department } = params;
  if (!isRoutineDepartment(department)) {
    throw data("Not found", { status: 404 });
  }
  const { live, departments } = await routineLists(request);
  let teachers: RoutineTeacherList | null = null;
  if (live.includes(department)) {
    const res = await apiFetch(
      request,
      `/api/v1/routine/${department}/teachers`,
    );
    if (!res.ok) throw data("API request failed", { status: 502 });
    teachers = await readJson<RoutineTeacherList>(res);
  }
  // The search as a plain form (before the page is interactive): initials as
  // printed open that teacher's week, anything else filters the list.
  const q = new URL(request.url).searchParams.get("q")?.trim() ?? "";
  const exact = q && teachers ? exactTeacher(teachers.teachers, q) : null;
  if (exact) {
    throw redirect(teacherHref({ department, teacher: exact.initials }));
  }
  const saved = savedRoutine(request.headers.get("cookie"));
  return {
    q,
    anyLive: live.length > 0,
    department,
    departments,
    teachers,
    // "My routine", highlighted in the list.
    mine:
      saved && isTeacherPick(saved) && saved.department === department
        ? saved.teacher
        : null,
  };
}

export default function RoutineTeachers({ loaderData }: Route.ComponentProps) {
  const { anyLive, department, departments, teachers, mine, q } = loaderData;
  const navigate = useNavigate();
  const id = useId();
  const [query, setQuery] = useState(q);
  if (!anyLive) return <ComingSoon product={product} />;
  const name = department.toUpperCase();
  const all = teachers?.teachers ?? [];
  const shown = query.trim() ? matchTeachers(all, query, all.length) : all;
  const named = all.filter((t) => t.name).length;

  return (
    <div className="space-y-10 pt-2 sm:pt-6">
      <header className="space-y-6">
        <h1 className="font-display-xl text-5xl sm:text-7xl">Teachers</h1>
        <div className="flex flex-col gap-3 md:flex-row md:items-center">
          <DepartmentSwitch
            departments={departments}
            current={department}
            hrefFor={teachersHref}
          />
          {teachers && (
            <Form
              role="search"
              className="min-w-0 md:max-w-xl md:flex-1"
              onSubmit={(event) => {
                event.preventDefault();
                const pick = exactTeacher(all, query) ?? shown[0];
                if (pick) {
                  navigate(teacherHref({ department, teacher: pick.initials }));
                }
              }}
            >
              <label htmlFor={`${id}-q`} className="sr-only">
                Find a teacher by initials or name
              </label>
              <div className="flex h-14 items-center gap-3 rounded-full bg-surface px-5 focus-within:ring-[3px] focus-within:ring-ring/50">
                <Search
                  className="size-5 shrink-0 text-muted-foreground"
                  aria-hidden
                />
                <input
                  id={`${id}-q`}
                  type="search"
                  name="q"
                  autoComplete="off"
                  spellCheck={false}
                  placeholder={`Initials${named ? " or name" : ""}, e.g. ${all[0]?.initials ?? "STA"}`}
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  className="h-full min-w-0 flex-1 bg-transparent text-base outline-none placeholder:text-muted-foreground sm:text-lg"
                />
              </div>
            </Form>
          )}
        </div>
      </header>

      {!teachers ? (
        <p className="rounded-[1.75rem] bg-surface px-6 py-10 text-center text-muted-foreground">
          <span className="block font-expressive text-2xl text-foreground">
            DIU’s {name} routine is coming soon
          </span>
          Until then, pick another department above.
        </p>
      ) : shown.length === 0 ? (
        <div className="grid justify-items-center gap-2 rounded-[1.75rem] bg-surface px-6 py-10 text-center text-muted-foreground">
          <SearchX className="size-8" aria-hidden />
          <p>
            <span className="block font-semibold text-foreground">
              No {name} teacher matches “{query}”
            </span>
            Try their initials as the routine prints them, like{" "}
            {all[0]?.initials}.
          </p>
        </div>
      ) : (
        <section aria-label={`${name} teachers`} className="space-y-3">
          <p className="text-sm text-muted-foreground" aria-live="polite">
            {query.trim()
              ? `${shown.length} of ${all.length} teachers`
              : `${all.length} teachers, by initials`}
          </p>
          <ul className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {shown.map((t) => (
              <li key={t.initials}>
                <Link
                  to={teacherHref({ department, teacher: t.initials })}
                  prefetch="intent"
                  className={cn(
                    "flex items-center rounded-2xl bg-surface px-4 py-3 transition-colors hover:state-layer",
                    mine === t.initials &&
                      "bg-primary-container text-primary-container-foreground",
                  )}
                >
                  <span className="grid min-w-0">
                    <span className="truncate font-semibold">
                      {teacherName(t)}
                      {mine === t.initials && (
                        <span className="text-xs font-medium">
                          {" "}
                          · My routine
                        </span>
                      )}
                    </span>
                    <span className="truncate text-sm opacity-75">
                      {[t.name ? t.initials : null, t.courses.join(", ")]
                        .filter(Boolean)
                        .join(" · ")}
                    </span>
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
