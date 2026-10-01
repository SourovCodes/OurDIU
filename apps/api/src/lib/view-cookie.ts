import type { Context } from "hono";
import { getCookie, setCookie } from "hono/cookie";

/** A browser's repeat views of the same page within this window count once. */
export const VIEW_WINDOW_MS = 24 * 60 * 60 * 1000;

/** Most recent views remembered per cookie, which keeps each one under ~1.5 KB. */
export const MAX_REMEMBERED_VIEWS = 100;

/**
 * One cookie per kind of page: question pages and papers. A question page counts its
 * own view and its paper's at the same time, and each response rewrites its whole
 * cookie, so with one cookie the last response would drop the other's view.
 */
export const VIEW_COOKIES = {
  question: "qb_views_q",
  paper: "qb_views_s",
} as const;
export type ViewKind = keyof typeof VIEW_COOKIES;

const MINUTE = 60 * 1000;

/**
 * The pages of `kind` this browser was counted for in the last VIEW_WINDOW_MS, as
 * `12_<minute>.5_<minute>` (page id, then minutes since the epoch in base 36). Kept in
 * the browser rather than D1, so a repeat view costs no database write. Students
 * share a few campus IP addresses, so the browser, not the address, is the visitor.
 * Clearing the cookie only lets someone count again, which the view token and bot
 * checks on these routes are there to bound.
 */
export function readViews(c: Context, kind: ViewKind, now = Date.now()) {
  const views = new Map<number, number>();
  const cutoff = now - VIEW_WINDOW_MS;
  for (const entry of (getCookie(c, VIEW_COOKIES[kind]) ?? "").split(".")) {
    const [id, minutes] = entry.split("_");
    const at = parseInt(minutes ?? "", 36) * MINUTE;
    if (id && /^\d+$/.test(id) && at > cutoff) views.set(Number(id), at);
  }
  return views;
}

/** Remembers a counted view, dropping the oldest ones past MAX_REMEMBERED_VIEWS. */
export function rememberView(
  c: Context,
  kind: ViewKind,
  views: Map<number, number>,
  id: number,
  now = Date.now(),
) {
  views.delete(id);
  views.set(id, now);
  const value = [...views]
    .slice(-MAX_REMEMBERED_VIEWS)
    .map(([k, at]) => `${k}_${Math.floor(at / MINUTE).toString(36)}`)
    .join(".");
  setCookie(c, VIEW_COOKIES[kind], value, {
    path: "/api/v1",
    httpOnly: true,
    sameSite: "Lax",
    secure: new URL(c.req.url).protocol === "https:",
    maxAge: VIEW_WINDOW_MS / 1000,
  });
}
