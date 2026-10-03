import type { Question, QuestionList } from "@ourdiu/shared";
import { ChevronRight, FileX, Plus } from "lucide-react";
import { useEffect, useMemo } from "react";
import {
  data,
  Link,
  useSearchParams,
  type ShouldRevalidateFunctionArgs,
} from "react-router";
import { courseHref, rememberCourse } from "~/components/course-search";
import { EmptyState } from "~/components/empty-state";
import { ExamBadge, ExamShape, examKind } from "~/components/exam-badge";
import { Breadcrumbs } from "~/components/page-header";
import { buttonVariants } from "~/components/ui/button";
import { apiFetch, readJson } from "~/lib/api.server";
import { redirectIfMerged } from "~/lib/merged.server";
import { courseEntries, sameCourses } from "~/lib/courses";
import { formatCount, formatViews, hasLongWord } from "~/lib/format";
import { plural } from "~/lib/submissions";
import { loadTaxonomy } from "~/lib/taxonomy.server";
import { cn } from "~/lib/utils";
import type { Route } from "./+types/questions-course";
import { breadcrumbJsonLd, originOf, pageMeta, QB_NAME } from "~/lib/seo";

/** The API's largest page; no course has anywhere near this many exams. */
const PAGE_SIZE = 100;

export async function loader({ request, params }: Route.LoaderArgs) {
  const taxonomy = await loadTaxonomy(request);
  const entries = courseEntries(taxonomy);
  const course = entries.find((c) => String(c.id) === params.id);
  if (!course) {
    await redirectIfMerged(
      request,
      "course",
      params.id,
      (id) => `/questions/courses/${id}`,
    );
    throw data("Course not found", { status: 404 });
  }

  const query = new URLSearchParams({
    courseId: String(course.id),
    pageSize: String(PAGE_SIZE),
    sort: "az",
  });
  const res = await apiFetch(request, `/api/v1/questions?${query}`);
  if (!res.ok) throw data("Failed to load the course", { status: 502 });
  const list = await readJson<QuestionList>(res);

  return {
    course,
    questions: list.items,
    // Newest first, as the taxonomy lists them.
    semesterOrder: taxonomy.semesters.map((s) => s.id),
    alsoFiledAs: sameCourses(entries, course),
  };
}

// The exam-type filter is applied here, from data already loaded.
export function shouldRevalidate({
  currentUrl,
  nextUrl,
  formMethod,
  defaultShouldRevalidate,
}: ShouldRevalidateFunctionArgs) {
  if (!formMethod && currentUrl.pathname === nextUrl.pathname) return false;
  return defaultShouldRevalidate;
}

export const meta: Route.MetaFunction = ({ loaderData, matches }) => {
  if (!loaderData) return [{ title: "Course not found — OurDIU" }];
  const { course, questions } = loaderData;
  return [
    ...pageMeta({
      title: `${course.name} previous questions (DIU ${course.departmentShortName}) — ${QB_NAME}`,
      description: `${plural(questions.length, "past exam")} of ${course.name}, ${course.departmentName}, Daffodil International University (DIU): final, midterm and quiz question papers by semester. Free to read and download.`,
    }),
    breadcrumbJsonLd(originOf(matches), [
      { name: QB_NAME, path: "/questions" },
      {
        name: course.departmentShortName,
        path: `/questions/departments/${course.departmentId}`,
      },
      { name: course.name, path: courseHref(course.id) },
    ]),
  ];
};

type ExamFilter = { id: number; name: string; count: number };

/** The exam types this course has papers for, in the list's order. */
function examFilters(questions: Question[]): ExamFilter[] {
  const filters = new Map<number, ExamFilter>();
  for (const { examType } of questions) {
    const filter = filters.get(examType.id);
    if (filter) filter.count++;
    else filters.set(examType.id, { ...examType, count: 1 });
  }
  return [...filters.values()];
}

/** Questions under their semester, newest semester first. */
function bySemester(questions: Question[], order: number[]) {
  const rank = new Map(order.map((id, i) => [id, i]));
  const groups = new Map<number, { name: string; questions: Question[] }>();
  for (const question of questions) {
    const group = groups.get(question.semester.id);
    if (group) group.questions.push(question);
    else
      groups.set(question.semester.id, {
        name: question.semester.name,
        questions: [question],
      });
  }
  return [...groups]
    .sort(([a], [b]) => (rank.get(a) ?? Infinity) - (rank.get(b) ?? Infinity))
    .map(([id, group]) => ({ id, ...group }));
}

/** Rows of one group: round outer corners, small inner ones, as in the app. */
function rowRadius(i: number, count: number) {
  if (count === 1) return "rounded-2xl";
  if (i === 0) return "rounded-t-2xl rounded-b-sm";
  if (i === count - 1) return "rounded-t-sm rounded-b-2xl";
  return "rounded-sm";
}

