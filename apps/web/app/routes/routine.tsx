import type { RoutineSection, RoutineSectionList } from "@ourdiu/shared";
import { ROUTINE_DEPARTMENT_SLUGS } from "@ourdiu/shared/constants";
import { CalendarClock, Download, Star } from "lucide-react";
import { data, Link } from "react-router";
import { ComingSoon } from "~/components/coming-soon";
import { ExamShape } from "~/components/exam-badge";
import { SectionSearch, TodayCard, useDhakaNow } from "~/components/routine";
import { apiFetch, apiGetJson, readJson } from "~/lib/api.server";
import { formatDate } from "~/lib/dates";
import { product as findProduct } from "~/lib/products";
import {
  classesFor,
  dhakaNow,
  isRoutineDepartment,
  pickLabel,
  routineHref,
  savedRoutine,
  sectionChoices,
  sectionGroup,
  sectionGroups,
  type RoutineDepartmentSlug,
} from "~/lib/routine";
import { pageMeta } from "~/lib/seo";
import { cn } from "~/lib/utils";
import type { Route } from "./+types/routine";

const product = findProduct("routine");

export const meta: Route.MetaFunction = ({ loaderData, params }) => {
  const name = loaderData?.department.toUpperCase();
  return pageMeta({
    title: params.department
      ? `DIU ${name} Class Routine — your section's classes | OurDIU`
      : "DIU Class Routine — your section's classes | OurDIU",
    description: params.department
      ? `The DIU ${name} class routine by section: today's classes, your week with lab groups, rooms and teachers, and a PDF to download.`
      : "DIU's class routines by section (CSE and EEE): today's classes, your week with lab groups, rooms and teachers, and a PDF to download.",
  });
};

/**
 * /routine and /routine/:department. Each department's live routine; /routine shows
 * the department of the visitor's saved section, else the first with a routine.
 */
export async function loader({ request, params }: Route.LoaderArgs) {
  if (
    params.department !== undefined &&
    !isRoutineDepartment(params.department)
  ) {
    throw data("Not found", { status: 404 });
  }
  const lists = await Promise.all(
    ROUTINE_DEPARTMENT_SLUGS.map(async (department) => {
      const res = await apiFetch(
        request,
        `/api/v1/routine/${department}/sections`,
      );
      // Not live yet: that department is "coming soon".
      if (res.status === 404) return { department, list: null };
      if (!res.ok) throw data("API request failed", { status: 502 });
      return { department, list: await readJson<RoutineSectionList>(res) };
    }),
  );
  const live = lists.flatMap((l) => (l.list ? [l.department] : []));
  const saved = savedRoutine(request.headers.get("cookie"));
  const department: RoutineDepartmentSlug =
    params.department ??
    (saved && live.includes(saved.department) ? saved.department : live[0]) ??
    "cse";
  const list = lists.find((l) => l.department === department)!.list;

  // "My section", with its week for the Today card. Gone from a new version, it's
  // just left out.
  const savedList =
    saved && lists.find((l) => l.department === saved.department)?.list;
  const mine =
    saved && savedList?.sections.some((s) => s.section === saved.section)
      ? {
          pick: saved,
          routine: await apiGetJson<RoutineSection>(
            request,
            `/api/v1/routine/${saved.department}/sections/${encodeURIComponent(saved.section)}`,
          ).catch(() => null),
        }
      : null;
  return {
    department,
    // Until any routine is live, the space stays "coming soon".
    anyLive: live.length > 0,
    departments: lists.map((l) => ({
      department: l.department,
      version: l.list?.version.version ?? null,
    })),
    list,
    mine: mine?.routine ? { pick: mine.pick, routine: mine.routine } : null,
    serverDay: dhakaNow().day,
  };
}

