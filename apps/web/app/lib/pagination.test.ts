import { describe, expect, it } from "vitest";
import { pageItems } from "./pagination";

describe("pageItems", () => {
  it.each([
    [1, 1, [1]],
    [3, 7, [1, 2, 3, 4, 5, 6, 7]],
    [1, 82, [1, 2, 3, 4, 5, "ellipsis-end", 82]],
    [4, 82, [1, 2, 3, 4, 5, "ellipsis-end", 82]],
    [5, 82, [1, "ellipsis-start", 4, 5, 6, "ellipsis-end", 82]],
    [79, 82, [1, "ellipsis-start", 78, 79, 80, 81, 82]],
    [82, 82, [1, "ellipsis-start", 78, 79, 80, 81, 82]],
  ] as const)("page %i of %i", (page, pages, expected) => {
    expect(pageItems(page, pages)).toEqual(expected);
  });

  it("always shows the same number of items once there are enough pages", () => {
    for (let page = 1; page <= 40; page++) {
      expect(pageItems(page, 40)).toHaveLength(7);
    }
  });
});
