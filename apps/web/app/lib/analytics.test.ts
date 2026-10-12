import { describe, expect, it } from "vitest";
import { shiftContext, type RouteChange } from "./analytics";

describe("shiftContext", () => {
  const changes: RouteChange[] = [
    { at: 5000, kind: "page" },
    { at: 9000, kind: "list" },
  ];

  it.each([
    [800, [], "first page, no tap"],
    [3000, [1000], "first page, 2–5 s after a tap"],
    [5200, [3800], "page change, 1–2 s after a tap"],
    [4900, [4300], "page change, 0.5–1 s after a tap"],
    [9100, [8800], "list change, under 0.5 s after a tap"],
    [7000, [800], "later on a page, over 5 s after a tap"],
    // A tap after the shift says nothing about it.
    [7000, [7100], "later on a page, no tap"],
  ])("a shift at %d ms with taps at %j: %s", (time, inputs, expected) => {
    expect(shiftContext(time, changes, inputs)).toBe(expected);
  });

  it("says nothing when web-vitals saw no shift", () => {
    expect(shiftContext(undefined, changes, [])).toBeUndefined();
  });
});
