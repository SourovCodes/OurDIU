import { lazy, Suspense, useEffect, useEffectEvent, useState } from "react";
import { Link } from "react-router";
import { whenIdle } from "~/lib/idle";

const OPEN_EVENT = "ourdiu:course-search";
const RECENT_KEY = "ourdiu.recentCourses";
const MAX_RECENT = 5;

/** Opens the course search from anywhere in the Question Bank (a pill, a button). */
export function openCourseSearch() {
  window.dispatchEvent(new Event(OPEN_EVENT));
}

export function courseHref(id: number) {
  return `/questions/courses/${id}`;
}

// Recent courses live in this browser only, a convenience: storage may be blocked.
export function readRecent(): number[] {
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

/** The dialog's code: fetched when the browser is idle, or on first use. */
const loadDialog = () => import("~/components/course-search-dialog");
const CourseSearchDialog = lazy(loadDialog);

/**
 * Opens the course search (course-search-dialog.tsx) with "/" or Ctrl/⌘ K, or a
 * trigger. The dialog's code isn't part of the page's first load.
 */
export function CourseSearch() {
  const [open, setOpen] = useState(false);
  const [used, setUsed] = useState(false);
  const show = useEffectEvent(() => {
    setUsed(true);
    setOpen(true);
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
    const cancel = whenIdle(() => void loadDialog());
    return () => {
      window.removeEventListener(OPEN_EVENT, onOpen);
      window.removeEventListener("keydown", onKey);
      cancel();
    };
  }, []);

  return used ? (
    <Suspense>
      <CourseSearchDialog open={open} setOpen={setOpen} />
    </Suspense>
  ) : null;
}
