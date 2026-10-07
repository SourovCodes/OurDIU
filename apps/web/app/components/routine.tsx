import type { RoutineClass, RoutineDay, RoutineSection } from "@ourdiu/shared";
import type { TodayPlan } from "~/lib/routine";
import {
  ROUTINE_DAY_NAMES,
  ROUTINE_DAYS,
  ROUTINE_SECTION_EXAMPLES,
  routineClockTime,
  routineGroupLabel,
  routineMinutes,
  routineTimeRange,
} from "@ourdiu/shared/constants";
import {
  ArrowRight,
  ChevronRight,
  Star,
  Mail,
  MapPin,
  Phone,
  Search,
  UserRound,
  UsersRound,
} from "lucide-react";
import {
  createContext,
  useContext,
  useId,
  useMemo,
  useState,
  useSyncExternalStore,
} from "react";
import { Link, useNavigate } from "react-router";
import { ExamShape } from "~/components/exam-badge";
import { Button, buttonVariants } from "~/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "~/components/ui/dialog";
import {
  attendingLabel,
  classState,
  dhakaNow,
  exactSection,
  matchSections,
  nextClass,
  routineHref,
  samePick,
  saveRoutine,
  teacherHref,
  teacherName,
  type RoutineDepartmentSlug,
  type SavedRoutine,
  type RoutinePick,
  type SectionChoice,
  type ShownClass,
} from "~/lib/routine";
import { cn } from "~/lib/utils";

// The Class Routine's pieces (docs/PLAN.md, decision 29), in the question bank's
// shapes: tonal tiles, filter chips, rows on a surface.

/**
 * The department the routine on the page is in, for links between sections and
 * teachers; none in an admin's preview of a draft, which links nowhere.
 */
const LinksTo = createContext<RoutineDepartmentSlug | null>(null);
export const RoutineLinks = LinksTo.Provider;

export const dayName = (day: RoutineDay) =>
  ROUTINE_DAY_NAMES[ROUTINE_DAYS.indexOf(day)]!;

/** A lab: one lab group's class, or a class in a lab room. */
export const isLab = (c: ShownClass) =>
  c.labGroup !== null || c.roomType === "lab";

type Now = ReturnType<typeof dhakaNow>;

/** The current minute, for `useSyncExternalStore`: it changes once a minute. */
const currentMinute = () => Math.floor(Date.now() / 60_000);
function subscribeToMinutes(onChange: () => void) {
  const timer = setInterval(onChange, 15_000);
  return () => clearInterval(timer);
}

/**
 * The day and time in Dhaka, once the page is in the browser: the server can't know
 * the visitor's "now" when the page is cached or rendered a minute earlier, so
 * "Now" and "Next" only appear after hydration. Updated every minute.
 */
export function useDhakaNow(serverMinute?: number) {
  const minute = useSyncExternalStore(
    subscribeToMinutes,
    currentMinute,
    // The server's minute when it rendered the page, so the first render here
    // matches it (no flash from "3 classes today" to "Done for today").
    () => serverMinute ?? null,
  );
  return useMemo(
    () => (minute === null ? null : dhakaNow(new Date(minute * 60_000))),
    [minute],
  );
}

function formatWait(minutes: number) {
  if (minutes < 60) return `${minutes} min`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m ? `${h} h ${m} min` : `${h} h`;
}

const Tag = ({
  className,
  children,
}: {
  className?: string;
  children: React.ReactNode;
}) => (
  <span
    className={cn(
      "rounded-md px-1.5 py-0.5 text-[0.6875rem] font-bold tracking-wide uppercase",
      className,
    )}
  >
    {children}
  </span>
);

function LabTag({ section, group }: { section: string; group: string | null }) {
  return (
    <Tag className="bg-exam-lab text-exam-lab-foreground">
      Lab{group ? ` · ${routineGroupLabel(section, group)}` : ""}
    </Tag>
  );
}

function Place({ c, className }: { c: ShownClass; className?: string }) {
  return (
    <span
      className={cn(
        "flex flex-wrap gap-x-3 gap-y-1 text-sm text-muted-foreground",
        className,
      )}
    >
      {c.course.title && <span>{c.course.code}</span>}
      <span className="inline-flex items-center gap-1">
        <MapPin className="size-3.5" aria-hidden />
        <span className="sr-only">Room</span>
        {c.room}
      </span>
      {c.teacher && (
        <span
          className="inline-flex items-center gap-1"
          title={c.teacher.name ?? undefined}
        >
          <UserRound className="size-3.5" aria-hidden />
          <span className="sr-only">Teacher</span>
          {teacherName(c.teacher)}
        </span>
      )}
      {c.sections && (
        <span className="inline-flex items-center gap-1">
          <UsersRound className="size-3.5" aria-hidden />
          <span className="sr-only">Sections</span>
          {attendingLabel(c.sections)}
        </span>
      )}
    </span>
  );
}

