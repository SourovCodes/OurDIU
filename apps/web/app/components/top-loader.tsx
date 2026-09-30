import { useEffect, useState } from "react";
import { useNavigation } from "react-router";
import { cn } from "~/lib/utils";

/** Fast navigations finish before the bar shows, so it doesn't flash. */
const SHOW_AFTER_MS = 150;
/** How long the full bar stays before it fades out. */
const FINISH_MS = 300;

/**
 * A thin bar along the top of the page while a navigation loads (a link or a <Form>
 * that navigates; fetchers, like votes, don't count). It creeps towards 90% and
 * fills when the page is ready.
 */
export function TopLoader() {
  const busy = useNavigation().state !== "idle";
  const [shown, setShown] = useState(false);

  useEffect(() => {
    if (!busy) return;
    const timer = setTimeout(() => setShown(true), SHOW_AFTER_MS);
    return () => clearTimeout(timer);
  }, [busy]);

  // Done: the bar fills, then goes.
  useEffect(() => {
    if (busy || !shown) return;
    const timer = setTimeout(() => setShown(false), FINISH_MS);
    return () => clearTimeout(timer);
  }, [busy, shown]);

  if (!shown) return null;
  return (
    <div
      role="progressbar"
      aria-label="Loading page"
      className="pointer-events-none fixed inset-x-0 top-0 z-[100] h-0.5"
    >
      <div
        className={cn(
          "h-full bg-primary shadow-[0_0_8px_var(--color-primary)]",
          busy
            ? "animate-top-loader motion-reduce:w-full motion-reduce:animate-pulse"
            : "w-full opacity-0 transition-opacity duration-300",
        )}
      />
    </div>
  );
}
