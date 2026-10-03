import type { DepartmentListItem, Question } from "@ourdiu/shared";
import { Link } from "react-router";
import { EXAM_TONE, ExamShape, examKind } from "~/components/exam-badge";
import { formatCount, formatNumber } from "~/lib/format";
import { cn } from "~/lib/utils";

/**
 * A question as a large tile in its exam type's colour, with the type's shape in
 * the corner, like the app's "Most viewed" carousel.
 */
export function ExamTile({
  question,
  today = false,
  className,
}: {
  question: Question;
  /** Count today's views instead of all of them, as in "Most viewed today". */
  today?: boolean;
  className?: string;
}) {
  const kind = examKind(question.examType.name);
  return (
    <Link
      to={`/questions/${question.id}`}
      prefetch="intent"
      className={cn(
        "group relative flex min-h-56 flex-col justify-between overflow-hidden rounded-[1.75rem] p-5 transition-[scale] focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-none active:scale-[0.98]",
        EXAM_TONE[kind],
        className,
      )}
    >
      <span className="relative text-xs font-semibold">
        {question.examType.name} · {question.semester.name}
      </span>
      <ExamShape
        kind={kind}
        colored={false}
        className="absolute -right-8 -bottom-10 size-40 opacity-[0.12] transition-transform duration-500 group-hover:rotate-12"
      />
      <span className="relative space-y-1.5">
        <span className="line-clamp-4 block font-expressive text-2xl">
          {question.course.name}
        </span>
        <span className="block text-xs font-medium opacity-80">
          {today && question.viewsToday !== null
            ? `${formatCount(question.viewsToday)} views today`
            : `${formatCount(question.viewCount)} views`}{" "}
          · {question.department.shortName}
        </span>
      </span>
    </Link>
  );
}

/**
 * A department as a tile led by its short name in large type. `featured` is the
 * big tinted one (the department with most papers, or the visitor's).
 */
export function DepartmentTile({
  department,
  courseCount,
  featured = false,
  className,
}: {
  department: DepartmentListItem;
  courseCount?: number;
  featured?: boolean;
  className?: string;
}) {
  return (
    <Link
      to={`/questions/departments/${department.id}`}
      prefetch="intent"
      className={cn(
        "flex min-h-40 flex-col justify-between gap-6 rounded-[1.75rem] p-5 transition-[background-color,scale] focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-none active:scale-[0.98]",
        featured
          ? "bg-primary-container text-primary-container-foreground hover:state-layer"
          : "bg-surface hover:state-layer",
        className,
      )}
    >
      <span
        className={cn(
          "font-display-xl break-words",
          featured ? "text-7xl sm:text-8xl" : "text-5xl",
        )}
      >
        {department.shortName}
      </span>
      <span className="space-y-0.5 text-sm">
        <span className={cn("block", !featured && "text-muted-foreground")}>
          {department.name}
        </span>
        <span className="block font-semibold">
          <span className="whitespace-nowrap">
            {formatNumber(department.publishedCount)}{" "}
            {department.publishedCount === 1 ? "paper" : "papers"}
          </span>
          {courseCount !== undefined && (
            <span className="whitespace-nowrap">
              {` · ${formatNumber(courseCount)} ${courseCount === 1 ? "course" : "courses"}`}
            </span>
          )}
        </span>
      </span>
    </Link>
  );
}