const sameClass = (a: ShownClass, b: ShownClass) =>
  a.day === b.day &&
  a.start === b.start &&
  a.room === b.room &&
  a.course.code === b.course.code &&
  a.labGroup === b.labGroup;

const textLink =
  "font-semibold text-primary underline-offset-4 hover:underline";

/**
 * A class in full, opened from wherever it's shown (the week, a day, today): the
 * course's title, when and where, the teacher and how to reach them, and the
 * course's other classes in the week.
 */
export function ClassDialog({
  c,
  week,
  section,
  children,
}: {
  c: ShownClass;
  /** The week it's in, for the course's other classes. */
  week: ShownClass[];
  section: string;
  /** What opens it: one element, given the button's behaviour. */
  children: React.ReactNode;
}) {
  const department = useContext(LinksTo);
  const others = week.filter((o) => o.course.code === c.course.code);
  return (
    <Dialog>
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent className="max-h-[calc(100dvh-2rem)] gap-6 overflow-y-auto">
        <DialogHeader className="gap-2 pr-8 text-left">
          {(c.course.title || isLab(c)) && (
            <p className="flex flex-wrap items-center gap-2 text-sm font-semibold text-muted-foreground">
              {c.course.title && c.course.code}
              {isLab(c) && <LabTag section={section} group={c.labGroup} />}
            </p>
          )}
          <DialogTitle className="font-expressive text-3xl leading-tight text-balance">
            {c.course.title ?? c.course.code}
          </DialogTitle>
          <DialogDescription className="text-base text-foreground tabular-nums">
            {dayName(c.day)}, {routineTimeRange(c.start, c.end)}
            <span className="mt-1 flex items-center gap-1.5 text-muted-foreground">
              <MapPin className="size-4" aria-hidden />
              <span className="sr-only">Room</span>
              {c.room}
            </span>
          </DialogDescription>
        </DialogHeader>

        {c.sections ? (
          <section aria-label="Sections" className="grid gap-2">
            <h3 className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">
              {c.sections.length === 1 ? "Section" : "Sections"}
            </h3>
            <ul className="flex flex-wrap gap-2">
              {c.sections.map((s) => {
                const label = s.labGroup
                  ? routineGroupLabel(s.section, s.labGroup)
                  : s.section;
                return (
                  <li key={label}>
                    {department ? (
                      <Link
                        to={routineHref({
                          department,
                          section: s.section,
                          group: s.labGroup,
                        })}
                        className="flex h-10 items-center rounded-xl border border-input px-3.5 text-sm font-semibold transition-colors hover:state-layer"
                      >
                        {label}
                      </Link>
                    ) : (
                      <span className="flex h-10 items-center rounded-xl bg-surface px-3.5 text-sm font-semibold">
                        {label}
                      </span>
                    )}
                  </li>
                );
              })}
            </ul>
          </section>
        ) : (
          <section aria-label="Teacher" className="grid gap-2">
            <h3 className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">
              Teacher
            </h3>
            {c.teacher ? (
              <div className="grid gap-2 rounded-2xl bg-surface px-4 py-3.5">
                <p className="flex flex-wrap items-baseline gap-x-2">
                  <span className="font-bold">{teacherName(c.teacher)}</span>
                  {c.teacher.name && (
                    <span className="text-sm text-muted-foreground">
                      {c.teacher.initials}
                    </span>
                  )}
                </p>
                <TeacherContact t={c.teacher} />
                {!c.teacher.room && !c.teacher.email && !c.teacher.phone && (
                  <p className="text-sm text-muted-foreground">
                    No contact details yet.
                  </p>
                )}
                {department && (
                  <Link
                    to={teacherHref({
                      department,
                      teacher: c.teacher.initials,
                    })}
                    className={cn(
                      textLink,
                      "inline-flex items-center gap-1 text-sm",
                    )}
                  >
                    {teacherName(c.teacher)}’s routine
                    <ArrowRight className="size-4" aria-hidden />
                  </Link>
                )}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">
                The routine doesn’t name one.
              </p>
            )}
          </section>
        )}

        {others.length > 1 && (
          <section aria-label="This week" className="grid gap-2">
            <h3 className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">
              {c.course.code} this week · {others.length} classes
            </h3>
            <ul className="grid gap-1 text-sm tabular-nums">
              {others.map((o) => {
                const self = sameClass(o, c);
                return (
                  <li
                    key={`${o.day}-${o.start}-${o.labGroup}-${o.room}`}
                    aria-current={self ? "true" : undefined}
                    className={cn(
                      "grid grid-cols-[2.75rem_minmax(0,1fr)] gap-x-3 rounded-xl px-3 py-2",
                      self
                        ? "bg-primary-container text-primary-container-foreground"
                        : "bg-surface",
                    )}
                  >
                    <span className="font-bold">
                      {dayName(o.day).slice(0, 3)}
                    </span>
                    <span className="grid gap-0.5">
                      <span>
                        {routineTimeRange(o.start, o.end)}
                        {(o.labGroup || o.sections) && (
                          <span className="opacity-75">
                            {" "}
                            ·{" "}
                            {o.sections
                              ? attendingLabel(o.sections)
                              : routineGroupLabel(section, o.labGroup!)}
                          </span>
                        )}
                      </span>
                      <span className="text-xs opacity-75">
                        {[
                          o.room,
                          o.teacher?.initials !== c.teacher?.initials &&
                            o.teacher &&
                            teacherName(o.teacher),
                        ]
                          .filter(Boolean)
                          .join(" · ")}
                      </span>
                    </span>
                  </li>
                );
              })}
            </ul>
          </section>
        )}
      </DialogContent>
    </Dialog>
  );
}

