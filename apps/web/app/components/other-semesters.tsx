import type { Question } from "@ourdiu/shared";
import { ChevronRight } from "lucide-react";
import { Link } from "react-router";
import { courseHref } from "~/components/course-search";
import { ExamBadge } from "~/components/exam-badge";
import {
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
} from "~/components/ui/card";
import { plural } from "~/lib/submissions";

type OtherSemestersProps = {
  course: { id: number; name: string };
  examType: string;
  /** The same course and exam type in other semesters, newest first. */
  questions: Question[];
};

/**
 * Students prepare for an exam by reading the same course's exam from past
 * semesters, so the question page links straight to them.
 */
export function OtherSemesters({
  course,
  examType,
  questions,
}: OtherSemestersProps) {
  if (questions.length === 0) return null;
  const name = course.name;

  return (
    <Card className="gap-3 pb-2">
      <CardHeader>
        <CardTitle>
          <h2>Other semesters</h2>
        </CardTitle>
        <CardDescription>
          {name} {examType.toLowerCase()} papers from{" "}
          {plural(questions.length, "other semester")}
        </CardDescription>
      </CardHeader>
      <ul className="grid grid-cols-1 gap-1 px-2">
        {questions.map((question) => (
          <li key={question.id}>
            <Link
              to={`/questions/${question.id}`}
              prefetch="intent"
              className="flex items-center gap-3 rounded-xl px-3 py-2 text-sm transition-colors hover:bg-accent"
            >
              <ExamBadge examType={question.examType.name} size={32} />
              <span className="min-w-0 flex-1 font-medium">
                {question.semester.name}
              </span>
              <span className="text-xs text-muted-foreground">
                {plural(question.submissionCounts.published, "paper")}
              </span>
              <ChevronRight
                className="size-4 shrink-0 text-muted-foreground"
                aria-hidden
              />
            </Link>
          </li>
        ))}
      </ul>
      <Link
        to={courseHref(course.id)}
        className="mx-5 mb-2 text-sm font-semibold text-primary underline-offset-4 hover:underline"
      >
        Every {name} exam
      </Link>
    </Card>
  );
}
