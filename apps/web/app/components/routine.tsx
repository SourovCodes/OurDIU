import type { RoutineClass, RoutineDay, RoutineSection } from "@ourdiu/shared";
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
  Mail,
  MapPin,
  Phone,
  Search,
  UserRound,
} from "lucide-react";
import { useId, useMemo, useState, useSyncExternalStore } from "react";
import { Link, useNavigate } from "react-router";
import { ExamShape } from "~/components/exam-badge";
import { buttonVariants } from "~/components/ui/button";
import {
  classState,
  dayWord,
  dhakaNow,
  exactSection,
  matchSections,
  nextClass,
  routineHref,
  type RoutineDepartmentSlug,
  type RoutinePick,
  type SectionChoice,
} from "~/lib/routine";
import { cn } from "~/lib/utils";

// The Class Routine's pieces (docs/PLAN.md, decision 29), in the question bank's
// shapes: tonal tiles, filter chips, rows on a surface.

export const dayName = (day: RoutineDay) =>
  ROUTINE_DAY_NAMES[ROUTINE_DAYS.indexOf(day)]!;

/** A lab: one lab group's class, or a class in a lab room. */
export const isLab = (c: RoutineClass) =>
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
export function useDhakaNow() {
  const minute = useSyncExternalStore(
    subscribeToMinutes,
    currentMinute,
    () => null,
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

function Place({ c, className }: { c: RoutineClass; className?: string }) {
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
          {c.teacher.name ?? c.teacher.initials}
        </span>
      )}
    </span>
  );
}

