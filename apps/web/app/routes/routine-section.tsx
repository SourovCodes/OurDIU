import type {
  ApiError,
  RoutineSection,
  RoutineSectionList,
} from "@ourdiu/shared";
import {
  ROUTINE_SECTION_EXAMPLES,
  routineSectionSlug,
} from "@ourdiu/shared/constants";
import { Download, ExternalLink, SearchX, Star } from "lucide-react";
import { useState } from "react";
import { data, Link, redirect } from "react-router";
import { EmptyState } from "~/components/empty-state";
import { Breadcrumbs } from "~/components/page-header";
import {
  CourseList,
  DayTabs,
  GroupChips,
  SectionSearch,
  TodayCard,
  useDhakaNow,
  WeekGrid,
} from "~/components/routine";
import { ShareButton } from "~/components/share-button";
import { Alert, AlertDescription, AlertTitle } from "~/components/ui/alert";
import { Button, buttonVariants } from "~/components/ui/button";
import { apiFetch, apiGetJson, readJson } from "~/lib/api.server";
import { formatDate } from "~/lib/dates";
import {
  classesFor,
  dhakaNow,
  exactSection,
  isRegularSection,
  isRoutineDepartment,
  matchSections,
  sectionGroup,
  pickLabel,
  routineHref,
  routinePdfHref,
  samePick,
  savedRoutine,
  saveRoutine,
  sectionChoices,
  weekDates,
  weekDays,
  type RoutinePick,
} from "~/lib/routine";
import { pageMeta } from "~/lib/seo";
import { cn } from "~/lib/utils";
import type { Route } from "./+types/routine-section";

export const meta: Route.MetaFunction = ({ loaderData }) => {
  if (!loaderData || loaderData.kind === "missing") {
    return [
      { title: "Section not found — DIU Class Routine | OurDIU" },
      { name: "robots", content: "noindex" },
    ];
  }
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
    // No routine at all: the home says it's coming.
    if (code === "NO_ROUTINE") throw redirect(`/routine/${department}`);
    // A section that isn't in the routine: offer the search and look-alikes.
    const list = await apiGetJson<RoutineSectionList>(
      request,
      `/api/v1/routine/${department}/sections`,
    );
    // Written another way ("67b", "67-B1"): go to the section as printed.
    const exact = exactSection(sectionChoices(list.sections), section);
    if (exact) {
      throw redirect(
        routineHref({ department, section: exact.section, group: exact.group }),
        301,
      );
    }
    return data(
      {
        kind: "missing" as const,
        department,
        asked: section,
        sections: list.sections,
        version: list.version,
      },
      { status: 404 },
    );
  }
  if (!res.ok) throw data("API request failed", { status: 502 });
  const routine = await readJson<RoutineSection>(res);

  const url = new URL(request.url);
  const asked = url.searchParams.get("group");
  const group = asked && routine.labGroups.includes(asked) ? asked : null;
  // One address per page: the section as printed, a lab group it has.
  if (routineSectionSlug(routine.section) !== section || asked !== group) {
    throw redirect(
      routineHref({ department, section: routine.section, group }),
      301,
    );
  }
  const pick: RoutinePick = { department, section: routine.section, group };
  return {
    kind: "section" as const,
    routine,
    pick,
    saved: savedRoutine(request.headers.get("cookie")),
    // The day in Dhaka as the server sees it; the time comes after hydration.
    serverDay: dhakaNow().day,
    dates: weekDates(),
  };
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

type Missing = Extract<Route.ComponentProps["loaderData"], { kind: "missing" }>;

