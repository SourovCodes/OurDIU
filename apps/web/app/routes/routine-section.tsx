import type { ApiError, RoutineSection } from "@ourdiu/shared";
import { routineGroupLabel } from "@ourdiu/shared/constants";
import { Download, Star } from "lucide-react";
import { useState } from "react";
import { data, Link, redirect } from "react-router";
import { PageHeader } from "~/components/page-header";
import {
  DayClasses,
  DayTabs,
  dayName,
  useDhakaNow,
  WeekGrid,
} from "~/components/routine";
import { Button, buttonVariants } from "~/components/ui/button";
import { apiFetch, readJson } from "~/lib/api.server";
import { formatDate } from "~/lib/dates";
import {
  classesFor,
  dhakaNow,
  isRoutineDepartment,
  pickLabel,
  routineHref,
  routinePdfHref,
  samePick,
  savedRoutine,
  saveRoutine,
  weekDays,
  type RoutinePick,
} from "~/lib/routine";
import { pageMeta } from "~/lib/seo";
import { cn } from "~/lib/utils";
import type { Route } from "./+types/routine-section";

export const meta: Route.MetaFunction = ({ loaderData }) => {
  if (!loaderData) return [{ title: "Section not found — OurDIU" }];
  const { routine, pick } = loaderData;
  const label = pickLabel(pick);
  return pageMeta({
    title: `${label} class routine — DIU ${routine.version.department} | OurDIU`,
    description: `The class routine of DIU ${routine.version.department} ${label}: today's classes, the week with rooms and teachers, and a PDF to download. Routine v${routine.version.version}.`,
  });
};

export async function loader({ request, params }: Route.LoaderArgs) {
  const { department, section } = params;
  if (!isRoutineDepartment(department)) {
    throw data("Not found", { status: 404 });
  }
  const res = await apiFetch(
    request,
    `/api/v1/routine/${department}/sections/${encodeURIComponent(section)}`,
  );
  if (res.status === 404) {
    const code = (await readJson<ApiError>(res).catch(() => null))?.error.code;
    throw data(code === "NO_ROUTINE" ? "No routine yet" : "Section not found", {
      status: 404,
    });
  }
  if (!res.ok) throw data("API request failed", { status: 502 });
  const routine = await readJson<RoutineSection>(res);

  const url = new URL(request.url);
  const asked = url.searchParams.get("group");
  const group = asked && routine.labGroups.includes(asked) ? asked : null;
  // One address per page: the section as printed, a lab group it has.
  if (routine.section !== section || asked !== group) {
    throw redirect(
      routineHref({ department, section: routine.section, group }),
      301,
    );
  }
  const pick: RoutinePick = { department, section: routine.section, group };
  return {
    routine,
    pick,
    saved: savedRoutine(request.headers.get("cookie")),
    // The day in Dhaka as the server sees it; the time comes after hydration.
    serverDay: dhakaNow().day,
  };
}

function GroupTabs({
  routine,
  pick,
}: {
  routine: RoutineSection;
  pick: RoutinePick;
}) {
  const tabs = [
    { group: null, label: "Both groups" },
    ...routine.labGroups.map((g) => ({
      group: g,
      label: routineGroupLabel(routine.section, g),
    })),
  ];
  return (
    <nav
      aria-label="Lab group"
      className="inline-flex overflow-hidden rounded-full border border-input"
    >
      {tabs.map((t, i) => {
        const on = t.group === pick.group;
        return (
          <Link
            key={t.label}
            to={routineHref({ ...pick, group: t.group })}
            replace
            preventScrollReset
            aria-current={on ? "page" : undefined}
            className={cn(
              "px-4 py-2 text-sm font-medium transition-colors hover:state-layer",
              i > 0 && "border-l border-input",
              on && "bg-primary-container text-primary-container-foreground",
            )}
          >
            {t.label}
          </Link>
        );
      })}
    </nav>
  );
}

function MySectionButton({
  pick,
  saved,
}: {
  pick: RoutinePick;
  saved: RoutinePick | null;
}) {
  const [mine, setMine] = useState(samePick(pick, saved));
  return (
    <Button
      variant="secondary"
      aria-pressed={mine}
      onClick={() => {
        saveRoutine(mine ? null : pick);
        setMine(!mine);
      }}
    >
      <Star className={cn(mine && "fill-current")} aria-hidden />
      {mine ? "My section" : "Make it my section"}
    </Button>
  );
}

