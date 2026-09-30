// Light or dark theme. With no choice made the site follows the OS; a click on the
// toggle pins the choice in a cookie. The `dark` class on <html> is owned by
// THEME_SCRIPT and setTheme, never rendered by React, so navigations can't reset it.
import { useSyncExternalStore } from "react";

const COOKIE = "ourdiu_theme";
const ONE_YEAR = 60 * 60 * 24 * 365;

export type Theme = "light" | "dark";

/**
 * Runs in <head> before the first paint, so the page never flashes the wrong theme.
 * Until a choice is saved it also follows OS changes.
 */
export const THEME_SCRIPT = `(() => {
  const root = document.documentElement;
  const saved = document.cookie.match(/(?:^|;\\s*)${COOKIE}=(light|dark)/)?.[1];
  const media = matchMedia("(prefers-color-scheme: dark)");
  const apply = () => root.classList.toggle("dark", (saved ?? (media.matches ? "dark" : "light")) === "dark");
  apply();
  if (!saved) media.addEventListener("change", () => {
    if (!/(?:^|;\\s*)${COOKIE}=/.test(document.cookie)) apply();
  });
})();`;

/** Switches the page's theme and remembers it. */
export function setTheme(theme: Theme) {
  document.documentElement.classList.toggle("dark", theme === "dark");
  document.cookie = `${COOKIE}=${theme}; Path=/; Max-Age=${ONE_YEAR}; SameSite=Lax`;
}

function subscribe(onChange: () => void) {
  const observer = new MutationObserver(onChange);
  observer.observe(document.documentElement, {
    attributes: true,
    attributeFilter: ["class"],
  });
  return () => observer.disconnect();
}

/** Whether the page is dark right now. Always false on the server. */
export function useIsDark() {
  return useSyncExternalStore(
    subscribe,
    () => document.documentElement.classList.contains("dark"),
    () => false,
  );
}
