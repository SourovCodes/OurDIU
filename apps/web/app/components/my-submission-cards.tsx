import type { MySubmission } from "@ourdiu/shared";
import { Eye, ThumbsUp } from "lucide-react";
import { Link } from "react-router";
import {
  CARD_GRID,
  LINK_CARD,
  STRETCHED_LINK,
} from "~/components/question-cards";
import { ReviewStageLabel } from "~/components/review-stage";
import { StatusBadge } from "~/components/status-badge";
import { ExamBadge } from "~/components/exam-badge";
import { Card, CardTitle } from "~/components/ui/card";
import { formatDate } from "~/lib/dates";
import { formatCount } from "~/lib/format";
import { paperDetails } from "~/lib/submissions";
import { cn } from "~/lib/utils";

export const mySubmissionUrl = (id: number) =>
  `/questions/my-submissions/${id}`;

function MySubmissionCard({
  submission,
  actions,
}: {
  submission: MySubmission;
  actions?: React.ReactNode;
}) {
  const details = paperDetails(submission);
  const { department, course, semester, examType } = submission.classification;

  return (
    <Card className={cn(LINK_CARD, "gap-4 py-5")}>
      <div className="flex items-start gap-3.5 px-5">
        <ExamBadge examType={examType.name} />
        <div className="min-w-0 flex-1 space-y-1">
          <CardTitle className="text-base leading-snug">
            <Link
              to={mySubmissionUrl(submission.id)}
              prefetch="intent"
              className={STRETCHED_LINK}
            >
              {course.name}
            </Link>
          </CardTitle>
          <p className="text-sm text-muted-foreground">
            <span title={department.name}>
              {department.shortName ?? department.name}
            </span>
            {" · "}
            {examType.name} · {semester.name}
            {details && ` · ${details}`}
          </p>
        </div>
        {/* Above the stretched link, so the menu stays clickable. */}
        {actions && <div className="relative z-10 -mt-1 -mr-2">{actions}</div>}
      </div>
      <div className="grid gap-2 px-5">
        <StatusBadge status={submission.status} />
        <ReviewStageLabel submission={submission} />
      </div>
      <div className="mt-auto flex items-center justify-between gap-3 px-5 text-sm text-muted-foreground">
        <span>Added {formatDate(submission.createdAt)}</span>
        {submission.status === "published" && (
          <span className="flex items-center gap-3 tabular-nums">
            <span className="flex items-center gap-1">
              <ThumbsUp className="size-4" aria-hidden />
              {formatCount(submission.likeCount)}
              <span className="sr-only"> likes</span>
            </span>
            <span className="flex items-center gap-1">
              <Eye className="size-4" aria-hidden />
              {formatCount(submission.viewCount)}
              <span className="sr-only"> views</span>
            </span>
          </span>
        )}
      </div>
    </Card>
  );
}

/** The signed-in user's own papers as cards; each opens its status page. */
export function MySubmissionCards({
  submissions,
  actions,
}: {
  submissions: MySubmission[];
  actions?: (submission: MySubmission) => React.ReactNode;
}) {
  return (
    <ul aria-label="My submissions" className={CARD_GRID}>
      {submissions.map((submission) => (
        <li key={submission.id} className="grid">
          <MySubmissionCard
            submission={submission}
            actions={actions?.(submission)}
          />
        </li>
      ))}
    </ul>
  );
}
