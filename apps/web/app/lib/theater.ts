// Theater mode on a question's page (from `lg`): the page, and so the paper and the
// lists beside it, spans the window instead of the container's widest. Like the
// theme, it's an attribute on <html> set by THEATER_SCRIPT before the first paint
// and drawn by CSS (app.css), so the server renders the same page for everyone and
// it never jumps after loading. Press `t` to toggle (YouTube-style), from `lg`.
import { useSyncExternalStore } from "react";

const COOKIE = "qb_theater";
const ONE_YEAR = 60 * 60 * 24 * 365;

/** Runs in <head>: marks <html> with `data-theater` if the visitor turned it on. */
export const THEATER_SCRIPT = `if (/(?:^|;\\s*)${COOKIE}=1(?:;|$)/.test(document.cookie)) document.documentElement.dataset.theater = "";`;

/** Turns theater mode on or off and remembers it. */
export function setTheater(on: boolean) {
  const root = document.documentElement;
  if (on) root.dataset.theater = "";
  else delete root.dataset.theater;
  document.cookie = on
    ? `${COOKIE}=1; Path=/; Max-Age=${ONE_YEAR}; SameSite=Lax`
    : `${COOKIE}=; Path=/; Max-Age=0; SameSite=Lax`;
}

function subscribe(onChange: () => void) {
  const observer = new MutationObserver(onChange);
  observer.observe(document.documentElement, {
    attributes: true,
    attributeFilter: ["data-theater"],
  });
  return () => observer.disconnect();
}

/** Whether theater mode is on. Always false on the server. */
export function useTheater() {
  return useSyncExternalStore(
    subscribe,
    () => "theater" in document.documentElement.dataset,
    () => false,
  );
}
