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
import { loginHref } from "~/lib/redirect";

/** Who is looking at the paper, which decides what they can do with it. */
export type PaperViewer =
  | { kind: "anonymous" }
  | { kind: "uploader" }
  | { kind: "member"; vote: VoteValue | null; reported: boolean };

type PaperProps = {
  submission: Submission;
  /** e.g. "Section A · Batch 61" or "By Ayesha Rahman"; shown when there's no uploader. */
  label: string;
  viewer: PaperViewer;
};

const VOTES = [
  { value: 1, label: "Like", icon: ThumbsUp },
  { value: -1, label: "Dislike", icon: ThumbsDown },
] as const;

const activeVoteClass: Record<VoteValue, string> = {
  1: "bg-primary-container text-primary-container-foreground hover:bg-primary-container hover:text-primary-container-foreground",
  [-1]: "bg-destructive/15 text-destructive hover:bg-destructive/20 hover:text-destructive",
};

/** A vote, as a pill. */
const PILL = "h-10 min-w-10 rounded-full bg-card px-3.5 tabular-nums";

/** Report, as a round icon button; the name stays for screen readers. */
const ROUND = "size-10 rounded-full p-0 text-muted-foreground";

/**
 * Like and dislike. Visitors are asked to log in; the uploader can't vote on their
 * own paper. The new vote shows straight away; the counts catch up after revalidation.
 */
function VoteButtons({ submission, viewer }: Omit<PaperProps, "label">) {
  const location = useLocation();
  const fetcher = useFetcher<PaperActionResult>({
    key: `vote-${submission.id}`,
  });
  const current = viewer.kind === "member" ? viewer.vote : null;
  const pending = parseVoteValue(fetcher.formData?.get("value"));
  const myVote = pending === undefined ? current : pending;
  const counts = withVote(submission, current, myVote);
  const countFor = (value: VoteValue) =>
    value === 1 ? counts.likeCount : counts.dislikeCount;
  const ghost = buttonVariants({ variant: "ghost", size: "sm" });
  const voteError = fetcher.data?.ok === false ? fetcher.data.error : null;

  return (
    <>
      {viewer.kind === "anonymous" ? (
        <div className="flex items-center gap-1.5">
          {VOTES.map(({ value, label: voteLabel, icon: Icon }) => (
            <Link
              key={value}
              to={loginHref(location)}
              aria-label={`Log in to ${voteLabel.toLowerCase()} (${countFor(value)})`}
              className={cn(ghost, PILL)}
            >
              <Icon aria-hidden />
              {countFor(value) > 0 && formatCount(countFor(value))}
            </Link>
          ))}
        </div>
      ) : (
        <fetcher.Form method="post" className="flex items-center gap-1.5">
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
                <Icon
                  key={String(active)}
                  className={cn(
                    active &&
                      (fetcher.formData ?? fetcher.data) &&
                      "motion-safe:animate-pop",
                  )}
                  aria-hidden
                />
                {/* No "0": an empty count reads as a plain button. */}
                {countFor(value) > 0 && formatCount(countFor(value))}
              </Button>
            );
          })}
        </fetcher.Form>
      )}
      {voteError && (
        <p role="alert" className="w-full text-xs text-destructive">
          {voteError}
        </p>
      )}
    </>
  );
}

/** Reporting: a round icon on the phone bar, a line of text beside the paper. */
function ReportControl({
  submission,
  label,
  viewer,
  text = false,
}: PaperProps & { text?: boolean }) {
  const location = useLocation();
  if (viewer.kind === "uploader") return null;
  const name = text ? "Report a problem with this paper" : "Report";
  const className = text
    ? "inline-flex items-center gap-2 rounded-full px-2 py-1.5 text-sm text-muted-foreground hover:text-foreground"
    : cn(buttonVariants({ variant: "ghost", size: "sm" }), ROUND);
  if (viewer.kind === "anonymous") {
    return (
      <Link to={loginHref(location)} className={className}>
        <Flag className="size-4" aria-hidden />
        <span className={cn(!text && "sr-only")}>{name}</span>
      </Link>
    );
  }
  return (
    <ReportDialog
      submissionId={submission.id}
      label={label}
      reported={viewer.reported}
      name={name}
      text={text}
      className={className}
    />
  );
}