/** /routine/cse/67_B: a section's week, with ?group=B1 for one lab group. */
export default function RoutineSectionPage({
  loaderData,
}: Route.ComponentProps) {
  const { routine, pick, saved, serverDay } = loaderData;
  const now = useDhakaNow();
  const classes = classesFor(routine.classes, pick.group);
  const days = weekDays(classes);
  const today = now?.day ?? serverDay;
  const todays = classes.filter((c) => c.day === today);
  const courses = [
    ...new Map(classes.map((c) => [c.course.code, c])).values(),
  ].map((c) => ({
    ...c.course,
    teachers: [
      ...new Set(
        classes
          .filter((x) => x.course.code === c.course.code && x.teacher)
          .map((x) => x.teacher!.name ?? x.teacher!.initials),
      ),
    ],
    count: classes.filter((x) => x.course.code === c.course.code).length,
  }));
  const batch = /^(\d+)_([A-Za-z]+)$/.exec(routine.section);
  const { version } = routine;

  return (
    <div className="space-y-8">
      <PageHeader
        breadcrumbs={[
          { label: "Class Routine", to: "/routine" },
          { label: pickLabel(pick) },
        ]}
        title={pickLabel(pick)}
        description={[
          version.department,
          batch ? `Batch ${batch[1]}, section ${batch[2]}` : null,
          pick.group ? `lab group ${pick.group}` : null,
          `${courses.length} courses`,
          `${classes.length} classes a week`,
        ]
          .filter(Boolean)
          .join(" · ")}
        actions={
          <>
            <MySectionButton key={pickLabel(pick)} pick={pick} saved={saved} />
            <a
              href={routinePdfHref(pick)}
              download
              className={buttonVariants()}
            >
              <Download aria-hidden />
              Download PDF
            </a>
          </>
        }
      />

      <div className="flex flex-wrap items-center justify-between gap-3">
        {routine.labGroups.length > 0 && (
          <GroupTabs routine={routine} pick={pick} />
        )}
        <p className="text-sm text-muted-foreground">
          {version.department} routine v{version.version}
          {version.publishedOn &&
            ` · published ${formatDate(version.publishedOn)}`}
        </p>
      </div>

      {days.includes(today) && (
        <section aria-labelledby="today" className="hidden space-y-3 md:block">
          <h2 id="today" className="font-expressive text-xl">
            Today, {dayName(today)}
          </h2>
          {todays.length ? (
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3 [&>div]:contents">
              <DayClasses
                classes={todays}
                section={routine.section}
                now={now}
              />
            </div>
          ) : (
            <p className="rounded-2xl bg-surface-low px-4 py-6 text-muted-foreground">
              No classes today.
            </p>
          )}
        </section>
      )}

      <section aria-labelledby="week" className="space-y-3">
        <h2 id="week" className="font-expressive text-xl">
          <span className="md:hidden">Your week</span>
          <span className="max-md:hidden">This week</span>
        </h2>
        <div className="max-md:hidden">
          <WeekGrid
            slots={routine.slots}
            classes={classes}
            days={days}
            today={days.includes(today) ? today : null}
          />
        </div>
        <div className="md:hidden">
          <DayTabs
            key={pickLabel(pick)}
            classes={classes}
            days={days}
            section={routine.section}
            today={days.includes(today) ? today : null}
            now={now}
          />
        </div>
      </section>

      <section aria-labelledby="courses" className="space-y-3">
        <h2 id="courses" className="font-expressive text-xl">
          Courses
        </h2>
        <ul className="grid gap-2.5 sm:grid-cols-2 lg:grid-cols-3">
          {courses.map((c) => (
            <li
              key={c.code}
              className="flex items-center gap-3 rounded-2xl bg-surface-low px-4 py-3"
            >
              <span className="rounded-lg bg-surface-highest px-2 py-1 text-xs font-bold whitespace-nowrap">
                {c.code}
              </span>
              <span className="min-w-0">
                <span className="block text-sm leading-snug font-semibold">
                  {c.title ?? c.code}
                </span>
                <span className="text-xs text-muted-foreground">
                  {[
                    c.teachers.join(", "),
                    `${c.count} class${c.count === 1 ? "" : "es"} a week`,
                  ]
                    .filter(Boolean)
                    .join(" · ")}
                </span>
              </span>
            </li>
          ))}
        </ul>
      </section>

      <p className="text-sm text-muted-foreground">
        From DIU’s published {version.department} class routine. Routines change
        during the semester; check your department’s notice board if something
        looks off.
      </p>
    </div>
  );
}
