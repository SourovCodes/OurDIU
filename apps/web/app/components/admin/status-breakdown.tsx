import type { SubmissionCounts, SubmissionStatus } from "@ourdiu/shared";
import { Link } from "react-router";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "~/components/ui/card";
import { percent } from "~/lib/format";
import { STATUS_LABELS } from "~/lib/submissions";
import { SubmissionStatusBadge } from "./badges";

const SEGMENTS: {
  status: SubmissionStatus;
  key: keyof SubmissionCounts;
  fill: string;
}[] = [
  { status: "published", key: "published", fill: "bg-emerald-500" },
  { status: "pending_review", key: "pendingReview", fill: "bg-amber-500" },
  { status: "rejected", key: "rejected", fill: "bg-red-500" },
];

/** Part-to-whole of submissions by status: one stacked bar plus a labelled list. */
export function StatusBreakdown({ counts }: { counts: SubmissionCounts }) {
  const total = counts.published + counts.pendingReview + counts.rejected;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Submissions by status</CardTitle>
        <CardDescription>{total} papers uploaded in total</CardDescription>
      </CardHeader>
      <CardContent className="grid gap-5">
        {/* Segments are separated by a 2px gap, never a border. */}
        <div className="flex h-2.5 gap-0.5 overflow-hidden rounded-full bg-muted">
          {SEGMENTS.map(({ status, key, fill }) =>
            counts[key] > 0 ? (
              <div
                key={status}
                className={fill}
                style={{ width: `${(counts[key] / total) * 100}%` }}
                title={`${STATUS_LABELS[status]}: ${counts[key]}`}
              />
            ) : null,
          )}
        </div>
        <ul className="grid gap-1">
          {SEGMENTS.map(({ status, key }) => (
            <li key={status}>
              <Link
                to={`/admin/questions/submissions?status=${status}`}
                className="-mx-2 flex items-center gap-3 rounded-xl px-2 py-1.5 text-sm transition-colors hover:bg-surface-high"
              >
                <SubmissionStatusBadge status={status} />
                <span className="ml-auto font-medium tabular-nums">
                  {counts[key]}
                </span>
                <span className="w-10 text-right text-muted-foreground tabular-nums">
                  {percent(counts[key], total)}%
                </span>
              </Link>
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}