/** The departments, CSE and EEE, as links to their routines. */
function DepartmentSwitch({
  departments,
  current,
}: {
  departments: { department: RoutineDepartmentSlug; version: string | null }[];
  current: RoutineDepartmentSlug;
}) {
  return (
    <nav aria-label="Departments">
      <ul className="inline-flex gap-1 rounded-full bg-surface p-1">
        {departments.map(({ department, version }) => (
          <li key={department}>
            <Link
              to={`/routine/${department}`}
              aria-current={department === current ? "page" : undefined}
              prefetch="intent"
              preventScrollReset
              className={cn(
                "flex h-10 items-center gap-2 rounded-full px-4 text-sm font-semibold transition-colors",
                department === current
                  ? "bg-primary-container text-primary-container-foreground"
                  : "text-muted-foreground hover:state-layer",
              )}
            >
              {department.toUpperCase()}
              <span className="text-xs font-medium opacity-80">
                {version ? `v${version}` : "soon"}
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}

/** The routine's shape, large, beside the title on wide screens. */
function ShapeCluster() {
  return (
    <div aria-hidden className="relative hidden h-80 lg:block">
      <ExamShape
        kind="midterm"
        colored={false}
        className="absolute top-0 left-12 size-56 text-primary-container"
      />
      <ExamShape
        kind="final"
        colored={false}
        className="absolute top-10 right-0 size-36 rotate-12 text-primary/70"
      />
      <ExamShape
        kind="quiz"
        colored={false}
        className="absolute bottom-0 left-0 size-28 text-exam-lab"
      />
      <CalendarClock className="absolute top-24 left-32 size-20 text-primary-container-foreground" />
    </div>
  );
}

/** /routine: your section's day, or find it in your department's routine. */
export default function Routine({ loaderData }: Route.ComponentProps) {
  const now = useDhakaNow();
  const { department, anyLive, departments, list, mine, serverDay } =
    loaderData;
  if (!anyLive) return <ComingSoon product={product} />;

  const name = department.toUpperCase();
  const groups = list ? sectionGroups(list.sections.map((s) => s.section)) : [];

  return (
    <div className="space-y-16 pt-2 sm:pt-6">
      <section className="grid grid-cols-1 items-center gap-10 lg:grid-cols-[minmax(0,1.35fr)_minmax(0,1fr)]">
        <div className="space-y-7">
          <div className="flex flex-wrap items-center gap-3">
            <DepartmentSwitch departments={departments} current={department} />
            {list?.version.publishedOn && (
              <p className="text-sm text-muted-foreground">
                {name} v{list.version.version} · published{" "}
                {formatDate(list.version.publishedOn)}
              </p>
            )}
          </div>
          <div className="space-y-5">
            <h1 className="font-display-xl text-6xl sm:text-7xl xl:text-8xl">
              Your class routine.
            </h1>
            <p className="max-w-xl text-lg text-pretty text-muted-foreground">
              {list
                ? `Find your section in DIU’s ${name} routine: today’s classes, your week with rooms and teachers, and a PDF to keep.`
                : `DIU’s ${name} routine is coming soon. Until then, pick another department above.`}
            </p>
          </div>
          {list && (
            <div className="max-w-xl">
              <SectionSearch
                key={department}
                department={department}
                choices={sectionChoices(list.sections)}
                size="lg"
              />
            </div>
          )}
        </div>
        {mine ? (
          // A returning student's day comes first on phones.
          <div className="max-lg:order-first">
            <TodayCard
              classes={classesFor(mine.routine.classes, mine.pick.group)}
              section={mine.routine.section}
              today={now?.day ?? serverDay}
              now={now}
              label={`My section · ${mine.pick.department.toUpperCase()} ${pickLabel(mine.pick)}`}
              href={routineHref(mine.pick)}
            />
          </div>
        ) : (
          <ShapeCluster />
        )}
      </section>

      {list && (
        <section aria-labelledby="batches-heading" className="space-y-5">
          <h2
            id="batches-heading"
            className="font-expressive text-3xl sm:text-4xl"
          >
            Every {name} section
          </h2>
          <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {groups.map((group) => (
              <li
                key={group.key}
                className="flex flex-col gap-4 rounded-[1.75rem] bg-surface p-5"
              >
                <div className="flex items-baseline justify-between gap-3">
                  <h3 className="font-display-xl text-5xl">{group.title}</h3>
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
                          mine?.pick.department === department &&
                            mine.pick.section === section
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
      )}

      <section className="grid gap-3 md:grid-cols-2">
        <div className="relative flex flex-col items-start gap-4 overflow-hidden rounded-[1.75rem] bg-surface p-7 sm:p-9">
          <ExamShape
            kind="quiz"
            className="absolute -top-4 -right-4 size-24 rotate-12 text-exam-lab"
            colored={false}
          />
          <Star className="size-7 text-primary" aria-hidden />
          <h2 className="pr-16 font-expressive text-3xl sm:text-4xl">
            Make it yours.
          </h2>
          <p className="max-w-sm text-pretty text-muted-foreground">
            Open your section, pick your lab group and tap{" "}
            <b>Make it my section</b>. This page then opens with your day: the
            class you’re in, the next one, and where.
          </p>
        </div>
        <div className="relative flex flex-col items-start gap-4 overflow-hidden rounded-[1.75rem] bg-primary p-7 text-primary-foreground sm:p-9">
          <ExamShape
            kind="midterm"
            colored={false}
            className="absolute -right-10 -bottom-12 size-56 text-primary-foreground/15"
          />
          <Download className="relative size-7" aria-hidden />
          <h2 className="relative font-expressive text-3xl sm:text-4xl">
            A PDF for the wall.
          </h2>
          <p className="relative max-w-sm text-pretty opacity-90">
            Every section’s week is one page to download, print or send to your
            group, with the routine’s version and a code that opens the latest
            one.
          </p>
        </div>
      </section>
    </div>
  );
}
