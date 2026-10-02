import type { Question } from "@ourdiu/shared";
import { Link } from "react-router";
import { courseHref } from "~/components/course-search";
import { ExamBadge } from "~/components/exam-badge";
import { plural } from "~/lib/submissions";

type OtherExamsProps = {
  course: { id: number; name: string };
  /** The course's other exams: the same exam type's other semesters first. */
  questions: Question[];
};

/**
 * Students prepare for an exam by reading the same course's other exams, above
 * all the same exam from past semesters, so the paper page links straight to them.
 */
export function OtherExams({ course, questions }: OtherExamsProps) {
  if (questions.length === 0) return null;

  return (
    <section
      aria-labelledby="other-exams-heading"
      className="rounded-3xl border bg-card px-2 pt-4 pb-2"
    >
      <h2 id="other-exams-heading" className="px-3 pb-2 font-semibold">
        Other {course.name} exams
      </h2>
      <ul className="grid grid-cols-1 gap-0.5">
        {questions.map((question) => (
          <li key={question.id}>
            <Link
              to={`/questions/${question.id}`}
              prefetch="intent"
              className="flex items-center gap-3 rounded-2xl px-3 py-2 text-sm transition-colors hover:state-layer"
            >
              <ExamBadge examType={question.examType.name} size={32} />
              <span className="min-w-0 flex-1">
                {question.examType.name}, {question.semester.name}
              </span>
              <span className="text-xs text-muted-foreground">
                {plural(question.submissionCounts.published, "paper")}
              </span>
            </Link>
          </li>
        ))}
      </ul>
      <Link
        to={courseHref(course.id)}
        className="mx-3 mt-1 mb-2 inline-block text-sm font-semibold text-primary underline-offset-4 hover:underline"
      >
        Every {course.name} exam
      </Link>
    </section>
  );
}
