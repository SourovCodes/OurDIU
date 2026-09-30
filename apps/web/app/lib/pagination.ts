export type PageItem = number | "ellipsis-start" | "ellipsis-end";

/**
 * The page numbers to show: always the first and last page, the current page with
 * `siblings` on each side, and an ellipsis for each gap. A gap of one page shows that
 * page instead, since an ellipsis would take the same space.
 * e.g. page 5 of 82 → 1 … 4 5 6 … 82
 */
export function pageItems(
  page: number,
  pages: number,
  siblings = 1,
): PageItem[] {
  // First, last, current, siblings and two ellipses: fewer pages than that fit whole.
  if (pages <= 2 * siblings + 5) {
    return Array.from({ length: pages }, (_, i) => i + 1);
  }

  const range = (from: number, to: number) =>
    Array.from({ length: to - from + 1 }, (_, i) => from + i);
  // Near an end, run straight to it: the same number of items, no one-page gap.
  const edge = 2 * siblings + 3;
  if (page <= siblings + 3) {
    return [...range(1, edge), "ellipsis-end", pages];
  }
  if (page >= pages - siblings - 2) {
    return [1, "ellipsis-start", ...range(pages - edge + 1, pages)];
  }
  return [
    1,
    "ellipsis-start",
    ...range(page - siblings, page + siblings),
    "ellipsis-end",
    pages,
  ];
}
