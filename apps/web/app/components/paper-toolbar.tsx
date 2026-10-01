import type { ReportReason, Submission, VoteValue } from "@ourdiu/shared";
import {
  MAX_REPORT_DETAILS_LENGTH,
  REPORT_REASONS,
} from "@ourdiu/shared/constants";
import {
  CircleAlert,
  CircleCheck,
  ExternalLink,
  Flag,
  ThumbsDown,
  ThumbsUp,
} from "lucide-react";
import { useId, useState } from "react";
import { Link, useFetcher, useLocation } from "react-router";
import { ContributorAvatar } from "~/components/contributor-avatar";
import { Button, buttonVariants } from "~/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "~/components/ui/dialog";
import { Alert, AlertDescription, AlertTitle } from "~/components/ui/alert";
import { Label } from "~/components/ui/label";
import { Textarea } from "~/components/ui/textarea";
import {
  parseVoteValue,
  REPORT_FETCHER_KEY,
  REPORT_REASON_LABELS,
  withVote,
  type PaperActionResult,
} from "~/lib/engagement";
import { formatCount } from "~/lib/format";
import { contributorUrl, paperDetails } from "~/lib/submissions";
import { cn } from "~/lib/utils";

/** Who is looking at the paper, which decides what they can do with it. */
export type PaperViewer =
  | { kind: "anonymous" }
  | { kind: "uploader" }
  | { kind: "member"; vote: VoteValue | null; reported: boolean };

type PaperToolbarProps = {
  submission: Submission;
  /** e.g. "Section A · Batch 61" or "By Ayesha Rahman"; shown when there's no uploader. */
  label: string;
  viewer: PaperViewer;
  /** Which of the question's papers this is, e.g. 1 of 3. */
  position: { index: number; total: number };
  /** The paper's file, for the "Full screen" button that phones get here. */
  fileUrl: string;
  className?: string;
};

const VOTES = [
  { value: 1, label: "Like", icon: ThumbsUp },
  { value: -1, label: "Dislike", icon: ThumbsDown },
] as const;

const activeVoteClass: Record<VoteValue, string> = {
  1: "bg-primary-container text-primary-container-foreground hover:bg-primary-container hover:text-primary-container-foreground",
  [-1]: "bg-destructive/15 text-destructive hover:bg-destructive/20 hover:text-destructive",
};

/** A vote, as a pill on the viewer's bar. */
const PILL =
  "h-9 min-w-9 rounded-full bg-card px-3 tabular-nums max-lg:bg-muted";

/** Report, as a round icon button; the name stays for screen readers. */
const ROUND = "size-9 rounded-full p-0 text-muted-foreground";

/** Views, likes, dislikes and reporting for the paper shown in the viewer. */
/**
 * The bar of the paper in the viewer: which paper, whose, and voting and reporting.
 * From `lg` it tops the viewer; on phones it sits at the bottom of the screen.
 */
export function PaperToolbar({
  submission,
  label,
  viewer,
  position,
  fileUrl,
  className,
}: PaperToolbarProps) {
  const location = useLocation();
  const fetcher = useFetcher<PaperActionResult>({
    key: `vote-${submission.id}`,
  });

  // Show the new vote immediately; the loader's counts catch up after revalidation.
  const current = viewer.kind === "member" ? viewer.vote : null;
  const pending = parseVoteValue(fetcher.formData?.get("value"));
  const myVote = pending === undefined ? current : pending;
  const counts = withVote(submission, current, myVote);
  const countFor = (value: VoteValue) =>
    value === 1 ? counts.likeCount : counts.dislikeCount;

  const { uploader } = submission;
  const details = paperDetails(submission);
  const loginHref = `/login?redirectTo=${encodeURIComponent(location.pathname + location.search)}`;
  const ghost = buttonVariants({ variant: "ghost", size: "sm" });
  const voteError = fetcher.data?.ok === false ? fetcher.data.error : null;

  return (
    <div
      className={cn(
        "flex flex-wrap items-center gap-x-3 gap-y-1 px-3 py-2.5 lg:border-b lg:pl-5",
        "max-lg:border-t max-lg:bg-background/95 max-lg:backdrop-blur",
        className,
      )}
    >
      {/* Which paper, then whose and how to tell it apart, in one line. */}
      <p className="flex min-w-0 flex-1 items-baseline gap-x-2 text-sm">
        <span className="shrink-0 font-semibold max-lg:hidden">
          Paper {position.index + 1} of {position.total}
        </span>
        <span className="min-w-0 truncate text-muted-foreground">
          {uploader ? (
            <>
              <span className="max-lg:hidden">by </span>
              {/* Just the avatar on phones, where the bar is narrow. */}
              <Link
                to={contributorUrl(uploader.username)}
                className="inline-flex items-center align-middle font-medium text-foreground hover:underline"
              >
                <ContributorAvatar
                  name={uploader.name}
                  image={uploader.image}
                  size="sm"
                  className="lg:hidden"
                />
                <span className="max-lg:sr-only">{uploader.name}</span>
              </Link>
              {details && <span className="max-lg:hidden"> · {details}</span>}
            </>
          ) : (
            <span title={label} className="max-lg:sr-only">
              {label}
            </span>
          )}
        </span>
      </p>

      <div className="flex items-center gap-1.5">
        {viewer.kind === "anonymous" ? (
          <>
            {VOTES.map(({ value, label: voteLabel, icon: Icon }) => (
              <Link
                key={value}
                to={loginHref}
                aria-label={`Log in to ${voteLabel.toLowerCase()} (${countFor(value)})`}
                className={cn(ghost, PILL)}
              >
                <Icon aria-hidden />
                {countFor(value) > 0 && formatCount(countFor(value))}
              </Link>
            ))}
            <Link to={loginHref} className={cn(ghost, ROUND)}>
              <Flag aria-hidden />
              <span className="sr-only">Report</span>
            </Link>
          </>
        ) : (
          <>
            <fetcher.Form method="post" className="flex items-center gap-1">
              <input type="hidden" name="intent" value="vote" />
              <input type="hidden" name="submissionId" value={submission.id} />
              {VOTES.map(({ value, label: voteLabel, icon: Icon }) => {
                const active = myVote === value;
                return (
                  <Button
                    key={value}
                    type="submit"
                    name="value"
                    // Pressing the active vote again clears it.
                    value={active ? "none" : String(value)}
                    variant="ghost"
                    size="sm"
                    aria-pressed={active}
                    aria-label={`${voteLabel} (${countFor(value)})`}
                    disabled={viewer.kind === "uploader"}
                    title={
                      viewer.kind === "uploader"
                        ? "You can’t vote on your own paper"
                        : undefined
                    }
                    className={cn(PILL, active && activeVoteClass[value])}
                  >
                    <Icon aria-hidden />
                    {/* No "0": an empty count reads as a plain button. */}
                    {countFor(value) > 0 && formatCount(countFor(value))}
                  </Button>
                );
              })}
            </fetcher.Form>
            {viewer.kind === "member" && (
              <ReportDialog
                submissionId={submission.id}
                label={label}
                reported={viewer.reported}
              />
            )}
          </>
        )}
        <a
          href={fileUrl}
          target="_blank"
          rel="noopener"
          className={cn(
            buttonVariants({ size: "sm" }),
            "ml-1 h-9 rounded-full lg:hidden",
          )}
        >
          <ExternalLink aria-hidden />
          Full screen
        </a>
      </div>

      {voteError && (
        <p role="alert" className="w-full px-1 text-xs text-destructive">
          {voteError}
        </p>
      )}
    </div>
  );
}

