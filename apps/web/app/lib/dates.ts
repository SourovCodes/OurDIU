// Fixed time zone so server and client render the same string (no hydration mismatch).
const dateFormatter = new Intl.DateTimeFormat("en", {
  dateStyle: "medium",
  timeZone: "UTC",
});

const monthFormatter = new Intl.DateTimeFormat("en", {
  month: "long",
  year: "numeric",
  timeZone: "UTC",
});

export function formatDate(iso: string) {
  return dateFormatter.format(new Date(iso));
}

/** e.g. "September 2025" */
export function formatMonth(iso: string) {
  return monthFormatter.format(new Date(iso));
}

const dayFormatter = new Intl.DateTimeFormat("en", {
  month: "short",
  day: "numeric",
  timeZone: "UTC",
});

/** e.g. "Sep 24", for a date or an ISO timestamp. */
export function formatDay(iso: string) {
  return dayFormatter.format(new Date(iso));
}

const relativeFormatter = new Intl.RelativeTimeFormat("en", {
  numeric: "auto",
});
const UNITS: [Intl.RelativeTimeFormatUnit, number][] = [
  ["year", 365 * 24 * 3600],
  ["month", 30 * 24 * 3600],
  ["week", 7 * 24 * 3600],
  ["day", 24 * 3600],
  ["hour", 3600],
  ["minute", 60],
];

/** e.g. "5 minutes ago", "yesterday", "just now". */
export function formatRelative(iso: string, now = Date.now()) {
  const seconds = Math.round((new Date(iso).getTime() - now) / 1000);
  for (const [unit, size] of UNITS) {
    if (Math.abs(seconds) >= size) {
      return relativeFormatter.format(Math.round(seconds / size), unit);
    }
  }
  return "just now";
}