/**
 * Makes a section or a teacher's week the visitor's own, so /routine opens with it;
 * pressed again, forgets it.
 */
export function MyRoutineButton({
  pick,
  saved,
  words,
}: {
  pick: SavedRoutine;
  saved: SavedRoutine | null;
  /** What it says before and after: "Make it my section", "My section". */
  words: [string, string];
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
      {mine ? words[1] : words[0]}
    </Button>
  );
}

/** One class: course, time, room and teacher; "Now" and "Next" on today's. */
export function ClassCard({
  c,
  week,
  section,
  state,
  minutesLeft,
}: {
  c: ShownClass;
  /** The week it's in: tapping the card opens the class in full. */
  week: ShownClass[];
  section: string;
  state?: "now" | "next" | "over" | null;
  /** Until it ends (now) or starts (next). */
  minutesLeft?: number;
}) {
  return (
    <article
      className={cn(
        "relative grid gap-1 rounded-2xl bg-surface px-4 py-3.5 transition-colors has-[button:focus-visible]:ring-2 has-[button:focus-visible]:ring-ring has-[button:hover]:state-layer",
        state === "now" &&
          "bg-primary-container text-primary-container-foreground",
        state === "over" && "opacity-55",
      )}
    >
      <div
        className={cn(
          "flex flex-wrap items-center gap-2 text-sm text-muted-foreground tabular-nums",
          state === "now" && "text-inherit",
        )}
      >
        {state === "now" && (
          <Tag className="bg-primary text-primary-foreground">Now</Tag>
        )}
        {state === "next" && (
          <Tag className="bg-surface-highest text-foreground">Next</Tag>
        )}
        {state === "over" && (
          <Tag className="bg-surface-highest text-muted-foreground">Over</Tag>
        )}
        <span className={cn(state === "now" && "opacity-85")}>
          {routineTimeRange(c.start, c.end)}
          {minutesLeft !== undefined &&
            (state === "now"
              ? ` · ${minutesLeft} min left`
              : state === "next"
                ? ` · in ${formatWait(minutesLeft)}`
                : "")}
        </span>
        {isLab(c) && <LabTag section={section} group={c.labGroup} />}
        <ChevronRight className="ml-auto size-4 opacity-60" aria-hidden />
      </div>
      <h3 className="text-base leading-snug font-bold">
        <ClassDialog c={c} week={week} section={section}>
          <button
            type="button"
            className="text-left after:absolute after:inset-0 after:rounded-2xl focus-visible:outline-none"
          >
            {c.course.title ?? c.course.code}
          </button>
        </ClassDialog>
      </h3>
      <Place
        c={c}
        className={cn(state === "now" && "text-inherit opacity-85")}
      />
    </article>
  );
}

/** A day's classes as cards, with "Now" and "Next" when the day is today. */
export function DayClasses({
  classes,
  week,
  section,
  now,
  className,
}: {
  classes: ShownClass[];
  /** The whole week, for a class's details. */
  week: ShownClass[];
  section: string;
  now: Now | null;
  className?: string;
}) {
  const nextIndex = now
    ? classes.findIndex((c) => classState(c, now) === "later")
    : -1;
  return (
    <div className={cn("grid gap-2", className)}>
      {classes.map((c, i) => {
        const s = now ? classState(c, now) : null;
        const state =
          s === "now"
            ? "now"
            : s === "over"
              ? "over"
              : i === nextIndex
                ? "next"
                : null;
        const minutesLeft =
          now && state === "now"
            ? routineMinutes(c.end) - now.minutes
            : now && state === "next"
              ? routineMinutes(c.start) - now.minutes
              : undefined;
        return (
          <ClassCard
            key={`${c.day}-${c.start}-${c.course.code}-${c.labGroup}`}
            c={c}
            week={week}
            section={section}
            state={state}
            minutesLeft={minutesLeft}
          />
        );
      })}
    </div>
  );
}

