import { describe, expect, it } from "vitest";
import cases from "../test-data/name-search.json";
import { bestRank, matchRank, searchBy } from "./search";

// The cases the app runs too (apps/mobile/test/search_test.dart). JSON types each
// case by its own keys, hence the casts through unknown.
const rankCases = cases.rank as unknown as [
  string,
  string,
  number | null,
  string[]?,
][];
const orderCases = cases.order as unknown as {
  query: string;
  names: string[];
  aliases?: Record<string, string[]>;
  expected: string[];
}[];

describe("the shared name-search cases", () => {
  it.each(rankCases)("%s, %j → %s %j", (name, query, expected, aliases) => {
    expect(matchRank(name, query, aliases)).toBe(expected);
  });

  it.each(orderCases)(
    "orders $query",
    ({ query, names, aliases, expected }) => {
      expect(searchBy(names, (n) => matchRank(n, query, aliases?.[n]))).toEqual(
        expected,
      );
    },
  );
});

it("keeps the better of two ranks", () => {
  expect(bestRank(3, 1)).toBe(1);
  expect(bestRank(null, 2)).toBe(2);
  expect(bestRank(null, null)).toBeNull();
});