/** A section that isn't in the routine: the search, and sections like it. */
function MissingSection({ department, asked, sections, version }: Missing) {
  const choices = sectionChoices(sections);
  const alike = [
    ...matchSections(choices, asked, 6),
    ...matchSections(choices, asked.slice(0, 2), 6),
  ]
    .filter((c, i, all) => all.findIndex((x) => x.label === c.label) === i)
    .slice(0, 6);
  return (
    <div className="mx-auto max-w-2xl space-y-6 pt-4">
      <EmptyState
        icon={SearchX}
        shape="midterm"
        title={`${asked} isn’t in the routine`}
        description={`DIU’s ${version.department} routine v${version.version} has no section called ${asked}. Sections are written like ${ROUTINE_SECTION_EXAMPLES[department].section}, and lab groups like ${ROUTINE_SECTION_EXAMPLES[department].group}.`}
      />
      <SectionSearch department={department} choices={choices} />
      {alike.length > 0 && (
        <div className="space-y-2">
          <p className="text-sm text-muted-foreground">Did you mean</p>
          <ul className="flex flex-wrap gap-2">
            {alike.map((c) => (
              <li key={c.label}>
                <Link
                  to={routineHref({
                    department,
                    section: c.section,
                    group: c.group,
                  })}
                  className="flex h-10 items-center rounded-xl border border-input px-3.5 text-sm font-semibold transition-colors hover:state-layer"
                >
                  {c.label}
                </Link>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

/** /routine/cse/67_B: a section's week, with ?group=B1 for one lab group. */
export default function RoutineSectionPage({
  loaderData,
}: Route.ComponentProps) {
  const now = useDhakaNow();
  if (loaderData.kind === "missing") return <MissingSection {...loaderData} />;

  const { routine, pick, saved, serverDay, dates } = loaderData;
  const classes = classesFor(routine.classes, pick.group);
  const days = weekDays(classes);
  const today = now?.day ?? serverDay;
  const group = sectionGroup(routine.section);
  const { version } = routine;
  const courseCount = new Set(classes.map((c) => c.course.code)).size;

  return (
    <div className="grid gap-10 lg:grid-cols-[minmax(0,1fr)_20rem] lg:gap-12">
      <div className="min-w-0 space-y-7">
        <Breadcrumbs
          crumbs={[
            {
              label: `${version.department} Class Routine`,
              to: `/routine/${pick.department}`,
            },
            { label: pickLabel(pick) },
          ]}
        />
        <div className="space-y-3">
          <h1 className="font-display-xl text-6xl break-words sm:text-7xl">
            {pickLabel(pick)}
          </h1>
          <p className="text-muted-foreground">
            {[
              `${version.department}${group ? ` ${group.name}, section ${group.letter}` : ""}`,
              pick.group ? `lab group ${pick.group}` : null,
              `${courseCount} courses`,
              `${classes.length} classes a week`,
            ]
              .filter(Boolean)
              .join(" · ")}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <MySectionButton key={pickLabel(pick)} pick={pick} saved={saved} />
          <a href={routinePdfHref(pick)} download className={buttonVariants()}>
            <Download aria-hidden />
            Download PDF
          </a>
          <ShareButton title={`${pickLabel(pick)} class routine`} />
        </div>

        {routine.labGroups.length > 0 && (
          <div className="space-y-2">
            <GroupChips routine={routine} pick={pick} />
            {!pick.group && (
              <p className="text-sm text-muted-foreground">
                {routine.section} has lab groups. Pick yours to see only your
                own labs, here and in the PDF.
              </p>
            )}
          </div>
        )}

        {isRegularSection(routine.section) ? (
          <TodayCard
            classes={classes}
            section={routine.section}
            today={today}
            now={now}
          />
        ) : (
          <Alert variant="info">
            <AlertTitle>A retake section</AlertTitle>
            <AlertDescription>
              {routine.section} gathers the classes of several courses, often at
              the same time. You attend only the courses you’re retaking: look
              for their codes in the week below.
            </AlertDescription>
          </Alert>
        )}
      </div>

      <aside className="space-y-6 max-lg:order-last lg:pt-10">
        <section aria-labelledby="courses" className="space-y-3">
          <h2 id="courses" className="font-expressive text-xl">
            Courses
          </h2>
          <CourseList classes={classes} />
        </section>
        <section className="space-y-2 rounded-3xl bg-surface p-5 text-sm">
          <h2 className="font-semibold">About this routine</h2>
          <p className="text-muted-foreground">
            DIU’s {version.department} class routine, version {version.version}
            {version.publishedOn &&
              `, published ${formatDate(version.publishedOn)}`}
            . Routines change during the semester; when a new one comes out,
            this page follows it.
          </p>
          {version.source && (
            <a
              href={version.source}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1.5 font-semibold text-primary underline-offset-4 hover:underline"
            >
              DIU’s original PDF
              <ExternalLink className="size-3.5" aria-hidden />
            </a>
          )}
          <p className="text-muted-foreground">
            Something looks wrong?{" "}
            <Link
              to="/contact"
              className="font-semibold text-primary underline-offset-4 hover:underline"
            >
              Tell us
            </Link>
            .
          </p>
        </section>
      </aside>

      <section aria-labelledby="week" className="space-y-4 lg:col-span-2">
        <h2 id="week" className="font-expressive text-3xl">
          The week
        </h2>
        <div className="max-md:hidden">
          <WeekGrid
            classes={classes}
            slots={routine.slots}
            days={days}
            today={days.includes(today) ? today : null}
            now={now}
          />
        </div>
        <div className="md:hidden">
          <DayTabs
            key={pickLabel(pick)}
            classes={classes}
            days={days}
            dates={dates}
            section={routine.section}
            today={days.includes(today) ? today : null}
            now={now}
          />
        </div>
      </section>
    </div>
  );
}