/**
 * The one thing to know right now, as a tile in the space's colour: the class
 * you're in or the next one today (from `todayPlan`), else "Done for today" or
 * "No classes today". What comes after is the list under it, never repeated here.
 */
export function TodayCard({
  plan,
  classes,
  section,
  now,
}: {
  plan: TodayPlan;
  /** The whole week, for the class's details. */
  classes: ShownClass[];
  section: string;
  now: Now | null;
}) {
  const { focus, over } = plan;
  const eyebrow =
    focus && now
      ? focus.state === "now"
        ? `Now · until ${routineClockTime(focus.c.end)}`
        : `Next · in ${formatWait(routineMinutes(focus.c.start) - now.minutes)}`
      : null;
  const headline = focus
    ? (focus.c.course.title ?? focus.c.course.code)
    : over === "done"
      ? "Done for today"
      : over === "off"
        ? "No classes today"
        : // Before the clock is known (hydrating): the day's outline.
          `${plan.list?.classes.length ?? "No"} class${plan.list?.classes.length === 1 ? "" : "es"} today`;

  return (
    <section
      aria-label="Today"
      className="relative min-h-40 overflow-hidden rounded-[1.75rem] bg-primary-container p-6 text-primary-container-foreground sm:p-7"
    >
      <ExamShape
        kind="midterm"
        colored={false}
        className="absolute -right-10 -bottom-14 size-52 rotate-12 text-primary/15"
      />
      <div className="relative space-y-3">
        {eyebrow && (
          <p className="text-sm font-semibold tabular-nums opacity-85">
            {eyebrow}
          </p>
        )}
        <h2 className="font-expressive text-3xl text-balance sm:text-4xl">
          {focus ? (
            <ClassDialog c={focus.c} week={classes} section={section}>
              <button
                type="button"
                className="text-left underline decoration-current/30 decoration-2 underline-offset-[0.2em] transition-colors hover:decoration-current focus-visible:rounded-md focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
              >
                {headline}
              </button>
            </ClassDialog>
          ) : (
            headline
          )}
        </h2>
        {focus && (
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
            <span className="font-semibold tabular-nums">
              {focus.state === "now" && now
                ? `${routineMinutes(focus.c.end) - now.minutes} min left`
                : routineTimeRange(focus.c.start, focus.c.end)}
            </span>
            {isLab(focus.c) && (
              <LabTag section={section} group={focus.c.labGroup} />
            )}
            <Place c={focus.c} className="text-inherit opacity-85" />
          </div>
        )}
      </div>
    </section>
  );
}

/**
 * The lab groups as filter chips, like the course page's exam types: the whole
 * section, or one group (its own labs and the section's classes).
 */
export function GroupChips({
  routine,
  pick,
}: {
  routine: RoutineSection;
  pick: RoutinePick;
}) {
  const chips = [
    { group: null, label: "Both groups" },
    ...routine.labGroups.map((g) => ({
      group: g,
      label: routineGroupLabel(routine.section, g),
    })),
  ];
  return (
    <nav
      aria-label="Lab group"
      className="-mx-4 flex [scrollbar-width:none] gap-2 overflow-x-auto px-4 pb-1 sm:mx-0 sm:flex-wrap sm:px-0"
    >
      {chips.map((chip) => {
        const on = chip.group === pick.group;
        return (
          <Link
            key={chip.label}
            to={routineHref({ ...pick, group: chip.group })}
            replace
            preventScrollReset
            aria-current={on ? "true" : undefined}
            className={cn(
              "flex h-10 shrink-0 items-center rounded-xl border px-3.5 text-sm font-semibold transition-colors",
              on
                ? "border-primary-container bg-primary-container text-primary-container-foreground"
                : "border-input hover:state-layer",
            )}
          >
            {chip.label}
          </Link>
        );
      })}
    </nav>
  );
}

/**
 * The week as the printed routine has it: days down, time slots across, labs over
 * two slots. Today's row and the class on now stand out.
 */
