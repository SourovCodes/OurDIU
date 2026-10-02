import type { Question } from "@ourdiu/shared";
import { Eye, FileText } from "lucide-react";
import { Link } from "react-router";
import { ExamBadge } from "~/components/exam-badge";
import { Card, CardTitle } from "~/components/ui/card";
import { formatCount } from "~/lib/format";
import { cn } from "~/lib/utils";

/** Card-grid layout shared by the public lists. */
export const CARD_GRID = "grid gap-3 sm:grid-cols-2 lg:grid-cols-3";

/**
 * On phones, a grid of cards becomes one grouped list, like the app's rows:
 * round outer corners, small inner ones, 2px gaps.
 */
export const CARD_LIST_ON_PHONES =
  "max-sm:gap-0.5 max-sm:[&>li:first-child>*]:rounded-t-2xl max-sm:[&>li:last-child>*]:rounded-b-2xl";

/** The matching card style: a borderless, tinted row of that list on phones. */
export const CARD_ROW_ON_PHONES = "max-sm:rounded-sm";

/** Hover, press and focus styles for a card that is one big link. */
export const LINK_CARD =
  "relative gap-4 transition-[background-color,scale] hover:state-layer active:scale-[0.99] has-[a:focus-visible]:ring-[3px] has-[a:focus-visible]:ring-ring/50";

/** Makes a card's title link cover the whole card. */
export const STRETCHED_LINK =
  "after:absolute after:inset-0 after:rounded-xl focus-visible:outline-none";

function QuestionCard({
  question,
  action,
}: {
  question: Question;
  action?: React.ReactNode;
}) {
  const { published, pendingReview } = question.submissionCounts;

  return (
    // As in the app's rows: the exam badge, the course and where it's from, then
    // how much there is to read. On phones a row of the list `QuestionCards` frames.
    <Card className={cn(LINK_CARD, "gap-0 py-0", CARD_ROW_ON_PHONES)}>
      <div className="flex h-full items-center gap-3.5 px-4 py-3.5">
        <ExamBadge examType={question.examType.name} />
        <div className="min-w-0 flex-1 space-y-1">
          <CardTitle className="line-clamp-2 text-[0.9375rem] leading-snug">
            <Link
              to={`/questions/${question.id}`}
              prefetch="intent"
              className={STRETCHED_LINK}
            >
              {question.course.name}
            </Link>
          </CardTitle>
          <p className="text-[0.8125rem] text-muted-foreground">
            <span title={question.department.name}>
              {question.department.shortName}
            </span>
            {" · "}
            {question.examType.name}
            {" · "}
            <span className="whitespace-nowrap">{question.semester.name}</span>
          </p>
        </div>
        <div className="flex shrink-0 flex-col items-end gap-1.5 text-xs text-muted-foreground tabular-nums">
          <span className="flex items-center gap-1">
            <FileText className="size-3.5" aria-hidden />
            {published > 0 ? (
              <span className="font-medium text-foreground">
                {published}
                <span className="sr-only">
                  {published === 1 ? " paper" : " papers"}
                </span>
              </span>
            ) : (
              <span title="No papers yet">
                0<span className="sr-only"> papers. No papers yet</span>
              </span>
            )}
            {pendingReview > 0 && (
              <span title={`${pendingReview} waiting for review`}>
                +{pendingReview}
                <span className="sr-only"> pending review</span>
              </span>
            )}
          </span>
          <span className="flex items-center gap-1">
            <Eye className="size-3.5" aria-hidden />
            {formatCount(question.viewCount)}
            <span className="sr-only"> views</span>
          </span>
        </div>
        {/* Above the stretched link, so it stays clickable. */}
        {action && <div className="relative z-10 shrink-0">{action}</div>}
      </div>
    </Card>
  );
}

/** Questions as a grid of cards; each card opens the question. */
export function QuestionCards<Q extends Question>({
  questions,
  action,
}: {
  questions: Q[];
  /** Something to do with each question, e.g. remove it from saved. */
  action?: (question: Q) => React.ReactNode;
}) {
  return (
    <ul aria-label="Questions" className={cn(CARD_GRID, CARD_LIST_ON_PHONES)}>
      {questions.map((question) => (
        <li key={question.id} className="grid">
          <QuestionCard question={question} action={action?.(question)} />
        </li>
      ))}
    </ul>
  );
}
