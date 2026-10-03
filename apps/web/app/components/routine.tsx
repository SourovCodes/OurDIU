import type { RoutineClass, RoutineDay } from "@ourdiu/shared";
import {
  ROUTINE_DAY_NAMES,
  ROUTINE_DAYS,
  routineClockTime,
  routineGroupLabel,
  routineMinutes,
  routineTimeRange,
} from "@ourdiu/shared/constants";
import { MapPin, Search, UserRound } from "lucide-react";
import { useId, useMemo, useState, useSyncExternalStore } from "react";
import { Link, useNavigate } from "react-router";
import {
  classState,
  dhakaNow,
  exactSection,
  matchSections,
  routineHref,
  type RoutineDepartmentSlug,
  type SectionChoice,
} from "~/lib/routine";
import { cn } from "~/lib/utils";

export const dayName = (day: RoutineDay) =>
  ROUTINE_DAY_NAMES[ROUTINE_DAYS.indexOf(day)]!;

/** A lab: one lab group's class, or a class in a lab room. */
export const isLab = (c: RoutineClass) =>
  c.labGroup !== null || c.roomType === "lab";

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

function LabTag({ section, group }: { section: string; group: string | null }) {
  return (
    <span className="rounded-md bg-exam-lab px-1.5 py-0.5 text-[0.6875rem] font-bold tracking-wide text-exam-lab-foreground uppercase">
      Lab{group ? ` · ${routineGroupLabel(section, group)}` : ""}
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
        "grid gap-1 rounded-2xl bg-surface-low px-4 py-3.5",
        state === "now" &&
          "bg-primary-container text-primary-container-foreground",
        state === "over" && "opacity-60",
      )}
    >
      <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground tabular-nums">
        {state === "now" && (
          <span className="rounded-md bg-primary px-1.5 py-0.5 text-[0.6875rem] font-bold tracking-wide text-primary-foreground uppercase">
            Now
          </span>
        )}
        {state === "next" && (
          <span className="rounded-md bg-surface-highest px-1.5 py-0.5 text-[0.6875rem] font-bold tracking-wide text-foreground uppercase">
            Next
          </span>
        )}
        <span className={cn(state === "now" && "text-inherit opacity-85")}>
          {routineTimeRange(c.start, c.end)}
          {state === "now" && minutesLeft !== undefined
            ? ` · ${minutesLeft} min left`
            : state === "next" && minutesLeft !== undefined
              ? ` · in ${formatWait(minutesLeft)}`
              : ""}
        </span>
        {isLab(c) && <LabTag section={section} group={c.labGroup} />}
      </div>
      <h3 className="text-base leading-snug font-bold">
        {c.course.title ?? c.course.code}
      </h3>
      <div
        className={cn(
          "flex flex-wrap gap-x-3 gap-y-1 text-sm text-muted-foreground",
          state === "now" && "text-inherit opacity-85",
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
            {c.teacher.initials}
          </span>
        )}
      </div>
    </article>
  );
}

function formatWait(minutes: number) {
  if (minutes < 60) return `${minutes} min`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m ? `${h} h ${m} min` : `${h} h`;
}

