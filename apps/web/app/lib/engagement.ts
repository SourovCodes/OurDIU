import type {
  ReportReason,
  SubmissionStats,
  ViewToken,
  VoteValue,
} from "@ourdiu/shared";
import { useEffect, useRef } from "react";

/** Shared by the report dialog and the page-level notice, which outlives the dialog. */
export const REPORT_FETCHER_KEY = "report-submission";

/** What the question page action returns for votes and reports. */
export type PaperActionResult = {
  intent: "vote" | "report" | "save";
  questionId: number;
  ok: boolean;
  error?: string;
  /** For reports: the paper reached the report threshold and is hidden now. */
  submissionHidden?: boolean;
};

export const REPORT_REASON_LABELS: Record<ReportReason, string> = {
  wrong_details: "Wrong course, semester or exam type",
  wrong_file: "Wrong or incomplete paper",
  unreadable: "Unreadable or broken file",
  duplicate: "Duplicate of another paper",
  inappropriate: "Inappropriate content",
  other: "Something else",
};

/** Reads a vote form value: "1" or "-1" to vote, "none" to clear, anything else is invalid. */
export function parseVoteValue(
  value: FormDataEntryValue | null | undefined,
): VoteValue | null | undefined {
  if (value === "1") return 1;
  if (value === "-1") return -1;
  if (value === "none") return null;
  return undefined;
}

/** The counts after the user's vote changes from `current` to `next` (optimistic UI). */
export function withVote(
  stats: Pick<SubmissionStats, "likeCount" | "dislikeCount">,
  current: VoteValue | null,
  next: VoteValue | null,
) {
  const count = (vote: VoteValue | null, value: VoteValue) =>
    vote === value ? 1 : 0;
  return {
    likeCount: stats.likeCount - count(current, 1) + count(next, 1),
    dislikeCount: stats.dislikeCount - count(current, -1) + count(next, -1),
  };
}

// Tokens last an hour (the API's VIEW_TOKEN_TTL_MS); a fresh one well before that.
const TOKEN_REUSE_MS = 50 * 60 * 1000;
const tokens = new Map<number, { at: number; token: Promise<string | null> }>();

/**
 * A token for counting views of a question, asked for by the browser: the page's
 * data is cached and shared, so a token in it would be everyone's, and the API
 * counts each token once a minute (docs/PLAN.md, decision 62).
 */
function viewToken(questionId: number) {
  const cached = tokens.get(questionId);
  if (cached && Date.now() - cached.at < TOKEN_REUSE_MS) return cached.token;
  const token = fetch(`/api/v1/questions/${questionId}/view-token`)
    .then((res) => (res.ok ? (res.json() as Promise<ViewToken>) : null))
    .then((body) => body?.viewToken ?? null)
    .catch(() => null);
  tokens.set(questionId, { at: Date.now(), token });
  return token;
}

/**
 * Counts a view by POSTing to `url` once per value (skipped while `url` is null),
 * with a view token for the question. Fire-and-forget: a failed count never
 * affects the page.
 */
export function useCountView(url: string | null, questionId: number) {
  // Also stops React's development double-run of effects from counting twice.
  const counted = useRef<string | null>(null);
  useEffect(() => {
    if (!url || counted.current === url) return;
    counted.current = url;
    void viewToken(questionId).then((token) => {
      if (!token) return;
      fetch(url, {
        method: "POST",
        headers: { "x-view-token": token },
        keepalive: true,
      }).catch(() => {});
    });
  }, [url, questionId]);
}
