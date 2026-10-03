import { MIN_SEARCH_LENGTH } from "@ourdiu/shared/constants";
import { History, Loader2, ScrollText, SearchIcon } from "lucide-react";
import { useEffect, useEffectEvent, useMemo, useRef, useState } from "react";
import { Link, useFetcher, useNavigate } from "react-router";
import { Command as CommandPrimitive } from "cmdk";
import {
  Command,
  CommandGroup,
  CommandItem,
  CommandList,
} from "~/components/ui/command";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "~/components/ui/dialog";
import { highlightParts, searchCourses, type CourseEntry } from "~/lib/courses";
import { cn } from "~/lib/utils";

const OPEN_EVENT = "ourdiu:course-search";
const RECENT_KEY = "ourdiu.recentCourses";
const MAX_RECENT = 5;
const MAX_RESULTS = 50;

/** Opens the course search from anywhere in the Question Bank (a pill, a button). */
export function openCourseSearch() {
  window.dispatchEvent(new Event(OPEN_EVENT));
}

export function courseHref(id: number) {
  return `/questions/courses/${id}`;
}

// Recent courses live in this browser only, a convenience: storage may be blocked.
function readRecent(): number[] {
  try {
    const value: unknown = JSON.parse(localStorage.getItem(RECENT_KEY) ?? "[]");
    return Array.isArray(value)
      ? value.filter((id): id is number => Number.isInteger(id))
      : [];
  } catch {
    return [];
  }
}

/** Remembers a course the visitor opened, for the search's "Recent" list. */
export function rememberCourse(id: number) {
  try {
    const next = [id, ...readRecent().filter((r) => r !== id)].slice(
      0,
      MAX_RECENT,
    );
    localStorage.setItem(RECENT_KEY, JSON.stringify(next));
  } catch {
    // Not remembered; nothing else depends on it.
  }
}

function typingIn(target: EventTarget | null) {
  return (
    target instanceof HTMLElement &&
    (target.isContentEditable ||
      ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName))
  );
}

/**
 * A link that opens the course search, styled by the caller. Before the page has
 * hydrated (or without JavaScript) it simply goes to the browse page.
 */
export function CourseSearchTrigger({
  className,
  children,
  "aria-label": ariaLabel,
}: {
  className?: string;
  children: React.ReactNode;
  "aria-label"?: string;
}) {
  return (
    <Link
      to="/questions/browse"
      aria-label={ariaLabel}
      aria-haspopup="dialog"
      className={className}
      onClick={(event) => {
        event.preventDefault();
        openCourseSearch();
      }}
    >
      {children}
    </Link>
  );
}

/**
 * Search every course by name, as in the app: every typed word must match, names
 * that start with the query first. Opened with "/" or Ctrl/⌘ K, or a trigger. The
 * course list is loaded the first time it opens.
 */