/** A day's classes as cards, with "Now" and "Next" when the day is today. */
export function DayClasses({
  classes,
  section,
  now,
}: {
  classes: RoutineClass[];
  section: string;
  now: ReturnType<typeof dhakaNow> | null;
}) {
  const nextIndex = now
    ? classes.findIndex((c) => classState(c, now) === "later")
    : -1;
  return (
    <div className="grid gap-2">
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
 * The week as the printed routine has it: days down, time slots across, labs over
 * two slots.
 */
export function WeekGrid({
  classes,
  slots,
  days,
  today,
}: {
  classes: RoutineClass[];
  /** The routine's time slots, in order. */
  slots: { start: string; end: string }[];
  days: RoutineDay[];
  today: RoutineDay | null;
}) {
  const column = (time: string) => slots.findIndex((s) => s.start === time) + 2;
  const span = (c: RoutineClass) =>
    slots.findIndex((s) => s.end === c.end) -
    slots.findIndex((s) => s.start === c.start) +
    1;

  return (
    <div className="overflow-x-auto rounded-2xl bg-surface-low">
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
            className="bg-surface-high px-3 py-2.5 text-xs font-semibold text-muted-foreground"
          >
            Day
          </div>
          {slots.map((s) => (
            <div
              key={s.start}
              role="columnheader"
              className="bg-surface-high px-3 py-2.5 text-xs font-semibold text-muted-foreground tabular-nums"
            >
              {routineClockTime(s.start).replace(/ [ap]m$/, "")}–
              {routineClockTime(s.end).replace(/ [ap]m$/, "")}
            </div>
          ))}
        </div>
        {days.map((day, row) => {
          const onDay = classes.filter((c) => c.day === day);
          const gridRow = row + 2;
          return (
            <div key={day} role="row" className="contents">
              <div
                role="rowheader"
                style={{ gridRow }}
                className={cn(
                  "flex flex-col justify-center border-t border-border px-3 py-3 text-sm font-bold",
                  day === today && "text-primary",
                )}
              >
                {dayName(day).slice(0, 3)}
                {day === today && (
                  <span className="text-xs font-medium">Today</span>
                )}
              </div>
              {onDay.length === 0 ? (
                <div
                  role="cell"
                  style={{ gridRow, gridColumn: `2 / -1` }}
                  className="flex items-center border-t border-border px-3 text-sm text-muted-foreground"
                >
                  No classes
                </div>
              ) : (
                <>
                  {slots.map((s, i) => (
                    <div
                      key={s.start}
                      aria-hidden
                      style={{ gridRow, gridColumn: i + 2 }}
                      className="min-h-20 border-t border-border"
                    />
                  ))}
                  {onDay.map((c) => (
                    <div
                      key={`${c.start}-${c.course.code}-${c.labGroup}`}
                      role="cell"
                      style={{
                        gridRow,
                        gridColumn: `${column(c.start)} / span ${span(c)}`,
                      }}
                      title={c.course.title ?? undefined}
                      className={cn(
                        "m-1.5 grid content-start gap-px rounded-xl px-2.5 py-2 text-xs",
                        isLab(c)
                          ? "bg-exam-lab text-exam-lab-foreground"
                          : "bg-surface-highest",
                      )}
                    >
                      <b className="text-[0.8125rem]">
                        {c.course.code}
                        {c.labGroup ? ` · ${c.labGroup}` : ""}
                      </b>
                      <span>{c.room}</span>
                      {c.teacher && <span>{c.teacher.initials}</span>}
                    </div>
                  ))}
                </>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

/** Day tabs (Sat–Thu) over the chosen day's classes, for phones; today first. */
export function DayTabs({
  classes,
  days,
  section,
  today,
  now,
}: {
  classes: RoutineClass[];
  days: RoutineDay[];
  section: string;
  today: RoutineDay | null;
  now: ReturnType<typeof dhakaNow> | null;
}) {
  const [picked, setPicked] = useState<RoutineDay | null>(null);
  const day = picked ?? today ?? days[0]!;
  const onDay = classes.filter((c) => c.day === day);
  return (
    <div className="grid gap-3">
      <div role="tablist" aria-label="Day" className="flex gap-1.5">
        {days.map((d) => {
          const has = classes.some((c) => c.day === d);
          return (
            <button
              key={d}
              type="button"
              role="tab"
              aria-selected={d === day}
              onClick={() => setPicked(d)}
              className={cn(
                "grid flex-1 justify-items-center gap-0.5 rounded-2xl bg-surface-low py-2 text-xs text-muted-foreground transition-colors hover:state-layer",
                d === day &&
                  "bg-primary text-primary-foreground hover:bg-primary",
              )}
            >
              <span className={cn("font-bold", d !== day && "text-foreground")}>
                {dayName(d).slice(0, 3)}
              </span>
              <span
                aria-hidden
                className={cn(
                  "size-1.5 rounded-full bg-current",
                  !has && "opacity-0",
                )}
              />
              {d === today && <span className="sr-only">(today)</span>}
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
          <p className="rounded-2xl bg-surface-low px-4 py-10 text-center text-muted-foreground">
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
 * The section search: suggestions as you type ("67b" finds 67_B and its lab groups);
 * Enter opens the exact match, else the first suggestion.
 */
export function SectionSearch({
  department,
  choices,
  autoFocus,
}: {
  department: RoutineDepartmentSlug;
  choices: SectionChoice[];
  autoFocus?: boolean;
}) {
  const navigate = useNavigate();
  const id = useId();
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);
  const matches = matchSections(choices, query);
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
        Your section, e.g. 67_B or 67_B1
      </label>
      <div className="flex h-14 items-center gap-3 rounded-full bg-surface-high px-5 focus-within:ring-[3px] focus-within:ring-ring/50">
        <Search className="size-5 shrink-0 text-muted-foreground" aria-hidden />
        <input
          id={`${id}-input`}
          type="search"
          role="combobox"
          aria-expanded={matches.length > 0}
          aria-controls={`${id}-list`}
          aria-activedescendant={matches.length ? `${id}-${active}` : undefined}
          autoComplete="off"
          autoCapitalize="characters"
          spellCheck={false}
          autoFocus={autoFocus}
          placeholder="Your section, e.g. 67_B or 67_B1"
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
            }
          }}
          className="h-full min-w-0 flex-1 bg-transparent text-lg outline-none placeholder:text-muted-foreground"
        />
      </div>
      {query && (
        <ul
          id={`${id}-list`}
          role="listbox"
          className="absolute inset-x-0 top-full z-20 mt-2 grid rounded-3xl bg-popover p-1.5 text-left shadow-lg"
        >
          {matches.length === 0 ? (
            <li className="px-4 py-3 text-sm text-muted-foreground">
              No section matches “{query}”.
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
