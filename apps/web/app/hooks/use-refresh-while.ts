import { useEffect } from "react";
import { useRevalidator } from "react-router";

/**
 * Reloads the page's data every few seconds while `active`, e.g. while the AI is
 * still checking a paper. Skips hidden tabs and overlapping reloads.
 */
export function useRefreshWhile(active: boolean, intervalMs = 5000) {
  const { revalidate, state } = useRevalidator();
  useEffect(() => {
    if (!active) return;
    const timer = setInterval(() => {
      if (state === "idle" && document.visibilityState === "visible") {
        void revalidate();
      }
    }, intervalMs);
    return () => clearInterval(timer);
  }, [active, intervalMs, revalidate, state]);
}
