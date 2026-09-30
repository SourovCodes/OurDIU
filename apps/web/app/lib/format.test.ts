import { describe, expect, it } from "vitest";
import { formatBytes, niceCeiling, percent } from "./format";

describe("formatBytes", () => {
  it.each([
    [0, "0 B"],
    [1023, "1023 B"],
    [1024, "1.0 KB"],
    [1536, "1.5 KB"],
    [20 * 1024 * 1024, "20 MB"],
  ])("formats %d as %s", (bytes, expected) => {
    expect(formatBytes(bytes)).toBe(expected);
  });
});

describe("niceCeiling", () => {
  it.each([
    [0, 1],
    [1, 1],
    [3, 5],
    [5, 5],
    [7, 10],
    [12, 20],
    [48, 50],
    [101, 200],
  ])("rounds %d up to %d", (value, expected) => {
    expect(niceCeiling(value)).toBe(expected);
  });
});

describe("percent", () => {
  it("rounds to whole percentages and handles an empty total", () => {
    expect(percent(1, 3)).toBe(33);
    expect(percent(2, 3)).toBe(67);
    expect(percent(0, 0)).toBe(0);
  });
});
