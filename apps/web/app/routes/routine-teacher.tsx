import type {
  ApiError,
  RoutineTeacherList,
  RoutineTeacherWeek,
} from "@ourdiu/shared";
import { Download, SearchX } from "lucide-react";
import { data, Link, redirect } from "react-router";
import { EmptyState } from "~/components/empty-state";
import { Breadcrumbs } from "~/components/page-header";
import {
  DayTabs,
  MyRoutineButton,
  RoutineLinks,
  TeacherContact,
  TeacherCourseList,
  useDhakaNow,
  WeekGrid,
} from "~/components/routine";
import { ShareButton } from "~/components/share-button";
import { buttonVariants } from "~/components/ui/button";
import { apiFetch, apiGetJson, readJson } from "~/lib/api.server";
import { formatDate } from "~/lib/dates";
import {
  dhakaNow,
  isRoutineDepartment,
  matchTeachers,
  savedRoutine,
  teacherClass,
  teacherHref,
  teacherName,
  teacherPdfHref,
  teachersHref,
  weekDates,
  weekDays,
  type TeacherPick,
} from "~/lib/routine";
import { pageMeta } from "~/lib/seo";
import type { Route } from "./+types/routine-teacher";

export const meta: Route.MetaFunction = ({ loaderData }) => {
  if (!loaderData || loaderData.kind === "missing") {
    return [
      { title: "Teacher not found — DIU Class Routine | OurDIU" },
      { name: "robots", content: "noindex" },
    ];
  }
  const { week } = loaderData;
  const { department, version } = week.version;
  const who = week.teacher.name
    ? `${week.teacher.name} (${week.teacher.initials})`
    : week.teacher.initials;
  return pageMeta({
    title: `${who} class routine — DIU ${department} | OurDIU`,
    description: `The week of DIU ${department} teacher ${who}: today's classes, every class with its sections and rooms, and a PDF to download. Routine v${version}.`,
  });
};

export async function loader({ request, params }: Route.LoaderArgs) {
  const { department, initials } = params;
  if (!isRoutineDepartment(department)) {
    throw data("Not found", { status: 404 });
  }
  const res = await apiFetch(
    request,
    `/api/v1/routine/${department}/teachers/${encodeURIComponent(initials)}`,
  );
  if (res.status === 404 || res.status === 422) {
    const code = (await readJson<ApiError>(res).catch(() => null))?.error.code;
    if (code === "NO_ROUTINE") throw redirect(`/routine/${department}`);
    // Not a teacher in the routine: the search, and teachers like it.
    const teachers = await apiGetJson<RoutineTeacherList>(
      request,
      `/api/v1/routine/${department}/teachers`,
    );
    return data(
      {
        kind: "missing" as const,
        department,
        asked: initials,
        teachers: teachers.teachers,
        version: teachers.version,
      },
      { status: 404 },
    );
  }
  if (!res.ok) throw data("API request failed", { status: 502 });
  const week = await readJson<RoutineTeacherWeek>(res);
  // One address per teacher: the initials as printed ("sta" → STA).
  if (week.teacher.initials !== initials) {
    throw redirect(
      teacherHref({ department, teacher: week.teacher.initials }),
      301,
    );
  }
  const pick: TeacherPick = { department, teacher: week.teacher.initials };
  return {
    kind: "teacher" as const,
    week,
    pick,
    saved: savedRoutine(request.headers.get("cookie")),
    serverDay: dhakaNow().day,
    serverMinute: Math.floor(Date.now() / 60_000),
    dates: weekDates(),
  };
}

type Missing = Extract<Route.ComponentProps["loaderData"], { kind: "missing" }>;

