/**
 * Runs `task` once the page has loaded and the browser is idle: for code that
 * isn't needed to show the page, like the menus' (docs/PLAN.md, decision 47).
 * Returns a function that cancels it.
 */
export function whenIdle(task: () => void) {
  let cancelled = false;
  let idleId: number | undefined;
  const run = () => {
    if (cancelled) return;
    // Safari has no requestIdleCallback.
    idleId =
      typeof requestIdleCallback === "function"
        ? requestIdleCallback(task)
        : window.setTimeout(task, 1);
  };
  if (document.readyState === "complete") run();
  else window.addEventListener("load", run, { once: true });
  return () => {
    cancelled = true;
    window.removeEventListener("load", run);
    if (idleId === undefined) return;
    if (typeof cancelIdleCallback === "function") cancelIdleCallback(idleId);
    else clearTimeout(idleId);
  };
}