/** One class: course, time, room and teacher; "Now" and "Next" on today's. */
export function ClassCard({
  c,
  section,
  state,
  minutesLeft,
}: {
  c: RoutineClass;
  section: string;
  state?: "now" | "next" | "over" | null;
  /** Until it ends (now) or starts (next). */
  minutesLeft?: number;
}) {
  return (
    <article
      className={cn(
        "grid gap-1 rounded-2xl bg-surface px-4 py-3.5",
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
      </div>
      <h3 className="text-base leading-snug font-bold">
        {c.course.title ?? c.course.code}
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
  section,
  now,
  className,
}: {
  classes: RoutineClass[];
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
 * you're in, the next one today, or (after the last, or on a day off) the next
 * class of the week. Before hydration it shows the day's outline.
 */
export function TodayCard({
  classes,
  section,
  today,
  now,
  label,
  href,
}: {
  classes: RoutineClass[];
  section: string;
  /** Today in Dhaka, as the server saw it. */
  today: RoutineDay;
  now: Now | null;
  /** Whose routine it is, e.g. "My section · 67_B1". */
  label?: string;
  /** Where "See the week" leads, on the routine's home. */
  href?: string;
}) {
  const todays = classes.filter((c) => c.day === (now?.day ?? today));
  const current = now ? todays.find((c) => classState(c, now) === "now") : null;
  const next = now ? nextClass(classes, now) : null;

  let eyebrow = `${dayName(now?.day ?? today)} · ${
    todays.length
      ? `${todays.length} class${todays.length === 1 ? "" : "es"}, ${routineTimeRange(todays[0]!.start, todays[todays.length - 1]!.end)}`
      : "no classes"
  }`;
  let headline = todays.length
    ? `${todays.length} class${todays.length === 1 ? "" : "es"} today`
    : "No classes today";
  let focus: RoutineClass | null = null;
  let detail: React.ReactNode = null;
  let after: React.ReactNode = null;

  if (now && current) {
    eyebrow = `In class now · until ${routineClockTime(current.end)}`;
    headline = current.course.title ?? current.course.code;
    focus = current;
    detail = `${routineMinutes(current.end) - now.minutes} min left`;
    if (next && next.daysAhead === 0) {
      after = `Next at ${routineClockTime(next.c.start)}: ${next.c.course.title ?? next.c.course.code}, ${next.c.room}`;
    }
  } else if (now && next && next.daysAhead === 0) {
    const wait = routineMinutes(next.c.start) - now.minutes;
    eyebrow = `Next class · in ${formatWait(wait)}`;
    headline = next.c.course.title ?? next.c.course.code;
    focus = next.c;
    detail = routineTimeRange(next.c.start, next.c.end);
  } else if (now) {
    eyebrow = dayName(now.day);
    headline = todays.length ? "Done for today" : "No classes today";
    if (next) {
      after = `${dayWord(next.c.day, next.daysAhead)} at ${routineClockTime(next.c.start)}: ${next.c.course.title ?? next.c.course.code}, ${next.c.room}`;
    }
  }

  return (
    <section
      aria-label="Today"
      className="relative overflow-hidden rounded-[1.75rem] bg-primary-container p-6 text-primary-container-foreground sm:p-7"
    >
      <ExamShape
        kind="midterm"
        colored={false}
        className="absolute -right-10 -bottom-14 size-52 rotate-12 text-primary/15"
      />
      <div className="relative space-y-3">
        <p className="text-sm font-semibold tabular-nums opacity-85">
          {label ? `${label} · ` : ""}
          {eyebrow}
        </p>
        <h2 className="font-expressive text-3xl text-balance sm:text-4xl">
          {headline}
        </h2>
        {focus && (
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
            {detail && <span className="font-semibold">{detail}</span>}
            {isLab(focus) && (
              <LabTag section={section} group={focus.labGroup} />
            )}
            <Place c={focus} className="text-inherit opacity-85" />
          </div>
        )}
        {after && <p className="text-sm opacity-85">{after}</p>}
        {href && (
          <Link
            to={href}
            prefetch="intent"
            className={cn(buttonVariants({ size: "sm" }), "mt-1")}
          >
            See the week
            <ArrowRight aria-hidden />
          </Link>
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
  slots,
  days,
  today,
  now,
}: {
  classes: RoutineClass[];
  /** The routine's time slots, in order. */
  slots: { start: string; end: string }[];
  days: RoutineDay[];
  today: RoutineDay | null;
  now: Now | null;
}) {
  const column = (time: string) => slots.findIndex((s) => s.start === time) + 2;
  const span = (c: RoutineClass) =>
    slots.findIndex((s) => s.end === c.end) -
    slots.findIndex((s) => s.start === c.start) +
    1;
  // Classes at the same time (a retake section's courses, both lab groups) go
  // in lanes, one grid row each, so none hides another.
  const layout: {
    day: RoutineDay;
    firstRow: number;
    lanes: number;
    placed: { c: RoutineClass; lane: number }[];
  }[] = [];
  let nextRow = 2;
  for (const day of days) {
    const ends: number[] = [];
    const placed: { c: RoutineClass; lane: number }[] = [];
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
                        title={[
                          c.course.title,
                          routineTimeRange(c.start, c.end),
                          c.teacher?.name,
                        ]
                          .filter(Boolean)
                          .join(" · ")}
                        className={cn(
                          "relative m-1.5 grid content-start gap-px rounded-xl px-2.5 py-2 text-xs",
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
                        <span>{c.room}</span>
                        {c.teacher && <span>{c.teacher.initials}</span>}
                        {on && <span className="sr-only">(now)</span>}
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
  classes: RoutineClass[];
  days: RoutineDay[];
  /** Each day's date this week. */
  dates: Record<RoutineDay, number>;
  section: string;
  today: RoutineDay | null;
  now: Now | null;
}) {
  const [picked, setPicked] = useState<RoutineDay | null>(null);
  const day = picked ?? today ?? days[0]!;
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
              <span
                className={cn(
                  "font-expressive text-lg tabular-nums",
                  !on && "text-foreground",
                )}
                suppressHydrationWarning
              >
                {dates[d]}
              </span>
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
  const matches = matchSections(choices, query);
  const example = ROUTINE_SECTION_EXAMPLES[department];
  const hint = `Your section, e.g. ${example.section} or ${example.group}`;
  const open = (c: SectionChoice) =>
    navigate(routineHref({ department, section: c.section, group: c.group }));

  return (
    <form
      role="search"
      className="relative"
      onSubmit={(event) => {
        event.preventDefault();
        const pick =
          exactSection(choices, query) ?? matches[active] ?? matches[0];
        if (pick) open(pick);
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
            matches.map((c, i) => (
              <li
                key={c.label}
                id={`${id}-${i}`}
                role="option"
                aria-selected={i === active}
              >
                <Link
                  to={routineHref({
                    department,
                    section: c.section,
                    group: c.group,
                  })}
                  className={cn(
                    "flex items-baseline justify-between gap-3 rounded-2xl px-4 py-2.5 hover:state-layer",
                    i === active && "state-layer",
                  )}
                >
                  <span className="font-semibold">{c.label}</span>
                  <span className="text-xs text-muted-foreground">
                    {c.group
                      ? `Lab group ${c.group} of ${c.section}`
                      : `${c.classCount} classes a week`}
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

/** A section's courses, with their teachers and classes a week. */
export function CourseList({ classes }: { classes: RoutineClass[] }) {
  const courses = [
    ...new Map(classes.map((c) => [c.course.code, c.course])).values(),
  ].map((course) => {
    const of = classes.filter((c) => c.course.code === course.code);
    return {
      ...course,
      teachers: [
        ...new Set(
          of.flatMap((c) =>
            c.teacher ? [c.teacher.name ?? c.teacher.initials] : [],
          ),
        ),
      ],
      count: of.length,
    };
  });
  return (
    <ul className="grid gap-0.5">
      {courses.map((c, i) => (
        <li
          key={c.code}
          className={cn(
            "flex items-center gap-3 bg-surface px-4 py-3",
            i === 0 && "rounded-t-2xl",
            i === courses.length - 1 && "rounded-b-2xl",
          )}
        >
          <span className="min-w-0 flex-1">
            <span className="block text-sm leading-snug font-semibold">
              {c.title ?? c.code}
            </span>
            <span className="block text-xs text-muted-foreground">
              {[
                c.title ? c.code : null,
                c.teachers.join(", "),
                `${c.count} a week`,
              ]
                .filter(Boolean)
                .join(" · ")}
            </span>
          </span>
        </li>
      ))}
    </ul>
  );
}

/**
 * A section's teachers that there's more to say about than their initials (the
 * course list already has those): a name, the room where they sit, email, phone.
 */
export function teachersOf(classes: RoutineClass[]) {
  return [
    ...new Map(
      classes.flatMap((c) =>
        c.teacher ? [[c.teacher.initials, c.teacher] as const] : [],
      ),
    ).values(),
  ].filter((t) => t.name || t.room || t.email || t.phone);
}

/** A section's teachers, with how to reach them where it's known. */
export function TeacherList({ classes }: { classes: RoutineClass[] }) {
  const teachers = teachersOf(classes).map((t) => ({
    ...t,
    courses: [
      ...new Set(
        classes
          .filter((c) => c.teacher?.initials === t.initials)
          .map((c) => c.course.code),
      ),
    ],
  }));
  if (!teachers.length) return null;
  return (
    <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {teachers.map((t) => (
        <li
          key={t.initials}
          className="grid content-start gap-1 rounded-2xl bg-surface px-4 py-3.5 text-sm"
        >
          <span className="leading-snug font-semibold">
            {t.name ?? t.initials}
            {t.name && (
              <span className="font-normal text-muted-foreground">
                {" "}
                · {t.initials}
              </span>
            )}
          </span>
          <span className="text-xs text-muted-foreground">
            {t.courses.join(", ")}
          </span>
          {(t.room || t.email || t.phone) && (
            <span className="flex flex-wrap gap-x-3 gap-y-1 pt-0.5 text-xs">
              {t.room && (
                <span className="inline-flex items-center gap-1">
                  <MapPin
                    className="size-3.5 text-muted-foreground"
                    aria-hidden
                  />
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
          )}
        </li>
      ))}
    </ul>
  );
}
