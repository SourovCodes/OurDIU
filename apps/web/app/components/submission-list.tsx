import type { Submission } from "@ourdiu/shared";
import { ChevronDown, Eye, FileText, ThumbsDown, ThumbsUp } from "lucide-react";
import { Link } from "react-router";
import { StatusBadge } from "~/components/status-badge";
import { formatDate } from "~/lib/dates";
import { formatCount } from "~/lib/format";
import { paperTitles } from "~/lib/submissions";
import { cn } from "~/lib/utils";

type SubmissionListProps = {
  /** Already ranked by the API: best-rated published papers first. */
  submissions: Submission[];
  selectedId: number | null;
};

function Stat({
  icon: Icon,
  value,
  label,
}: {
  icon: typeof Eye;
  value: number;
  label: string;
}) {
  return (
    <span className="inline-flex items-center gap-0.5 tabular-nums">
      <Icon className="size-3" aria-hidden />
      {formatCount(value)}
      <span className="sr-only"> {label}</span>
    </span>
  );
}

export function SubmissionList({
  submissions,
  selectedId,
}: SubmissionListProps) {
  const published = submissions.filter((s) => s.status === "published");
  const titles = paperTitles(published);
  const pendingCount = submissions.filter(
    (s) => s.status === "pending_review",
  ).length;

  return (
    <section
      aria-labelledby="papers-heading"
      className="rounded-3xl bg-surface p-2"
    >
      <div className="px-3 pt-3 pb-2">
        <h2 id="papers-heading" className="font-expressive text-lg">
          {published.length === 1
            ? "1 copy of this exam"
            : `${formatCount(published.length)} copies of this exam`}
        </h2>
        {published.length > 1 && (
          <p className="text-xs text-muted-foreground">
            Shared by different students, best rated first.
          </p>
        )}
      </div>

      <ul aria-label="Papers" className="grid grid-cols-1 gap-0.5">
        {submissions.map((submission) => {
          if (submission.status === "published") {
            const active = submission.id === selectedId;
            const title = titles.get(submission.id)!;
            const { uploader } = submission;
            // The title names the uploader when there's no section or batch.
            const byLine =
              uploader && !title.includes(uploader.name) ? uploader.name : null;
            return (
              <li key={submission.id}>
                {/* Links (not buttons) so switching works without JS and is shareable. */}
                <Link
                  to={`?submission=${encodeURIComponent(submission.id)}`}
                  replace
                  preventScrollReset
                  aria-current={active ? "true" : undefined}
                  className={cn(
                    "flex items-center gap-3 rounded-2xl px-3 py-2.5 text-sm transition-colors hover:bg-surface-high focus-visible:bg-surface-high focus-visible:outline-none",
                    active && "bg-card shadow-xs hover:bg-card",
                  )}
                >
                  <span
                    aria-hidden
                    className={cn(
                      "flex size-8 shrink-0 items-center justify-center rounded-full text-xs font-bold",
                      active
                        ? "bg-primary text-primary-foreground"
                        : "bg-primary-container text-primary-container-foreground",
                    )}
                  >
                    {published.indexOf(submission) + 1}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-semibold">
                      {title}
                    </span>
                    <span className="flex flex-wrap items-center gap-x-1.5 text-xs text-muted-foreground">
                      {byLine && (
                        <>
                          <span className="max-w-full truncate">{byLine}</span>
                          <span aria-hidden>·</span>
                        </>
                      )}
                      <Stat
                        icon={Eye}
                        value={submission.viewCount}
                        label="views"
                      />
                      {/* Votes only once there are some: rows of zeros are noise. */}
                      {submission.likeCount > 0 && (
                        <Stat
                          icon={ThumbsUp}
                          value={submission.likeCount}
                          label="likes"
                        />
                      )}
                      {submission.dislikeCount > 0 && (
                        <Stat
                          icon={ThumbsDown}
                          value={submission.dislikeCount}
                          label="dislikes"
                        />
                      )}
                      <span aria-hidden>·</span>
                      <span>{formatDate(submission.createdAt)}</span>
                    </span>
                  </span>
                </Link>
              </li>
            );
          }

          return (
            <li
              key={submission.id}
              className="flex items-center gap-3 px-3 py-2 text-sm"
            >
              <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-surface-high">
                <FileText
                  className="size-4 text-muted-foreground"
                  aria-hidden
                />
              </span>
              <span className="min-w-0 flex-1 text-xs text-muted-foreground">
                Submitted {formatDate(submission.createdAt)}
              </span>
              <StatusBadge status={submission.status} />
            </li>
          );
        })}
      </ul>

      {pendingCount > 0 && (
        <p className="px-3 pt-2 pb-2 text-xs text-muted-foreground">
          {pendingCount === 1
            ? "1 more is waiting for review."
            : `${pendingCount} more are waiting for review.`}{" "}
          Papers under review become viewable once an admin approves them.
        </p>
      )}
    </section>
  );
}

/**
 * On small screens, where the full list sits below the viewer: "Paper 1 of 3",
 * whose it is, and a disclosure listing the others. A native <details> of links,
 * so switching works without JS.
 */
export function PaperSwitcher({
  submissions,
  selectedId,
}: SubmissionListProps) {
  const published = submissions.filter((s) => s.status === "published");
  if (published.length < 2) return null;
  const titles = paperTitles(published);
  const index = Math.max(
    0,
    published.findIndex((s) => s.id === selectedId),
  );
  const selected = published[index]!;

  return (
    <details className="group rounded-3xl bg-muted lg:hidden">
      <summary className="flex min-h-13 cursor-pointer list-none items-center gap-3 rounded-3xl py-2 pr-4 pl-2 [&::-webkit-details-marker]:hidden">
        <span
          aria-hidden
          className="flex size-9 shrink-0 items-center justify-center rounded-full bg-primary text-sm font-bold text-primary-foreground"
        >
          {index + 1}
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-sm font-semibold">
            Paper {index + 1} of {published.length}
          </span>
          <span className="block truncate text-xs text-muted-foreground">
            {titles.get(selected.id)}
          </span>
        </span>
        <span className="flex items-center gap-1 text-sm font-semibold text-primary">
          Switch
          <ChevronDown
            className="size-4 transition-transform group-open:rotate-180"
            aria-hidden
          />
        </span>
      </summary>
      <nav aria-label="Switch paper" className="px-2 pb-2">
        <ul aria-label="Papers" className="grid gap-0.5">
          {published.map((submission, i) => {
            const active = submission.id === selectedId;
            return (
              <li key={submission.id}>
                <Link
                  to={`?submission=${encodeURIComponent(submission.id)}`}
                  replace
                  preventScrollReset
                  aria-current={active ? "true" : undefined}
                  onClick={(event) =>
                    event.currentTarget
                      .closest("details")
                      ?.removeAttribute("open")
                  }
                  className={cn(
                    "flex min-h-11 items-center gap-3 rounded-2xl px-3 py-2 text-sm transition-colors hover:bg-accent",
                    active &&
                      "bg-primary-container text-primary-container-foreground hover:bg-primary-container",
                  )}
                >
                  <span className="w-5 text-center text-xs font-semibold text-muted-foreground tabular-nums">
                    {i + 1}
                  </span>
                  <span className="min-w-0 flex-1 truncate font-medium">
                    {titles.get(submission.id)}
                  </span>
                  <Stat icon={Eye} value={submission.viewCount} label="views" />
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>
    </details>
  );
}