function ReportDialog({
  submissionId,
  label,
  reported,
}: {
  submissionId: number;
  label: string;
  reported: boolean;
}) {
  const fetcher = useFetcher<PaperActionResult>({ key: REPORT_FETCHER_KEY });
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState<ReportReason>(REPORT_REASONS[0]);
  const detailsId = useId();
  const sending =
    fetcher.state !== "idle" &&
    fetcher.formData?.get("submissionId") === String(submissionId);

  if (reported || sending) {
    return (
      <Button variant="ghost" size="sm" className={ROUND} disabled>
        <Flag aria-hidden />
        <span className="sr-only">{sending ? "Reporting…" : "Reported"}</span>
      </Button>
    );
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="ghost" size="sm" className={ROUND}>
          <Flag aria-hidden />
          <span className="sr-only">Report</span>
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Report {label.toLowerCase()}</DialogTitle>
          <DialogDescription>
            An admin reviews every report. Papers reported by several people are
            hidden until then.
          </DialogDescription>
        </DialogHeader>
        <fetcher.Form
          method="post"
          onSubmit={() => setOpen(false)}
          className="grid gap-4"
        >
          <input type="hidden" name="intent" value="report" />
          <input type="hidden" name="submissionId" value={submissionId} />
          <fieldset className="grid gap-2">
            <legend className="mb-2 text-sm font-medium">What’s wrong?</legend>
            {REPORT_REASONS.map((value) => (
              <label
                key={value}
                className="flex cursor-pointer items-center gap-3 rounded-md border px-3 py-2 text-sm transition-colors hover:bg-accent/60 has-checked:border-primary has-checked:bg-primary/5"
              >
                <input
                  type="radio"
                  name="reason"
                  value={value}
                  checked={reason === value}
                  onChange={() => setReason(value)}
                  className="accent-primary"
                />
                {REPORT_REASON_LABELS[value]}
              </label>
            ))}
          </fieldset>
          <div className="grid gap-1.5">
            <Label htmlFor={detailsId}>
              Details{" "}
              {reason !== "other" && (
                <span className="font-normal text-muted-foreground">
                  (optional)
                </span>
              )}
            </Label>
            <Textarea
              id={detailsId}
              name="details"
              rows={3}
              maxLength={MAX_REPORT_DETAILS_LENGTH}
              required={reason === "other"}
              placeholder="Tell the admin what you noticed"
            />
          </div>
          <DialogFooter>
            <DialogClose asChild>
              <Button type="button" variant="outline">
                Cancel
              </Button>
            </DialogClose>
            <Button type="submit">Send report</Button>
          </DialogFooter>
        </fetcher.Form>
      </DialogContent>
    </Dialog>
  );
}

/** The outcome of the last report on this question, shown above the viewer. */
export function ReportNotice({ questionId }: { questionId: number }) {
  const result = useFetcher<PaperActionResult>({
    key: REPORT_FETCHER_KEY,
  }).data;
  if (!result || result.questionId !== questionId) return null;

  if (!result.ok) {
    return (
      <Alert variant="destructive">
        <CircleAlert />
        <AlertTitle>Couldn’t send the report</AlertTitle>
        <AlertDescription>{result.error}</AlertDescription>
      </Alert>
    );
  }
  return (
    <Alert role="status">
      <CircleCheck />
      <AlertTitle>Thanks for the report</AlertTitle>
      <AlertDescription>
        An admin will review it.
        {result.submissionHidden &&
          " The paper is hidden until it has been reviewed."}
      </AlertDescription>
    </Alert>
  );
}