export function WeekGrid({
  classes,
  section,
  slots,
  days,
  today,
  now,
}: {
  classes: ShownClass[];
  section: string;
  /** The routine's time slots, in order. */
  slots: { start: string; end: string }[];
  days: RoutineDay[];
  today: RoutineDay | null;
  now: Now | null;
}) {
  const column = (time: string) => slots.findIndex((s) => s.start === time) + 2;
  const span = (c: ShownClass) =>
    slots.findIndex((s) => s.end === c.end) -
    slots.findIndex((s) => s.start === c.start) +
    1;
  // Classes at the same time (a retake section's courses, both lab groups) go
  // in lanes, one grid row each, so none hides another.
  const layout: {
    day: RoutineDay;
    firstRow: number;
    lanes: number;
    placed: { c: ShownClass; lane: number }[];
  }[] = [];
  let nextRow = 2;
  for (const day of days) {
    const ends: number[] = [];
    const placed: { c: ShownClass; lane: number }[] = [];
    for (const c of classes) {
      if (c.day !== day) continue;
      const start = routineMinutes(c.start);
      let lane = ends.findIndex((end) => end <= start);
      if (lane === -1) lane = ends.push(0) - 1;
      ends[lane] = routineMinutes(c.end);
      placed.push({ c, lane });
    }
    const lanes = Math.max(1, ends.length);
    layout.push({ day, firstRow: nextRow, lanes, placed });
    nextRow += lanes;
  }

  return (
    <div className="overflow-x-auto rounded-[1.75rem] bg-surface">
      <div
        className="grid min-w-[52rem]"
        style={{
          gridTemplateColumns: `6rem repeat(${slots.length}, minmax(7.5rem, 1fr))`,
        }}
        role="table"
        aria-label="The week"
      >
        <div role="row" className="contents">
          <div
            role="columnheader"
            className="bg-surface-high px-4 py-3 text-xs font-semibold text-muted-foreground"
          >
            Day
          </div>
          {slots.map((s) => (
            <div
              key={s.start}
              role="columnheader"
              className="bg-surface-high px-3 py-3 text-xs font-semibold text-muted-foreground tabular-nums"
            >
              {routineClockTime(s.start).replace(/ [ap]m$/, "")}–
              {routineClockTime(s.end).replace(/ [ap]m$/, "")}
            </div>
          ))}
        </div>
        {layout.map(({ day, firstRow, lanes, placed }) => {
          const isToday = day === today;
          const rows = `${firstRow} / span ${lanes}`;
          return (
            <div key={day} role="row" className="contents">
              <div
                role="rowheader"
                style={{ gridRow: rows }}
                className={cn(
                  "flex flex-col justify-center border-t border-surface-highest px-4 py-3 text-sm font-bold",
                  isToday && "bg-primary-container/40 text-primary",
                )}
              >
                {dayName(day).slice(0, 3)}
                {isToday && <span className="text-xs font-medium">Today</span>}
              </div>
              {placed.length === 0 ? (
                <div
                  role="cell"
                  style={{ gridRow: rows, gridColumn: `2 / -1` }}
                  className={cn(
                    "flex items-center border-t border-surface-highest px-3 text-sm text-muted-foreground",
                    isToday && "bg-primary-container/40",
                  )}
                >
                  No classes
                </div>
              ) : (
                <>
                  {slots.map((s, i) => (
                    <div
                      key={s.start}
                      aria-hidden
                      style={{ gridRow: rows, gridColumn: i + 2 }}
                      className={cn(
                        "min-h-20 border-t border-surface-highest",
                        isToday && "bg-primary-container/40",
                      )}
                    />
                  ))}
                  {placed.map(({ c, lane }) => {
                    const on = now !== null && classState(c, now) === "now";
                    return (
                      <div
                        key={`${c.start}-${c.course.code}-${c.labGroup}-${c.room}`}
                        role="cell"
                        style={{
                          gridRow: firstRow + lane,
                          gridColumn: `${column(c.start)} / span ${span(c)}`,
                        }}
                        className="flex min-w-0 p-1.5"
                      >
                        <ClassDialog c={c} week={classes} section={section}>
                          <button
                            type="button"
                            className={cn(
                              "grid w-full min-w-0 content-start gap-0.5 rounded-xl px-2.5 py-2 text-left text-xs transition-colors hover:state-layer focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none",
                              isLab(c)
                                ? "bg-exam-lab text-exam-lab-foreground"
                                : "bg-surface-highest",
                              on &&
                                "ring-2 ring-primary ring-offset-2 ring-offset-surface",
                            )}
                          >
                            <b className="text-[0.8125rem]">
                              {c.course.code}
                              {c.labGroup ? ` · ${c.labGroup}` : ""}
                            </b>
                            {c.course.title && (
                              <span className="line-clamp-2 leading-snug font-medium">
                                {c.course.title}
                              </span>
                            )}
                            <span className="mt-0.5 opacity-80">{c.room}</span>
                            {c.teacher && (
                              <span
                                className="truncate opacity-80"
                                title={c.teacher.name ?? undefined}
                              >
                                {teacherName(c.teacher)}
                              </span>
                            )}
                            {c.sections && (
                              <span className="font-semibold">
                                {attendingLabel(c.sections)}
                              </span>
                            )}
                            {on && <span className="sr-only">(now)</span>}
                          </button>
                        </ClassDialog>
                      </div>
                    );
                  })}
                </>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

/** Day tabs (Sat–Thu, with this week's dates) over the chosen day's classes; today first. */
export function DayTabs({
  classes,
  days,
  dates,
  section,
  today,
  now,
}: {
  classes: ShownClass[];
  days: RoutineDay[];
  /** Each day's date this week; none for a version not live (an admin's preview). */
  dates: Record<RoutineDay, number> | null;
  section: string;
  today: RoutineDay | null;
  now: Now | null;
}) {
  const [picked, setPicked] = useState<RoutineDay | null>(null);
  // Today while it has a class to come; once they're over (or on a day off), the
  // day of the next one. Today keeps its ring either way.
  const upcoming = now ? nextClass(classes, now) : null;
  const todayLeft =
    !!now &&
    classes.some((c) => c.day === now.day && classState(c, now) !== "over");
  const opening =
    today && (todayLeft || !upcoming) ? today : (upcoming?.c.day ?? today);
  const day = picked ?? opening ?? days[0]!;
  const onDay = classes.filter((c) => c.day === day);
  return (
    <div className="grid gap-3">
      <div role="tablist" aria-label="Day" className="flex gap-1.5">
        {days.map((d) => {
          const has = classes.some((c) => c.day === d);
          const on = d === day;
          return (
            <button
              key={d}
              type="button"
              role="tab"
              aria-selected={on}
              aria-label={`${dayName(d)}${d === today ? " (today)" : ""}${has ? "" : ", no classes"}`}
              onClick={() => setPicked(d)}
              className={cn(
                "grid flex-1 justify-items-center gap-0.5 rounded-2xl bg-surface py-2 text-xs text-muted-foreground transition-colors hover:state-layer",
                on && "bg-primary text-primary-foreground hover:bg-primary",
                !on && d === today && "ring-2 ring-primary ring-inset",
              )}
            >
              <span>{dayName(d).slice(0, 3)}</span>
              {dates && (
                <span
                  className={cn(
                    "font-expressive text-lg tabular-nums",
                    !on && "text-foreground",
                  )}
                  suppressHydrationWarning
                >
                  {dates[d]}
                </span>
              )}
              <span
                aria-hidden
                className={cn(
                  "size-1.5 rounded-full bg-current",
                  !has && "opacity-0",
                )}
              />
            </button>
          );
        })}
      </div>
      <div role="tabpanel" aria-label={dayName(day)}>
        {onDay.length ? (
          <DayClasses
            classes={onDay}
            week={classes}
            section={section}
            now={day === today ? now : null}
          />
        ) : (
          <p className="rounded-2xl bg-surface px-4 py-10 text-center text-muted-foreground">
            <span className="block font-bold text-foreground">
              No classes on {dayName(day)}
            </span>
            Enjoy the day off.
          </p>
        )}
      </div>
    </div>
  );
}

/**
 * The section search: suggestions as you type ("67b" finds 67_B and its lab groups,
 * "12b" EEE's 1-2 B);
 * Enter opens the exact match, else the first suggestion.
 */
export function SectionSearch({
  department,
  choices,
  autoFocus,
  size = "default",
}: {
  department: RoutineDepartmentSlug;
  choices: SectionChoice[];
  autoFocus?: boolean;
  /** "lg": the home's search, with a Search button, like the question bank's. */
  size?: "default" | "lg";
}) {
  const navigate = useNavigate();
  const id = useId();
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);
  const matches = matchSections(choices, query).map((c) => ({
    key: c.label,
    href: routineHref({ department, section: c.section, group: c.group }),
    label: c.label,
    note: c.group ? `Lab group ${c.group} of ${c.section}` : null,
  }));
  const example = ROUTINE_SECTION_EXAMPLES[department];
  const hint = `Your section, e.g. ${example.section} or ${example.group}`;

  return (
    <form
      role="search"
      className="relative"
      onSubmit={(event) => {
        event.preventDefault();
        const section = exactSection(choices, query);
        const href = section
          ? routineHref({ department, ...section })
          : (matches[active] ?? matches[0])?.href;
        if (href) navigate(href);
      }}
    >
      <label htmlFor={`${id}-input`} className="sr-only">
        {hint}
      </label>
      <div
        className={cn(
          "flex items-center gap-3 rounded-full bg-surface pl-5 focus-within:ring-[3px] focus-within:ring-ring/50",
          size === "lg" ? "h-16 pr-2 pl-6" : "h-14 pr-5",
        )}
      >
        <Search className="size-5 shrink-0 text-muted-foreground" aria-hidden />
        <input
          id={`${id}-input`}
          type="search"
          role="combobox"
          aria-expanded={query.length > 0}
          aria-controls={`${id}-list`}
          aria-autocomplete="list"
          aria-activedescendant={matches.length ? `${id}-${active}` : undefined}
          autoComplete="off"
          autoCapitalize="characters"
          spellCheck={false}
          autoFocus={autoFocus}
          placeholder={hint}
          value={query}
          onChange={(event) => {
            setQuery(event.target.value);
            setActive(0);
          }}
          onKeyDown={(event) => {
            if (event.key === "ArrowDown") {
              event.preventDefault();
              setActive((a) => Math.min(a + 1, matches.length - 1));
            } else if (event.key === "ArrowUp") {
              event.preventDefault();
              setActive((a) => Math.max(a - 1, 0));
            } else if (event.key === "Escape") {
              setQuery("");
            }
          }}
          className="h-full min-w-0 flex-1 bg-transparent text-base outline-none placeholder:text-muted-foreground sm:text-lg"
        />
        {size === "lg" && (
          <button
            type="submit"
            className={cn(buttonVariants(), "h-12 px-6 max-sm:hidden")}
          >
            Open
          </button>
        )}
      </div>
      {query && (
        <ul
          id={`${id}-list`}
          role="listbox"
          aria-label="Sections"
          className="absolute inset-x-0 top-full z-20 mt-2 grid max-h-80 overflow-y-auto rounded-3xl bg-popover p-1.5 text-left shadow-lg"
        >
          {matches.length === 0 ? (
            <li className="px-4 py-3 text-sm text-muted-foreground">
              No section matches “{query}”. Sections look like {example.section}
              ; lab groups like {example.group}.
            </li>
          ) : (
            matches.map((m, i) => (
              <li
                key={m.key}
                id={`${id}-${i}`}
                role="option"
                aria-selected={i === active}
              >
                <Link
                  to={m.href}
                  className={cn(
                    "flex items-baseline justify-between gap-3 rounded-2xl px-4 py-2.5 hover:state-layer",
                    i === active && "state-layer",
                  )}
                >
                  <span className="min-w-0 font-semibold">{m.label}</span>
                  <span className="min-w-0 truncate text-right text-xs text-muted-foreground">
                    {m.note}
                  </span>
                </Link>
              </li>
            ))
          )}
        </ul>
      )}
    </form>
  );
}

/** How to reach a teacher, where it's known: the room where they sit, email, phone. */
export function TeacherContact({
  t,
}: {
  t: NonNullable<RoutineClass["teacher"]>;
}) {
  if (!t.room && !t.email && !t.phone) return null;
  return (
    <span className="flex flex-wrap gap-x-3 gap-y-1 text-xs">
      {t.room && (
        <span className="inline-flex items-center gap-1 text-muted-foreground">
          <MapPin className="size-3.5" aria-hidden />
          Sits in {t.room}
        </span>
      )}
      {t.email && (
        <a
          href={`mailto:${t.email}`}
          className="inline-flex min-w-0 items-center gap-1 font-medium text-primary underline-offset-4 hover:underline"
        >
          <Mail className="size-3.5 shrink-0" aria-hidden />
          <span className="truncate">{t.email}</span>
        </a>
      )}
      {t.phone && (
        <a
          href={`tel:${t.phone.replace(/[\s-]/g, "")}`}
          className="inline-flex items-center gap-1 font-medium text-primary tabular-nums underline-offset-4 hover:underline"
        >
          <Phone className="size-3.5" aria-hidden />
          {t.phone}
        </a>
      )}
    </span>
  );
}

/**
 * A section's courses, each with its teachers and how to reach them, and which lab
 * group a teacher has when they teach only one group's labs.
 */
export function CourseList({
  classes,
  section,
}: {
  classes: RoutineClass[];
  section: string;
}) {
  const department = useContext(LinksTo);
  const courses = [
    ...new Map(classes.map((c) => [c.course.code, c.course])).values(),
  ].map((course) => {
    const of = classes.filter((c) => c.course.code === course.code);
    const teachers = [
      ...new Map(
        of.flatMap((c) =>
          c.teacher ? [[c.teacher.initials, c.teacher] as const] : [],
        ),
      ).values(),
    ].map((t) => {
      const groups = new Set(
        of
          .filter((c) => c.teacher?.initials === t.initials)
          .map((c) => c.labGroup),
      );
      const [only] = groups;
      return { ...t, group: groups.size === 1 && only ? only : null };
    });
    return { ...course, teachers };
  });
  return (
    <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
      {courses.map((c) => (
        <li
          key={c.code}
          className="grid content-start gap-3 rounded-2xl bg-surface px-4 py-4"
        >
          <div className="flex items-baseline justify-between gap-3">
            <span className="min-w-0">
              <span className="block leading-snug font-semibold">
                {c.title ?? c.code}
              </span>
              {c.title && (
                <span className="block text-xs text-muted-foreground">
                  {c.code}
                </span>
              )}
            </span>
          </div>
          {c.teachers.length > 0 && (
            <ul className="grid gap-2">
              {c.teachers.map((t) => (
                <li key={t.initials} className="grid gap-1 text-sm">
                  <span className="flex flex-wrap items-baseline gap-x-1.5">
                    <UserRound
                      className="size-3.5 self-center text-muted-foreground"
                      aria-hidden
                    />
                    {department ? (
                      <Link
                        to={teacherHref({ department, teacher: t.initials })}
                        className="font-medium underline-offset-4 hover:text-primary hover:underline"
                      >
                        {teacherName(t)}
                      </Link>
                    ) : (
                      <span className="font-medium">{teacherName(t)}</span>
                    )}
                    <span className="text-muted-foreground">
                      {[
                        t.name ? t.initials : null,
                        t.group
                          ? `${routineGroupLabel(section, t.group)} lab`
                          : null,
                      ]
                        .filter(Boolean)
                        .map((part) => `· ${part}`)
                        .join(" ")}
                    </span>
                  </span>
                  <span className="pl-5">
                    <TeacherContact t={t} />
                  </span>
                </li>
              ))}
            </ul>
          )}
        </li>
      ))}
    </ul>
  );
}

/**
 * A teacher's courses, each with the sections taking it (linking to their weeks).
 */
export function TeacherCourseList({ classes }: { classes: ShownClass[] }) {
  const department = useContext(LinksTo);
  const courses = [
    ...new Map(classes.map((c) => [c.course.code, c.course])).values(),
  ].map((course) => {
    const of = classes.filter((c) => c.course.code === course.code);
    const sections = [
      ...new Map(
        of.flatMap((c) =>
          (c.sections ?? []).map(
            (s) => [`${s.section}|${s.labGroup}`, s] as const,
          ),
        ),
      ).values(),
    ].sort(
      (a, b) =>
        a.section.localeCompare(b.section, "en", { numeric: true }) ||
        (a.labGroup ?? "").localeCompare(b.labGroup ?? "", "en", {
          numeric: true,
        }),
    );
    return { ...course, sections };
  });
  return (
    <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
      {courses.map((c) => (
        <li
          key={c.code}
          className="grid content-start gap-3 rounded-2xl bg-surface px-4 py-4"
        >
          <div className="flex items-baseline justify-between gap-3">
            <span className="min-w-0">
              <span className="block leading-snug font-semibold">
                {c.title ?? c.code}
              </span>
              {c.title && (
                <span className="block text-xs text-muted-foreground">
                  {c.code}
                </span>
              )}
            </span>
          </div>
          <ul className="flex flex-wrap gap-1.5">
            {c.sections.map((s) => {
              const label = s.labGroup
                ? routineGroupLabel(s.section, s.labGroup)
                : s.section;
              return (
                <li key={label}>
                  {department ? (
                    <Link
                      to={routineHref({
                        department,
                        section: s.section,
                        group: s.labGroup,
                      })}
                      className="flex h-8 items-center rounded-lg border border-input px-2.5 text-xs font-semibold transition-colors hover:state-layer"
                    >
                      {label}
                    </Link>
                  ) : (
                    <span className="flex h-8 items-center rounded-lg bg-surface-high px-2.5 text-xs font-semibold">
                      {label}
                    </span>
                  )}
                </li>
              );
            })}
          </ul>
        </li>
      ))}
    </ul>
  );
}

/** The departments, CSE and EEE, as links to their routines. */
export function DepartmentSwitch({
  departments,
  current,
  hrefFor,
}: {
  departments: { department: RoutineDepartmentSlug; version: string | null }[];
  current: RoutineDepartmentSlug;
  /** Where each department leads: its sections, or its teachers. */
  hrefFor: (department: RoutineDepartmentSlug) => string;
}) {
  return (
    <nav aria-label="Departments">
      <ul className="inline-flex gap-1 rounded-full bg-surface p-1">
        {departments.map(({ department, version }) => (
          <li key={department}>
            <Link
              to={hrefFor(department)}
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
              {!version && (
                <span className="text-xs font-medium opacity-80">soon</span>
              )}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}