/** Initials that aren't in the routine: the search, and teachers like them. */
function MissingTeacher({ department, asked, teachers, version }: Missing) {
  const alike = [
    ...matchTeachers(teachers, asked, 6),
    ...matchTeachers(teachers, asked.slice(0, 2), 6),
  ]
    .filter(
      (t, i, all) => all.findIndex((x) => x.initials === t.initials) === i,
    )
    .slice(0, 6);
  return (
    <div className="mx-auto max-w-2xl space-y-6 pt-4">
      <EmptyState
        icon={SearchX}
        shape="midterm"
        title={`${asked} isn’t in the routine`}
        description={`No teacher in DIU’s ${version.department} routine v${version.version} has the initials ${asked}. Search by initials as printed in the routine (like ${teachers[0]?.initials ?? "STA"}) or by name.`}
      />
      <Link
        to={teachersHref(department)}
        className={buttonVariants({ variant: "secondary" })}
      >
        Every {version.department} teacher
      </Link>
      {alike.length > 0 && (
        <div className="space-y-2">
          <p className="text-sm text-muted-foreground">Did you mean</p>
          <ul className="flex flex-wrap gap-2">
            {alike.map((t) => (
              <li key={t.initials}>
                <Link
                  to={teacherHref({ department, teacher: t.initials })}
                  className="flex h-10 items-center gap-2 rounded-xl border border-input px-3.5 text-sm font-semibold transition-colors hover:state-layer"
                >
                  {teacherName(t)}
                  {t.name && (
                    <span className="font-medium text-muted-foreground">
                      {t.initials}
                    </span>
                  )}
                </Link>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

/** /routine/cse/teachers/STA: a teacher's week, with the sections they teach. */
export default function RoutineTeacherPage({
  loaderData,
}: Route.ComponentProps) {
  const now = useDhakaNow(
    loaderData.kind === "teacher" ? loaderData.serverMinute : undefined,
  );
  if (loaderData.kind === "missing") return <MissingTeacher {...loaderData} />;

  const { week, pick, saved, serverDay, dates } = loaderData;
  const { teacher, version } = week;
  const classes = week.classes.map(teacherClass);
  const days = weekDays(classes);
  const today = now?.day ?? serverDay;
  const name = teacherName(teacher);
  const wide = week.slots.length > 6;

  return (
    <RoutineLinks value={pick.department}>
      <div className="space-y-12">
        <div className="min-w-0 space-y-6">
          <Breadcrumbs
            crumbs={[
              {
                label: `${version.department} teachers`,
                to: teachersHref(pick.department),
              },
              { label: name },
            ]}
          />
          <div className="space-y-3">
            <h1
              className={
                teacher.name
                  ? "font-expressive text-4xl text-balance break-words sm:text-5xl"
                  : "font-display-xl text-6xl break-words sm:text-7xl"
              }
            >
              {name}
            </h1>
            <p className="text-muted-foreground">
              {[
                teacher.name ? teacher.initials : null,
                `${version.department} teacher`,
              ]
                .filter(Boolean)
                .join(" · ")}
            </p>
            <div className="text-sm">
              <TeacherContact t={teacher} />
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <MyRoutineButton
              key={pick.teacher}
              pick={pick}
              saved={saved}
              words={["Make it my routine", "My routine"]}
            />
            <a
              href={teacherPdfHref(pick)}
              download
              aria-label="Download PDF"
              className={buttonVariants()}
            >
              <Download aria-hidden />
              <span className="sm:hidden">PDF</span>
              <span className="max-sm:hidden">Download PDF</span>
            </a>
            <ShareButton title={`${name}’s class routine`} />
          </div>
        </div>

        <section aria-labelledby="week" className="space-y-4">
          <h2 id="week" className="font-expressive text-3xl">
            The week
          </h2>
          <div className={wide ? "max-xl:hidden" : "max-md:hidden"}>
            <WeekGrid
              classes={classes}
              section=""
              slots={week.slots}
              days={days}
              today={days.includes(today) ? today : null}
              now={now}
            />
          </div>
          <div className={wide ? "xl:hidden" : "md:hidden"}>
            <DayTabs
              key={pick.teacher}
              classes={classes}
              days={days}
              dates={dates}
              section=""
              today={days.includes(today) ? today : null}
              now={now}
            />
          </div>
        </section>

        <section aria-labelledby="courses" className="space-y-4">
          <h2 id="courses" className="font-expressive text-3xl">
            Courses and sections
          </h2>
          <TeacherCourseList classes={classes} />
          <p className="max-w-3xl text-sm text-pretty text-muted-foreground">
            From DIU’s {version.department} class routine, version{" "}
            {version.version}
            {version.publishedOn &&
              `, published ${formatDate(version.publishedOn)}`}
            . Routines change during the semester; when a new one comes out,
            this page follows it. Something looks wrong?{" "}
            <Link
              to="/contact"
              className="font-semibold text-primary underline-offset-4 hover:underline"
            >
              Tell us
            </Link>
            .
          </p>
        </section>
      </div>
    </RoutineLinks>
  );
}