export function CourseSearch() {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [recent, setRecent] = useState<number[]>([]);
  const fetcher = useFetcher<CourseEntry[]>();
  const navigate = useNavigate();

  const { load, data } = fetcher;
  const requested = useRef(false);
  const show = useEffectEvent(() => {
    setRecent(readRecent());
    setOpen(true);
    // Once per page load; the list is the same for everyone and cached for a minute.
    if (!requested.current) {
      requested.current = true;
      void load("/questions/search-index");
    }
  });

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const shortcut =
        (event.key === "k" && (event.metaKey || event.ctrlKey)) ||
        (event.key === "/" &&
          !event.metaKey &&
          !event.ctrlKey &&
          !typingIn(event.target));
      if (!shortcut) return;
      event.preventDefault();
      show();
    };
    const onOpen = () => show();
    window.addEventListener(OPEN_EVENT, onOpen);
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener(OPEN_EVENT, onOpen);
      window.removeEventListener("keydown", onKey);
    };
  }, []);

  const courses = useMemo(() => data ?? [], [data]);
  const results = useMemo(
    () => searchCourses(courses, query).slice(0, MAX_RESULTS),
    [courses, query],
  );
  const recentCourses = useMemo(
    () => recent.flatMap((id) => courses.find((c) => c.id === id) ?? []),
    [recent, courses],
  );

  function searchPapers() {
    setOpen(false);
    navigate(`/questions/search?${new URLSearchParams({ q: query.trim() })}`);
    setQuery("");
  }

  function choose(course: CourseEntry) {
    rememberCourse(course.id);
    setOpen(false);
    setQuery("");
    navigate(courseHref(course.id));
  }

  const loading = !data;
  const typed = query.trim() !== "";
  const searchable = query.trim().length >= MIN_SEARCH_LENGTH;

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) setQuery("");
      }}
    >
      <DialogContent
        showCloseButton={false}
        className="top-[12dvh] translate-y-0 gap-0 overflow-hidden rounded-3xl p-0 sm:max-w-xl"
      >
        <DialogTitle className="sr-only">Search courses</DialogTitle>
        <DialogDescription className="sr-only">
          Type a course name to find its past papers.
        </DialogDescription>
        <Command shouldFilter={false} className="rounded-none bg-transparent">
          <div className="flex h-14 items-center gap-3 border-b px-4">
            <SearchIcon className="size-5 shrink-0 text-primary" aria-hidden />
            <CommandPrimitive.Input
              value={query}
              onValueChange={setQuery}
              placeholder="Search a course, like Data Structure"
              className="h-full flex-1 bg-transparent text-base outline-hidden placeholder:text-muted-foreground"
            />
            {loading && (
              <Loader2
                className="size-4 animate-spin text-muted-foreground"
                aria-label="Loading courses"
              />
            )}
            <kbd className="hidden rounded-md border px-1.5 py-0.5 font-sans text-xs text-muted-foreground sm:inline">
              Esc
            </kbd>
          </div>
          <CommandList className="max-h-[min(60dvh,26rem)] p-2">
            {/* Not cmdk's Empty: the papers' search below is an item too. */}
            {typed && !loading && results.length === 0 && (
              <p className="px-4 py-8 text-center text-sm text-muted-foreground">
                No course matches “{query.trim()}”. Check the spelling, or try
                fewer words.
              </p>
            )}
            {typed ? (
              results.length > 0 && (
                <CommandGroup
                  heading={`${results.length}${results.length === MAX_RESULTS ? "+" : ""} ${results.length === 1 ? "course" : "courses"}`}
                >
                  {results.map((course) => (
                    <CourseItem
                      key={course.id}
                      course={course}
                      query={query}
                      onSelect={() => choose(course)}
                    />
                  ))}
                </CommandGroup>
              )
            ) : recentCourses.length > 0 ? (
              <CommandGroup heading="Recent">
                {recentCourses.map((course) => (
                  <CourseItem
                    key={course.id}
                    course={course}
                    query=""
                    recent
                    onSelect={() => choose(course)}
                  />
                ))}
              </CommandGroup>
            ) : (
              <p className="px-4 py-8 text-center text-sm text-muted-foreground">
                Every course from every department. Type part of its name.
              </p>
            )}
            {searchable && (
              <CommandGroup heading="Inside papers">
                <CommandItem
                  value="search-papers"
                  onSelect={searchPapers}
                  className="gap-3 rounded-xl px-2.5 py-2.5"
                >
                  <span className="flex h-8 w-12 shrink-0 items-center justify-center rounded-lg bg-surface-high">
                    <ScrollText className="size-4 text-primary" aria-hidden />
                  </span>
                  <span className="min-w-0 flex-1 truncate text-[0.9375rem]">
                    Find “{query.trim()}” in papers’ text
                  </span>
                </CommandItem>
              </CommandGroup>
            )}
          </CommandList>
          <div className="hidden items-center justify-end gap-3 border-t px-4 py-2.5 text-xs text-muted-foreground sm:flex">
            <span>↑ ↓ to move</span>
            <span>↵ to open</span>
          </div>
        </Command>
      </DialogContent>
    </Dialog>
  );
}

function CourseItem({
  course,
  query,
  recent = false,
  onSelect,
}: {
  course: CourseEntry;
  query: string;
  recent?: boolean;
  onSelect: () => void;
}) {
  return (
    <CommandItem
      value={String(course.id)}
      onSelect={onSelect}
      className="gap-3 rounded-xl px-2.5 py-2.5"
    >
      <span className="flex h-8 w-12 shrink-0 items-center justify-center rounded-lg bg-primary-container text-xs font-bold text-primary-container-foreground">
        {course.departmentShortName}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-[0.9375rem]">
          {highlightParts(course.name, query).map((part, i) => (
            <span
              key={i}
              className={cn(part.match && "font-bold text-primary")}
            >
              {part.text}
            </span>
          ))}
        </span>
        <span className="block truncate text-xs text-muted-foreground">
          {course.departmentName}
        </span>
      </span>
      {recent && <History className="text-muted-foreground" aria-hidden />}
    </CommandItem>
  );
}
