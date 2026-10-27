import type { QuestionInteractions } from "@ourdiu/shared";
import { act, renderHook, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { setInteractions, useInteractions } from "./interactions";

const interactions = (likeCount: number): QuestionInteractions => ({
  userId: "me",
  votes: [{ submissionId: 7, value: 1 }],
  reportedSubmissionIds: [],
  saved: true,
  voteCounts: [{ submissionId: 7, likeCount, dislikeCount: 0 }],
});

afterEach(() => vi.unstubAllGlobals());

describe("useInteractions", () => {
  it("keeps an earlier visit's votes while it reads again, but not its counts", async () => {
    setInteractions(41, interactions(5));
    let answer!: (res: Response) => void;
    vi.stubGlobal(
      "fetch",
      vi.fn(() => new Promise<Response>((resolve) => (answer = resolve))),
    );

    const { result } = renderHook(() => useInteractions(41, true));
    // The page's own counts show meanwhile; the buttons keep the vote and save.
    expect(result.current).toMatchObject({
      votes: [{ submissionId: 7, value: 1 }],
      saved: true,
      voteCounts: [],
    });

    await act(async () => answer(Response.json(interactions(9))));
    await waitFor(() =>
      expect(result.current?.voteCounts).toEqual([
        { submissionId: 7, likeCount: 9, dislikeCount: 0 },
      ]),
    );
  });

  it("is null signed out, without asking", () => {
    const fetch = vi.fn();
    vi.stubGlobal("fetch", fetch);
    const { result } = renderHook(() => useInteractions(42, false));
    expect(result.current).toBeNull();
    expect(fetch).not.toHaveBeenCalled();
  });
});
