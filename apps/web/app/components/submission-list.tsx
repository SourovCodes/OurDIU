import type { Submission } from "@ourdiu/shared";
import { ChevronDown, ThumbsDown, ThumbsUp } from "lucide-react";
import { Link } from "react-router";
import { formatDate } from "~/lib/dates";
import { formatCount } from "~/lib/format";
import { paperTitles, paperVersions } from "~/lib/submissions";
import { cn } from "~/lib/utils";

type SubmissionListProps = {
  /**
   * Already ranked by the API: the best copy of each version of the exam, then the
   * other copies.
   */
  submissions: Submission[];
  selectedId: number | null;
};

function Stat({
  icon: Icon,
  value,
  label,
}: {
  icon: typeof ThumbsUp;
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

/** One paper in the list: its number, title, who shared it, votes and date. */
function PaperRow({
  submission,
  number,
  title,
  active,
}: {
  submission: Submission;
  number: number;
  title: string;
  active: boolean;
}) {
  const { uploader } = submission;
  // The title names the uploader when there's no section or batch.
  const byLine =
    uploader && !title.includes(uploader.name) ? uploader.name : null;
  return (
    <li>
      {/* Links (not buttons) so switching works without JS and is shareable. */}
      <Link
        to={`?submission=${encodeURIComponent(submission.id)}`}
        replace
        preventScrollReset
        aria-current={active ? "true" : undefined}
        className={cn(
          "flex items-center gap-3 rounded-2xl px-3 py-2.5 text-sm transition-colors hover:state-layer focus-visible:state-layer focus-visible:outline-none",
          active && "bg-card shadow-xs",
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
          {number}
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate font-semibold">{title}</span>
          <span className="flex flex-wrap items-center gap-x-1.5 text-xs text-muted-foreground">
            {[
              byLine && (
                <span key="by" className="max-w-full truncate">
                  {byLine}
                </span>
              ),
              // Votes only once there are some: rows of zeros are noise.
              (submission.likeCount > 0 || submission.dislikeCount > 0) && (
                <span key="votes" className="flex gap-x-1.5">
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
                </span>
              ),
              <span key="date">{formatDate(submission.createdAt)}</span>,
            ]
              .filter(Boolean)
              .flatMap((part, n) =>
                n === 0
                  ? [part]
                  : [
                      <span key={`dot-${n}`} aria-hidden>
                        ·
                      </span>,
                      part,
                    ],
              )}
          </span>
        </span>
      </Link>
    </li>
  );
}

export function SubmissionList({
  submissions,
  selectedId,
}: SubmissionListProps) {
  const published = submissions.filter((s) => s.status === "published");
  const titles = paperTitles(published);
  const versions = paperVersions(published);
  const pendingCount = submissions.filter(
    (s) => s.status === "pending_review",
  ).length;
  const row = (submission: Submission) => (
    <PaperRow
      key={submission.id}
      submission={submission}
      number={published.indexOf(submission) + 1}
      title={titles.get(submission.id)!}
      active={submission.id === selectedId}
    />
  );

  return (
    <section
      aria-labelledby="papers-heading"
      className="rounded-3xl bg-surface p-2"
    >
      <div className="px-3 pt-3 pb-2">
        <h2 id="papers-heading" className="font-expressive text-lg">
          {versions.length > 1
            ? `${versions.length} versions of this exam`
            : published.length === 1
              ? "1 copy of this exam"
              : `${formatCount(published.length)} copies of this exam`}
        </h2>
        {versions.length > 1 ? (
          <p className="text-xs text-muted-foreground">
            Not everyone got the same questions. The best copy of each comes
            first.
          </p>
        ) : (
          published.length > 1 && (
            <p className="text-xs text-muted-foreground">
              Shared by different students, the clearest first.
            </p>
          )
        )}
      </div>

      {/* Only published copies: rejected ones aren't anyone's business, and
          the ones under review get the count below. */}
      {versions.length > 1 ? (
        // Each version's best copy; its other copies folded under it.
        <div className="grid grid-cols-1 gap-2">
          {versions.map(({ label, copies: [best, ...others] }, i) => (
            <section key={best!.id} aria-label={label ?? `Version ${i + 1}`}>
              <h3 className="px-3 pt-1 pb-1 text-xs font-semibold text-muted-foreground">
                {label ?? `Version ${i + 1}`}
              </h3>
              <ul aria-label="Papers" className="grid grid-cols-1 gap-0.5">
                {row(best!)}
              </ul>
              {others.length > 0 && (
                <details
                  className="group"
                  open={others.some((s) => s.id === selectedId) || undefined}
                >
                  <summary className="flex cursor-pointer list-none items-center gap-1 rounded-2xl py-2 pr-3 pl-14 text-xs font-medium text-muted-foreground hover:state-layer [&::-webkit-details-marker]:hidden">
                    {others.length === 1
                      ? "1 more copy"
                      : `${formatCount(others.length)} more copies`}
                    <ChevronDown
                      className="size-3.5 transition-transform group-open:rotate-180"
                      aria-hidden
                    />
                  </summary>
                  <ul aria-label="Papers" className="grid grid-cols-1 gap-0.5">
                    {others.map(row)}
                  </ul>
                </details>
              )}
            </section>
          ))}
        </div>
      ) : (
        <ul aria-label="Papers" className="grid grid-cols-1 gap-0.5">
          {published.map(row)}
        </ul>
      )}

      {pendingCount > 0 && (
        <p className="px-3 pt-2 pb-2 text-xs text-muted-foreground">
          {pendingCount === 1
            ? "1 more copy is waiting for review."
            : `${pendingCount} more copies are waiting for review.`}
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
  const versions = paperVersions(published);
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
            {[selected.versionLabel, titles.get(selected.id)]
              .filter(Boolean)
              .join(" · ")}
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
        {versions.map(({ label, copies }) => (
          <div key={copies[0]!.id}>
            {label && versions.length > 1 && (
              <h3 className="px-3 pt-2 pb-1 text-xs font-semibold text-muted-foreground">
                {label}
              </h3>
            )}
            <ul aria-label="Papers" className="grid grid-cols-1 gap-0.5">
              {copies.map((submission) => {
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
                        "flex min-h-11 items-center gap-3 rounded-2xl px-3 py-2 text-sm transition-colors hover:state-layer",
                        active &&
                          "bg-primary-container text-primary-container-foreground",
                      )}
                    >
                      <span className="w-5 text-center text-xs font-semibold text-muted-foreground tabular-nums">
                        {published.indexOf(submission) + 1}
                      </span>
                      <span className="min-w-0 flex-1 truncate font-medium">
                        {titles.get(submission.id)}
                      </span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </nav>
    </details>
  );
}
