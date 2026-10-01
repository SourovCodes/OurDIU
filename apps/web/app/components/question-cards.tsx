import type { Question } from "@ourdiu/shared";
import { Eye, FileText } from "lucide-react";
import { Link } from "react-router";
import { Badge } from "~/components/ui/badge";
import { Card, CardTitle } from "~/components/ui/card";
import { formatCount } from "~/lib/format";
import { plural } from "~/lib/submissions";
import { cn } from "~/lib/utils";

/** Card-grid layout shared by the public lists. */
export const CARD_GRID = "grid gap-3 sm:grid-cols-2 lg:grid-cols-3";

/** On phones, a grid of cards becomes one bordered list with dividers. */
export const CARD_LIST_ON_PHONES =
  "max-sm:gap-0 max-sm:divide-y max-sm:overflow-hidden max-sm:rounded-xl max-sm:border";

/** The matching card style: a borderless row of that list on phones. */
export const CARD_ROW_ON_PHONES =
  "max-sm:rounded-none max-sm:border-0 max-sm:shadow-none max-sm:hover:shadow-none";

/** Hover and focus styles for a card that is one big link. */
export const LINK_CARD =
  "relative gap-4 transition-[border-color,box-shadow] hover:border-primary/40 hover:shadow-md has-[a:focus-visible]:ring-[3px] has-[a:focus-visible]:ring-ring/50";

/** Makes a card's title link cover the whole card. */
export const STRETCHED_LINK =
  "after:absolute after:inset-0 after:rounded-xl focus-visible:outline-none";

function QuestionCard({ question }: { question: Question }) {
  const { published, pendingReview } = question.submissionCounts;

  return (
    // Compact: title and exam type, where it's from, then how much there is to read.
    // On phones a borderless row of the list that `QuestionCards` frames.
    <Card className={cn(LINK_CARD, "gap-0 py-0", CARD_ROW_ON_PHONES)}>
      <div className="flex h-full flex-col gap-1.5 p-4">
        <div className="flex items-start justify-between gap-3">
          <CardTitle className="line-clamp-2 text-[0.9375rem] leading-snug">
            <Link
              to={`/questions/${question.id}`}
              prefetch="intent"
              className={STRETCHED_LINK}
            >
              {question.course.name}
            </Link>
          </CardTitle>
          <Badge variant="outline" className="shrink-0 text-muted-foreground">
            {question.examType.name}
          </Badge>
        </div>
        <p className="text-sm text-muted-foreground">
          <span title={question.department.name}>
            {question.department.shortName}
          </span>
          {" · "}
          {question.semester.name}
        </p>
        <div className="mt-auto flex items-center gap-4 pt-1.5 text-xs text-muted-foreground">
          <span className="flex items-center gap-1.5">
            <FileText className="size-3.5" aria-hidden />
            <span
              className={cn(published > 0 && "font-medium text-foreground")}
            >
              {published > 0 ? plural(published, "paper") : "No papers yet"}
            </span>
            {pendingReview > 0 && (
              <span title={`${pendingReview} waiting for review`}>
                +{pendingReview}
                <span className="sr-only"> pending review</span>
              </span>
            )}
          </span>
          <span className="flex items-center gap-1 tabular-nums">
            <Eye className="size-3.5" aria-hidden />
            {formatCount(question.viewCount)}
            <span className="sr-only"> views</span>
          </span>
        </div>
      </div>
    </Card>
  );
}

/** Questions as a grid of cards; each card opens the question. */
export function QuestionCards({ questions }: { questions: Question[] }) {
  return (
    <ul aria-label="Questions" className={cn(CARD_GRID, CARD_LIST_ON_PHONES)}>
      {questions.map((question) => (
        <li key={question.id} className="grid">
          <QuestionCard question={question} />
        </li>
      ))}
    </ul>
  );
}
