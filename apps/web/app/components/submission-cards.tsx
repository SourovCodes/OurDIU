import type { ContributorSubmission } from "@ourdiu/shared";
import { ThumbsUp } from "lucide-react";
import { Link } from "react-router";
import {
  CARD_GRID,
  CARD_LIST_ON_PHONES,
  CARD_ROW_ON_PHONES,
  LINK_CARD,
  STRETCHED_LINK,
} from "~/components/question-cards";
import { ExamBadge } from "~/components/exam-badge";
import { Card, CardTitle } from "~/components/ui/card";
import { formatDate } from "~/lib/dates";
import { formatCount } from "~/lib/format";
import { paperDetails, publicUrl } from "~/lib/submissions";
import { cn } from "~/lib/utils";

/**
 * One published paper, compact like the question cards: course and exam type, where
 * it's from, then when it was added and how it's doing.
 */
function SubmissionCard({ submission }: { submission: ContributorSubmission }) {
  const href = publicUrl(submission);
  const { department, course, semester, examType } = submission.classification;
  const details = paperDetails(submission);

  return (
    <Card
      className={cn(
        LINK_CARD,
        "gap-0 py-0",
        CARD_ROW_ON_PHONES,
        !href && "bg-muted/30 hover:shadow-none",
      )}
    >
      <div className="flex h-full flex-col gap-1.5 p-4">
        <div className="flex items-start justify-between gap-3">
          <CardTitle className="line-clamp-2 text-[0.9375rem] leading-snug">
            {href ? (
              <Link to={href} prefetch="intent" className={STRETCHED_LINK}>
                {course.name}
              </Link>
            ) : (
              course.name
            )}
          </CardTitle>
          <ExamBadge examType={examType.name} size={32} />
        </div>
        <p className="text-sm text-muted-foreground">
          <span title={department.name}>
            {department.shortName ?? department.name}
          </span>
          {" · "}
          {examType.name}
          {" · "}
          {semester.name}
          {details && ` · ${details}`}
        </p>
        <div className="mt-auto flex items-center gap-4 pt-1.5 text-xs text-muted-foreground">
          <span>Added {formatDate(submission.createdAt)}</span>
          {/* Likes only once there are some. */}
          {submission.likeCount > 0 && (
            <span className="flex items-center gap-1 tabular-nums">
              <ThumbsUp className="size-3.5" aria-hidden />
              {formatCount(submission.likeCount)}
              <span className="sr-only"> likes</span>
            </span>
          )}
        </div>
      </div>
    </Card>
  );
}

/** A contributor's published papers; each opens its question. */
export function SubmissionCards({
  submissions,
}: {
  submissions: ContributorSubmission[];
}) {
  return (
    <ul aria-label="Submissions" className={cn(CARD_GRID, CARD_LIST_ON_PHONES)}>
      {submissions.map((submission) => (
        <li key={submission.id} className="grid">
          <SubmissionCard submission={submission} />
        </li>
      ))}
    </ul>
  );
}
