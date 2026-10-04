import { describe, expect, it } from "vitest";
import { parseVoteValue, withVote } from "./engagement";
import { formatCount } from "./format";

describe("withVote", () => {
  const stats = { likeCount: 5, dislikeCount: 2 };

  it.each([
    [null, 1, { likeCount: 6, dislikeCount: 2 }],
    [null, -1, { likeCount: 5, dislikeCount: 3 }],
    [1, -1, { likeCount: 4, dislikeCount: 3 }],
    [-1, 1, { likeCount: 6, dislikeCount: 1 }],
    [1, null, { likeCount: 4, dislikeCount: 2 }],
    [1, 1, stats],
  ] as const)("moves a vote from %s to %s", (current, next, expected) => {
    expect(withVote(stats, current, next)).toEqual(expected);
  });
});

describe("parseVoteValue", () => {
  it("accepts votes and clearing, and rejects anything else", () => {
    expect(parseVoteValue("1")).toBe(1);
    expect(parseVoteValue("-1")).toBe(-1);
    expect(parseVoteValue("none")).toBeNull();
    expect(parseVoteValue("2")).toBeUndefined();
    expect(parseVoteValue(null)).toBeUndefined();
  });
});

describe("formatCount", () => {
  it("abbreviates large counts", () => {
    expect(formatCount(999)).toBe("999");
    expect(formatCount(1234)).toBe("1.2K");
  });
});