export default function Course({ loaderData }: Route.ComponentProps) {
  const { course, questions, semesterOrder, alsoFiledAs } = loaderData;
  const [searchParams] = useSearchParams();
  const examTypeId = Number(searchParams.get("examTypeId")) || null;

  useEffect(() => rememberCourse(course.id), [course.id]);

  const filters = useMemo(() => examFilters(questions), [questions]);
  const active = filters.some((f) => f.id === examTypeId) ? examTypeId : null;
  const groups = useMemo(
    () =>
      bySemester(
        active ? questions.filter((q) => q.examType.id === active) : questions,
        semesterOrder,
      ),
    [questions, semesterOrder, active],
  );
  const papers = questions.reduce(
    (sum, q) => sum + q.submissionCounts.published,
    0,
  );
  const views = questions.reduce((sum, q) => sum + q.viewCount, 0);

  return (
    <div className="grid gap-10 lg:grid-cols-[minmax(0,1fr)_20rem] lg:gap-12">
      <div className="min-w-0 space-y-7">
        <Breadcrumbs
          crumbs={[
            { label: "Browse", to: "/questions/departments" },
            {
              label: course.departmentShortName,
              to: `/questions/departments/${course.departmentId}`,
            },
            { label: course.name },
          ]}
        />
        <div className="space-y-3">
          <h1
            className={cn(
              "font-display-xl text-balance break-words hyphens-auto",
              hasLongWord(course.name)
                ? "text-3xl sm:text-5xl xl:text-7xl"
                : "text-4xl sm:text-6xl xl:text-7xl",
            )}
          >
            {course.name}
          </h1>
          <p className="text-muted-foreground">
            {course.departmentName}
            {questions.length > 0 && (
              <>
                {" · "}
                {plural(papers, "paper")} from{" "}
                {plural(questions.length, "exam")}
                {" · "}
                {formatViews(views)}
              </>
            )}
          </p>
        </div>

        {filters.length > 1 && (
          <nav
            aria-label="Exam type"
            className="-mx-4 flex [scrollbar-width:none] gap-2 overflow-x-auto px-4 pb-1 sm:mx-0 sm:flex-wrap sm:px-0"
          >
            {[
              { id: null, name: "All", count: questions.length },
              ...filters,
            ].map((filter) => {
              const on = filter.id === active;
              return (
                <Link
                  key={filter.name}
                  to={filter.id ? `?examTypeId=${filter.id}` : "."}
                  replace
                  preventScrollReset
                  aria-current={on ? "true" : undefined}
                  className={cn(
                    "flex h-10 shrink-0 items-center gap-2 rounded-xl border pr-3.5 text-sm font-semibold transition-colors",
                    filter.id ? "pl-2.5" : "pl-3.5",
                    on
                      ? "border-primary-container bg-primary-container text-primary-container-foreground"
                      : "border-input hover:state-layer",
                  )}
                >
                  {filter.id && (
                    <ExamShape
                      kind={examKind(filter.name)}
                      className="size-5"
                    />
                  )}
                  {filter.name}
                  <span className="font-medium opacity-75">{filter.count}</span>
                </Link>
              );
            })}
          </nav>
        )}

        {groups.length === 0 ? (
          <EmptyState
            icon={FileX}
            title="No papers yet"
            description={`Nobody has shared a ${course.name} paper yet. Have one? It takes a minute.`}
            action={
              <Link
                to="/questions/contribute"
                className={buttonVariants({ size: "sm" })}
              >
                <Plus aria-hidden />
                Share a paper
              </Link>
            }
          />
        ) : (
          groups.map((group) => (
            <section
              key={group.id}
              aria-labelledby={`semester-${group.id}`}
              className="space-y-2.5"
            >
              <h2
                id={`semester-${group.id}`}
                className="px-1 text-xs font-semibold tracking-wide text-muted-foreground uppercase"
              >
                {group.name}
              </h2>
              <ul className="grid gap-0.5">
                {group.questions.map((question, i) => (
                  <li key={question.id}>
                    <Link
                      to={`/questions/${question.id}`}
                      prefetch="intent"
                      className={cn(
                        "flex items-center gap-4 bg-surface px-4 py-3.5 transition-[background-color,scale] hover:state-layer active:scale-[0.995]",
                        rowRadius(i, group.questions.length),
                      )}
                    >
                      <ExamBadge examType={question.examType.name} size={48} />
                      <span className="min-w-0 flex-1">
                        <span className="block font-semibold">
                          {question.examType.name}
                        </span>
                        <span className="block text-sm text-muted-foreground tabular-nums">
                          {plural(question.submissionCounts.published, "paper")}
                          {" · "}
                          {formatCount(question.viewCount)} views
                        </span>
                      </span>
                      <ChevronRight
                        className="size-5 shrink-0 text-muted-foreground"
                        aria-hidden
                      />
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          ))
        )}
      </div>

      <aside className="space-y-4 lg:pt-10">
        {alsoFiledAs.length > 0 && (
          <section className="rounded-3xl bg-surface p-5">
            <h2 className="font-semibold">Same course, other names</h2>
            <p className="mt-1 mb-3 text-sm text-muted-foreground">
              Papers are filed under the name on the question sheet, so check
              these too.
            </p>
            <ul>
              {alsoFiledAs.map((other) => (
                <li key={other.id} className="border-t border-surface-highest">
                  <Link
                    to={courseHref(other.id)}
                    className="flex min-h-11 items-center justify-between gap-3 py-2 text-sm hover:text-primary"
                  >
                    {other.name}
                    <span
                      className="text-xs font-semibold text-muted-foreground"
                      title={other.departmentName}
                    >
                      {other.departmentShortName}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        )}
        {questions.length > 0 && (
          <section className="space-y-3 rounded-3xl bg-primary-container p-5 text-primary-container-foreground">
            <h2 className="font-expressive text-xl">Missing a semester?</h2>
            <p className="text-sm">
              Share your {course.name} paper so the next batch has it too.
            </p>
            <Link
              to="/questions/contribute"
              className={cn(buttonVariants({ size: "sm" }), "rounded-full")}
            >
              Share a paper
            </Link>
          </section>
        )}
      </aside>
    </div>
  );
}
