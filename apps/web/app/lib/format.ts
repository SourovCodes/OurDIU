const UNITS = ["KB", "MB", "GB"] as const;

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  let value = bytes / 1024;
  let unit = 0;
  while (value >= 1024 && unit < UNITS.length - 1) {
    value /= 1024;
    unit++;
  }
  return `${value.toFixed(value < 10 ? 1 : 0)} ${UNITS[unit]}`;
}

const compact = new Intl.NumberFormat("en", {
  notation: "compact",
  maximumFractionDigits: 1,
});

const grouped = new Intl.NumberFormat("en");

/** Exact counts with thousands separators, e.g. 1586 → "1,586". */
export function formatNumber(count: number): string {
  return grouped.format(count);
}

/** Short counts for badges and toolbars, e.g. 1234 → "1.2K". */
export function formatCount(count: number): string {
  return compact.format(count);
}

/**
 * A round axis maximum at or above `value`: 1, 2 or 5 times a power of ten
 * (e.g. 3 → 5, 12 → 20, 0 → 1).
 */
export function niceCeiling(value: number): number {
  if (value <= 1) return 1;
  const power = 10 ** Math.floor(Math.log10(value));
  const step = [1, 2, 5, 10].find((s) => s * power >= value)!;
  return step * power;
}

/** Share of `part` in `total` as a whole percentage, 0 when there is no total. */
export function percent(part: number, total: number): number {
  return total === 0 ? 0 : Math.round((part / total) * 100);
}

/**
 * Whether a name has a word too wide for a display heading's usual size on a phone
 * (14+ letters, like "Microprocessor" or "Entrepreneurship"): such headings step
 * down a size, so the word fits whole instead of breaking.
 */
export function hasLongWord(text: string): boolean {
  return text.split(/\s+/).some((word) => word.length >= 14);
}
