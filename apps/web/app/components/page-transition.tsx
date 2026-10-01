import { useEffect, useRef } from "react";
import { useLocation, useNavigation } from "react-router";
import { cn } from "~/lib/utils";

export const MAIN_ID = "main";

/** Lets keyboard users jump past the header, the first thing they can tab to. */
export function SkipLink() {
  return (
    <a
      href={`#${MAIN_ID}`}
      className="fixed top-3 left-3 z-[110] -translate-y-20 rounded-full bg-primary px-5 py-3 text-sm font-semibold text-primary-foreground shadow-lg transition-transform focus-visible:translate-y-0 focus-visible:outline-none"
    >
      Skip to content
    </a>
  );
}

/**
 * The page in `<main>`. A new page rises in, as screens do in the app, and while
 * the next page or a filtered list loads the current one fades back, so a slow
 * connection never looks like a dead click. After a page change, screen readers
 * hear the new page's title, and focus moves to it if the clicked link is gone.
 */
export function PageTransition({
  className,
  children,
}: {
  className?: string;
  children: React.ReactNode;
}) {
  const { pathname, key } = useLocation();
  const navigation = useNavigation();
  // Loading another page or new search results; not the reload after a form posts.
  const pending = navigation.state === "loading" && !navigation.formData;
  const mainRef = useRef<HTMLElement>(null);
  const announcerRef = useRef<HTMLParagraphElement>(null);
  // The first page arrives with the HTML (its location key is "default"), so
  // only pages navigated to animate.
  const navigated = key !== "default";

  useEffect(() => {
    if (!navigated) return;
    if (announcerRef.current) announcerRef.current.textContent = document.title;
    const focused = document.activeElement;
    if (!focused || focused === document.body || !focused.isConnected) {
      mainRef.current?.focus({ preventScroll: true });
    }
    // Only when the page changes, not its search.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname]);

  return (
    <>
      <main
        ref={mainRef}
        id={MAIN_ID}
        tabIndex={-1}
        data-pending={pending || undefined}
        aria-busy={pending || undefined}
        className={cn(
          "transition-opacity duration-200 outline-none data-pending:opacity-55 data-pending:delay-150 motion-reduce:transition-none",
          className,
        )}
      >
        <div
          key={pathname}
          className={cn(navigated && "motion-safe:animate-page-in")}
        >
          {children}
        </div>
      </main>
      <p
        ref={announcerRef}
        aria-live="polite"
        aria-atomic
        className="sr-only"
      />
    </>
  );
}
