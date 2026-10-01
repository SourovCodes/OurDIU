import type { Submission } from "@ourdiu/shared";
import { Check, Eye, FileText, ThumbsDown, ThumbsUp } from "lucide-react";
import { Link } from "react-router";
import { StatusBadge } from "~/components/status-badge";
import {
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
} from "~/components/ui/card";
import { formatDate } from "~/lib/dates";
import { formatCount } from "~/lib/format";
import { paperDetails, paperTitles, plural } from "~/lib/submissions";
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
    <Card className="gap-4 pb-2">
      <CardHeader>
        <CardTitle>
          <h2>Submissions</h2>
        </CardTitle>
        <CardDescription>
          {plural(published.length, "published paper")}
          {published.length > 1 && ", best rated first"}
          {pendingCount > 0 && ` · ${pendingCount} pending review`}
        </CardDescription>
      </CardHeader>

      <ul className="grid grid-cols-1 gap-1 px-2">
        {submissions.map((submission) => {
          if (submission.status === "published") {
            const active = submission.id === selectedId;
            return (
              <li key={submission.id}>
                {/* Links (not buttons) so switching works without JS and is shareable. */}
                <Link
                  to={`?submission=${encodeURIComponent(submission.id)}`}
                  replace
                  preventScrollReset
                  aria-current={active ? "true" : undefined}
                  className={cn(
                    "flex items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors hover:bg-accent focus-visible:bg-accent focus-visible:outline-none",
                    active && "bg-accent",
                  )}
                >
                  <FileText
                    className="size-4 shrink-0 text-muted-foreground"
                    aria-hidden
                  />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-medium">
                      {titles.get(submission.id)}
                    </span>
                    <span className="flex flex-wrap items-center gap-x-2 text-xs text-muted-foreground">
                      {/* Titled by section or batch: say whose it is too, unless the
                          title already does. */}
                      {paperDetails(submission) &&
                        submission.uploader &&
                        !titles
                          .get(submission.id)!
                          .includes(submission.uploader.name) && (
                          <span className="max-w-full truncate">
                            by {submission.uploader.name}
                          </span>
                        )}
                      <span>{formatDate(submission.createdAt)}</span>
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
                    </span>
                  </span>
                  {active && <Check className="size-4" aria-hidden />}
                </Link>
              </li>
            );
          }

          return (
            <li
              key={submission.id}
              className="flex items-center gap-3 px-3 py-2 text-sm"
            >
              <FileText
                className="size-4 shrink-0 text-muted-foreground/50"
                aria-hidden
              />
              <span className="min-w-0 flex-1 text-xs text-muted-foreground">
                Submitted {formatDate(submission.createdAt)}
              </span>
              <StatusBadge status={submission.status} />
            </li>
          );
        })}
      </ul>

      {pendingCount > 0 && (
        <p className="border-t px-6 pt-3 pb-2 text-xs text-muted-foreground">
          Papers under review become viewable once an admin approves them.
        </p>
      )}
    </Card>
  );
}

/**
 * The published papers as a row of chips, for small screens where the full list sits
 * below the viewer. Links, like the list, so switching works without JS.
 */
export function PaperSwitcher({
  submissions,
  selectedId,
}: SubmissionListProps) {
  const published = submissions.filter((s) => s.status === "published");
  if (published.length < 2) return null;
  const titles = paperTitles(published);

  return (
    <nav aria-label="Papers" className="-mx-4 overflow-x-auto px-4 lg:hidden">
      <ul className="flex w-max gap-2 pb-1">
        {published.map((submission) => {
          const active = submission.id === selectedId;
          return (
            <li key={submission.id}>
              <Link
                to={`?submission=${encodeURIComponent(submission.id)}`}
                replace
                preventScrollReset
                aria-current={active ? "true" : undefined}
                className={cn(
                  "flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm whitespace-nowrap transition-colors hover:bg-accent",
                  active &&
                    "border-primary bg-primary text-primary-foreground hover:bg-primary",
                )}
              >
                <span className="max-w-48 truncate font-medium">
                  {titles.get(submission.id)}
                </span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
