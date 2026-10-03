import type { RoutineSection, RoutineSectionList } from "@ourdiu/shared";
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
  pickLabel,
  routineHref,
  savedRoutine,
  sectionChoices,
  type RoutineDepartmentSlug,
} from "~/lib/routine";
import { pageMeta } from "~/lib/seo";
import { cn } from "~/lib/utils";
import type { Route } from "./+types/routine";

const product = findProduct("routine");
const DEPARTMENT: RoutineDepartmentSlug = "cse";

export const meta: Route.MetaFunction = () =>
  pageMeta({
    title: "DIU Class Routine — your section's classes | OurDIU",
    description:
      "The DIU CSE class routine by section: today's classes, your week with lab groups, rooms and teachers, and a PDF to download.",
  });

export async function loader({ request }: Route.LoaderArgs) {
  const res = await apiFetch(request, `/api/v1/routine/${DEPARTMENT}/sections`);
  // Until a routine is live, the space stays "coming soon".
  if (res.status === 404) return { list: null, mine: null, serverDay: null };
  if (!res.ok) throw data("API request failed", { status: 502 });
  const list = await readJson<RoutineSectionList>(res);

  // "My section", with its week for the Today card. Gone from a new version, it's
  // just left out.
  const saved = savedRoutine(request.headers.get("cookie"));
  const mine =
    saved && list.sections.some((s) => s.section === saved.section)
      ? {
          pick: saved,
          routine: await apiGetJson<RoutineSection>(
            request,
            `/api/v1/routine/${saved.department}/sections/${encodeURIComponent(saved.section)}`,
          ).catch(() => null),
        }
      : null;
  return {
    list,
    mine: mine?.routine ? { pick: mine.pick, routine: mine.routine } : null,
    serverDay: dhakaNow().day,
  };
}

/** The batch a section belongs to ("67" for 67_B), or null for retakes and others. */
const batchOf = (section: string) => /^(\d+)_/.exec(section)?.[1] ?? null;

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

/** /routine: your section's day, or find it. */
export default function Routine({ loaderData }: Route.ComponentProps) {
  const now = useDhakaNow();
  const { list, mine, serverDay } = loaderData;
  if (!list || !serverDay) return <ComingSoon product={product} />;

  const choices = sectionChoices(list.sections);
  const batches = new Map<string, string[]>();
  for (const { section } of list.sections) {
    const batch = batchOf(section) ?? "Others";
    batches.set(batch, [...(batches.get(batch) ?? []), section]);
  }
  const ordered = [...batches.entries()].sort(([a], [b]) =>
    a === "Others" ? 1 : b === "Others" ? -1 : Number(b) - Number(a),
  );
  const { version } = list;

  return (
    <div className="space-y-16 pt-2 sm:pt-6">
      <section className="grid grid-cols-1 items-center gap-10 lg:grid-cols-[minmax(0,1.35fr)_minmax(0,1fr)]">
        <div className="space-y-7">
          <p className="inline-flex items-center gap-2 rounded-full bg-primary-container py-1.5 pr-4 pl-1.5 text-sm font-medium text-primary-container-foreground">
            <span className="rounded-full bg-primary px-2 py-0.5 text-xs font-bold text-primary-foreground">
              {version.department}
            </span>
            Routine v{version.version}
            {version.publishedOn &&
              ` · published ${formatDate(version.publishedOn)}`}
          </p>
          <div className="space-y-5">
            <h1 className="font-display-xl text-6xl sm:text-7xl xl:text-8xl">
              Your class routine.
            </h1>
            <p className="max-w-xl text-lg text-pretty text-muted-foreground">
              Find your section in DIU’s {version.department} routine: today’s
              classes, your week with rooms and teachers, and a PDF to keep.
              More departments later.
            </p>
          </div>
          <div className="max-w-xl">
            <SectionSearch
              department={DEPARTMENT}
              choices={choices}
              size="lg"
            />
          </div>
        </div>
        {mine ? (
          // A returning student's day comes first on phones.
          <div className="max-lg:order-first">
            <TodayCard
              classes={classesFor(mine.routine.classes, mine.pick.group)}
              section={mine.routine.section}
              today={now?.day ?? serverDay}
              now={now}
              label={`My section · ${pickLabel(mine.pick)}`}
              href={routineHref(mine.pick)}
            />
          </div>
        ) : (
          <ShapeCluster />
        )}
      </section>

      <section aria-labelledby="batches-heading" className="space-y-5">
        <h2
          id="batches-heading"
          className="font-expressive text-3xl sm:text-4xl"
        >
          Every section
        </h2>
        <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {ordered.map(([batch, sections]) => (
            <li
              key={batch}
              className="flex flex-col gap-4 rounded-[1.75rem] bg-surface p-5"
            >
              <div className="flex items-baseline justify-between gap-3">
                <h3 className="font-display-xl text-5xl">
                  {batch === "Others" ? "Retakes" : batch}
                </h3>
                <span className="text-sm text-muted-foreground">
                  {batch === "Others" ? "and others" : "Batch"} ·{" "}
                  {sections.length} section{sections.length === 1 ? "" : "s"}
                </span>
              </div>
              <ul className="flex flex-wrap gap-1.5">
                {sections.map((section) => (
                  <li key={section}>
                    <Link
                      to={routineHref({
                        department: DEPARTMENT,
                        section,
                        group: null,
                      })}
                      prefetch="intent"
                      className={cn(
                        "inline-flex h-10 items-center rounded-xl border px-3.5 text-sm font-semibold transition-colors",
                        mine?.pick.section === section
                          ? "border-primary-container bg-primary-container text-primary-container-foreground"
                          : "border-input bg-background hover:state-layer",
                      )}
                    >
                      {batch === "Others"
                        ? section
                        : section.slice(batch.length + 1)}
                      <span className="sr-only"> ({section})</span>
                    </Link>
                  </li>
                ))}
              </ul>
            </li>
          ))}
        </ul>
      </section>

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
