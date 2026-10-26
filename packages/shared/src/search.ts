/**
 * The one rule for searching names (courses, departments, any picker), so every
 * search box on the site finds the same things in the same order; the API uses it
 * too. The app has the same rule (`lib/data/search.dart`); both run the cases in
 * `test-data/name-search.json`, so they can't drift apart. No Zod here: the site's
 * browser code imports it (`@ourdiu/shared/search`).
 */

const SMALL_WORDS = new Set(["and", "of", "the", "in", "for", "to"]);
const NUMERAL = /^([ivx]+|\d+)$/;

/**
 * The first letters of a name's words, the way students shorten it:
 * "Programming and Problem Solving" is "pps", "Electrical Circuits I" is "ec".
 * Small words and numbers (Roman or not) are left out.
 */
export function initials(name: string): string {
  return name
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((w) => w && !SMALL_WORDS.has(w) && !NUMERAL.test(w))
    .map((w) => w[0])
    .join("");
}

/** The typed words, lower-case. */
export function queryWords(query: string): string[] {
  return query.toLowerCase().split(/\s+/).filter(Boolean);
}

/**
 * How well a name matches what was typed, lower is better, or null for no match:
 * 0 the name starts with it ("data" → Data Structures), 1 one word that is the
 * name's initials ("pps") or what was typed is one of its short names (`aliases`,
 * lower-case: "dsa"), 2 one word that starts the initials ("pp") or what was typed
 * starts a short name ("ds" → "dsa"), 3 the name contains every typed word, in any
 * order ("struct data").
 */
export function matchRank(
  name: string,
  query: string,
  aliases: readonly string[] = [],
): number | null {
  const typed = queryWords(query);
  if (typed.length === 0) return null;
  const q = typed.join(" ");
  const lower = name.toLowerCase();
  if (lower.startsWith(q)) return 0;
  // Initials only for one word of two letters or more.
  const short = typed.length === 1 && q.length >= 2 ? initials(name) : null;
  if (short === q || aliases.includes(q)) return 1;
  if (
    q.length >= 2 &&
    (short?.startsWith(q) || aliases.some((a) => a.startsWith(q)))
  ) {
    return 2;
  }
  return typed.every((w) => lower.includes(w)) ? 3 : null;
}

/** The better of two ranks, either of which may be no match. */
export function bestRank(a: number | null, b: number | null): number | null {
  if (a === null) return b;
  if (b === null) return a;
  return Math.min(a, b);
}

/**
 * The items that match, best first; items with the same rank keep their order.
 * `rank` is usually `matchRank` on the item's name.
 */
export function searchBy<T>(items: T[], rank: (item: T) => number | null): T[] {
  return items
    .map((item, index) => ({ item, index, rank: rank(item) }))
    .filter((r): r is { item: T; index: number; rank: number } => {
      return r.rank !== null;
    })
    .sort((a, b) => a.rank - b.rank || a.index - b.index)
    .map((r) => r.item);
}
