import { describe, expect, it } from "vitest";
import cases from "../../../../packages/shared/test-data/name-search.json";
import { bestRank, initials, matchRank, searchBy } from "./search";

// The cases the app runs too (apps/mobile/test/search_test.dart).
const initialsCases = cases.initials as [string, string][];
const rankCases = cases.rank as [string, string, number | null][];

describe("the shared name-search cases", () => {
  it.each(initialsCases)("%s → %s", (name, expected) => {
    expect(initials(name)).toBe(expected);
  });

  it.each(rankCases)("%s, %j → %s", (name, query, expected) => {
    expect(matchRank(name, query)).toBe(expected);
  });

  it.each(cases.order)("orders $query", ({ query, names, expected }) => {
    expect(searchBy(names, (n) => matchRank(n, query))).toEqual(expected);
  });
});

it("keeps the better of two ranks", () => {
  expect(bestRank(3, 1)).toBe(1);
  expect(bestRank(null, 2)).toBe(2);
  expect(bestRank(null, null)).toBeNull();
});
