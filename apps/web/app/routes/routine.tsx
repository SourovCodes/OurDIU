import { ArrowRight, LayoutGrid, UsersRound } from "lucide-react";
import { Link } from "react-router";
import { ComingSoon } from "~/components/coming-soon";
import { ExamShape } from "~/components/exam-badge";
import {
  DayTabs,
  RoutineLinks,
  TodayCard,
  useDhakaNow,
} from "~/components/routine";
import { product as findProduct } from "~/lib/products";
import {
  dhakaDateLabel,
  dhakaNow,
  rememberedDepartment,
  savedRoutine,
  teachersHref,
  weekDates,
  weekDays,
} from "~/lib/routine";
import { myRoutine, routineLists } from "~/lib/routine.server";
import { pageMeta } from "~/lib/seo";
import type { Route } from "./+types/routine";

const product = findProduct("routine");

export const meta: Route.MetaFunction = () =>
  pageMeta({
    title: "DIU Class Routine — your section's or a teacher's week | OurDIU",
    description:
      "DIU's class routines (CSE and EEE) by section or teacher: today's classes, the week with lab groups, rooms and teachers, and a PDF to download.",
  });

/**
 * /routine, the routine's Today: the visitor's own routine (a section, or a
 * teacher's week, they made theirs), else the two ways to find one.
 */
export async function loader({ request }: Route.LoaderArgs) {
  const { live, departments } = await routineLists(request);
  const cookie = request.headers.get("cookie");
  const remembered = rememberedDepartment(cookie);
  return {
    // Until any routine is live, the space stays "coming soon".
    anyLive: live.length > 0,
    departments,
    // Where "Find your section" and "Find a teacher" lead.
    department:
      remembered && live.includes(remembered) ? remembered : (live[0] ?? "cse"),
    mine: await myRoutine(request, savedRoutine(cookie), live),
    serverDay: dhakaNow().day,
    serverMinute: Math.floor(Date.now() / 60_000),
    dates: weekDates(),
  };
}

/** The routine's shapes, large, beside the welcome on wide screens. */
function ShapeCluster() {
  return (
    <div aria-hidden className="relative hidden h-64 lg:block">
      <ExamShape
        kind="midterm"
        colored={false}
        className="absolute top-0 left-12 size-52 text-primary-container"
      />
      <ExamShape
        kind="final"
        colored={false}
        className="absolute top-8 right-6 size-32 rotate-12 text-primary/70"
      />
      <ExamShape
        kind="quiz"
        colored={false}
        className="absolute bottom-0 left-0 size-24 text-exam-lab"
      />
    </div>
  );
}

/** A way in: find your section, or a teacher's week. */
function WayIn({
  to,
  icon: Icon,
  eyebrow,
  title,
  description,
}: {
  to: string;
  icon: typeof LayoutGrid;
  eyebrow: string;
  title: string;
  description: string;
}) {
  return (
    <Link
      to={to}
      prefetch="intent"
      className="group grid content-start gap-4 rounded-[1.75rem] bg-surface p-6 transition-colors hover:state-layer sm:p-7"
    >
      <span className="flex size-12 items-center justify-center rounded-2xl bg-primary-container text-primary-container-foreground">
        <Icon className="size-6" aria-hidden />
      </span>
      <span className="grid gap-1.5">
        <span className="text-sm font-semibold text-muted-foreground">
          {eyebrow}
        </span>
        <span className="flex items-center gap-2 font-expressive text-3xl">
          {title}
          <ArrowRight
            className="size-6 transition-transform group-hover:translate-x-1"
            aria-hidden
          />
        </span>
        <span className="text-pretty text-muted-foreground">{description}</span>
      </span>
    </Link>
  );
}

export default function RoutineToday({ loaderData }: Route.ComponentProps) {
  const { anyLive, departments, department, mine, serverDay, dates } =
    loaderData;
  const now = useDhakaNow(loaderData.serverMinute);
  if (!anyLive) return <ComingSoon product={product} />;
  const today = now?.day ?? serverDay;

  if (!mine) {
    const live = departments
      .filter((d) => d.version)
      .map((d) => `${d.department.toUpperCase()} v${d.version}`)
      .join(" · ");
    return (
      <div className="space-y-10 pt-2 sm:pt-6">
        <section className="grid items-center gap-8 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
          <div className="space-y-5">
            <p className="text-sm font-semibold text-muted-foreground">
              DIU’s class routines · {live}
            </p>
            <h1 className="font-display-xl text-5xl sm:text-7xl xl:text-8xl">
              Your class routine.
            </h1>
            <p className="max-w-xl text-lg text-pretty text-muted-foreground">
              Today’s classes, the week with rooms and teachers, and a PDF to
              keep. Find your section or your week, make it yours, and it opens
              here every day.
            </p>
          </div>
          <ShapeCluster />
        </section>
        <div className="grid gap-3 md:grid-cols-2">
          <WayIn
            to={`/routine/${department}`}
            icon={LayoutGrid}
            eyebrow="For students"
            title="Find your section"
            description="Your batch’s week and your lab group’s labs, with rooms, teachers and where they sit."
          />
          <WayIn
            to={teachersHref(department)}
            icon={UsersRound}
            eyebrow="For teachers, or to find one"
            title="Find a teacher"
            description="A teacher’s week: every class with its room and the sections attending."
          />
        </div>
      </div>
    );
  }

  const days = weekDays(mine.classes);
  return (
    <RoutineLinks value={mine.department}>
      <div className="space-y-10 pt-2 sm:pt-6">
        <header className="flex flex-wrap items-end justify-between gap-x-6 gap-y-3">
          <div className="space-y-2">
            <p
              className="text-sm font-semibold text-muted-foreground"
              suppressHydrationWarning
            >
              {dhakaDateLabel()}
            </p>
            <h1 className="font-display-xl text-5xl sm:text-7xl">Today</h1>
          </div>
          <p className="text-muted-foreground">
            {mine.kind === "section" ? "My section" : "My routine"}:{" "}
            <Link
              to={mine.href}
              className="font-semibold text-primary underline-offset-4 hover:underline"
            >
              {mine.department.toUpperCase()} {mine.name}
            </Link>
          </p>
        </header>

        <div className="grid items-start gap-8 lg:grid-cols-[minmax(0,26rem)_minmax(0,1fr)] lg:gap-12">
          <TodayCard
            classes={mine.classes}
            section={mine.section}
            today={today}
            now={now}
          />
          <section aria-labelledby="week" className="space-y-4">
            <h2 id="week" className="font-expressive text-3xl">
              This week
            </h2>
            <DayTabs
              classes={mine.classes}
              days={days}
              dates={dates}
              section={mine.section}
              today={days.includes(today) ? today : null}
              now={now}
            />
            <Link
              to={mine.href}
              className="inline-flex items-center gap-1 text-sm font-semibold text-primary underline-offset-4 hover:underline"
            >
              The whole week, courses and PDF
              <ArrowRight className="size-4" aria-hidden />
            </Link>
          </section>
        </div>
      </div>
    </RoutineLinks>
  );
}