/**
 * Above the paper from `lg`: whose it is and how to tell it apart, and which of
 * the question's papers it is.
 */
export function PaperInfo({
  submission,
  label,
  position,
  className,
}: {
  submission: Submission;
  label: string;
  position: { index: number; total: number };
  className?: string;
}) {
  const { uploader } = submission;
  const details = paperDetails(submission);
  return (
    <div
      className={cn(
        "flex items-center justify-between gap-3 px-5 pt-4 pb-3 text-sm",
        className,
      )}
    >
      <p className="min-w-0 truncate text-muted-foreground">
        {uploader ? (
          <>
            {details && `${details} · `}shared by{" "}
            <Link
              to={contributorUrl(uploader.username)}
              className="font-medium text-foreground hover:underline"
            >
              {uploader.name}
            </Link>
          </>
        ) : (
          label
        )}
      </p>
      {position.total > 1 && (
        <span className="shrink-0 rounded-full bg-card px-3 py-1 text-xs font-medium">
          Paper {position.index + 1} of {position.total}
        </span>
      )}
    </div>
  );
}

/** Beside the paper from `lg`: "Was this paper useful?" and reporting. */
export function PaperFeedback({ submission, label, viewer }: PaperProps) {
  return (
    <div className="space-y-3">
      <section
        aria-label="Feedback"
        className="flex flex-wrap items-center justify-between gap-3 rounded-3xl bg-surface py-3 pr-3 pl-5"
      >
        <h2 className="text-sm font-semibold">Was this paper useful?</h2>
        <VoteButtons submission={submission} viewer={viewer} />
      </section>
      <ReportControl
        submission={submission}
        label={label}
        viewer={viewer}
        text
      />
    </div>
  );
}

/**
 * On phones, a bar at the bottom of the screen while the paper is in view: whose it
 * is (their avatar), voting, reporting and full screen.
 */
export function PaperToolbar({
  submission,
  label,
  viewer,
  fileUrl,
  className,
}: PaperProps & { fileUrl: string; className?: string }) {
  const { uploader } = submission;
  return (
    <div
      className={cn(
        "flex items-center gap-x-1.5 border-t bg-background/95 px-3 py-2.5 backdrop-blur [&_[data-slot=button]]:bg-surface",
        className,
      )}
    >
      {uploader && (
        <Link
          to={contributorUrl(uploader.username)}
          className="mr-auto inline-flex items-center"
        >
          <ContributorAvatar
            name={uploader.name}
            image={uploader.image}
            size="sm"
          />
          <span className="sr-only">{uploader.name}</span>
        </Link>
      )}
      <div className={cn("flex items-center gap-1.5", !uploader && "mr-auto")}>
        <VoteButtons submission={submission} viewer={viewer} />
      </div>
      <ReportControl submission={submission} label={label} viewer={viewer} />
      <a
        href={fileUrl}
        target="_blank"
        rel="noopener"
        aria-label="Full screen"
        className={cn(
          buttonVariants(),
          "ml-1 max-[399px]:size-10 max-[399px]:p-0",
        )}
      >
        <ExternalLink aria-hidden />
        {/* Just the icon on the narrowest phones, so the bar stays one row. */}
        <span className="max-[399px]:sr-only">Full screen</span>
      </a>
    </div>
  );
}

function ReportDialog({
  submissionId,
  label,
  reported,
  name,
  text,
  className,
}: {
  submissionId: number;
  label: string;
  reported: boolean;
  name: string;
  text: boolean;
  className: string;
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
      <button type="button" className={cn(className, "opacity-60")} disabled>
        <Flag className="size-4" aria-hidden />
        <span className={cn(!text && "sr-only")}>
          {sending ? "Reporting…" : "Reported"}
        </span>
      </button>
    );
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <button type="button" className={className}>
          <Flag className="size-4" aria-hidden />
          <span className={cn(!text && "sr-only")}>{name}</span>
        </button>
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
                className="flex min-h-11 cursor-pointer items-center gap-3 rounded-2xl border border-input px-4 py-2 text-sm transition-colors hover:state-layer has-checked:border-primary-container has-checked:bg-primary-container has-checked:text-primary-container-foreground has-focus-visible:ring-[3px] has-focus-visible:ring-ring/50"
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
