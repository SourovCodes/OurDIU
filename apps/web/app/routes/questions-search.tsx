import type { PaperSearchHit, PaperSearchList } from "@ourdiu/shared";
import { MAX_SEARCH_LENGTH, MIN_SEARCH_LENGTH } from "@ourdiu/shared/constants";
import { BookOpen, Search, SearchX } from "lucide-react";
import { Form, Link } from "react-router";
import { courseHref } from "~/components/course-search";
import { EmptyState } from "~/components/empty-state";
import { ExamBadge } from "~/components/exam-badge";
import {
  CARD_GRID,
  CARD_LIST_ON_PHONES,
  CARD_ROW_ON_PHONES,
  LINK_CARD,
  STRETCHED_LINK,
} from "~/components/question-cards";
import { TablePagination } from "~/components/table-pagination";
import { Button } from "~/components/ui/button";
import { Card, CardTitle } from "~/components/ui/card";
import { apiGetJson } from "~/lib/api.server";
import { courseEntries, searchCourses } from "~/lib/courses";
import { pageMeta, QB_NAME } from "~/lib/seo";
import { loadTaxonomy } from "~/lib/taxonomy.server";
import { cn } from "~/lib/utils";
import type { Route } from "./+types/questions-search";

const PAGE_SIZE = 20;
/** Courses whose names match, shown above the papers. */
const MAX_COURSES = 6;

export const meta: Route.MetaFunction = ({ loaderData }) => [
  ...pageMeta({
    title: loaderData?.q
      ? `“${loaderData.q}” in DIU question papers — ${QB_NAME}`
      : `Search DIU question papers — ${QB_NAME}`,
    description:
      "Find Daffodil International University (DIU) past exam questions by the words on the paper: a topic, a definition, a question you remember.",
  }),
  // Result pages are endless and thin; the search page itself may be indexed.
  ...(loaderData?.q ? [{ name: "robots", content: "noindex" }] : []),
];

export async function loader({ request }: Route.LoaderArgs) {
  const url = new URL(request.url);
  const q = (url.searchParams.get("q") ?? "")
    .trim()
    .slice(0, MAX_SEARCH_LENGTH);
  const page = Math.max(1, Number(url.searchParams.get("page")) || 1);
  if (q.length < MIN_SEARCH_LENGTH) {
    return { q, page, courses: [], papers: null };
  }
  const [taxonomy, papers] = await Promise.all([
    loadTaxonomy(request),
    apiGetJson<PaperSearchList>(
      request,
      `/api/v1/questions/search?${new URLSearchParams({
        q,
        page: String(page),
        pageSize: String(PAGE_SIZE),
      })}`,
    ),
  ]);
  return {
    q,
    page,
    courses:
      page === 1
        ? searchCourses(courseEntries(taxonomy), q).slice(0, MAX_COURSES)
        : [],
    papers,
  };
}

function HitCard({ hit }: { hit: PaperSearchHit }) {
  const { question } = hit;
  return (
    <Card className={cn(LINK_CARD, "gap-0 py-0", CARD_ROW_ON_PHONES)}>
      <div className="flex h-full items-start gap-3.5 px-4 py-3.5">
        <ExamBadge examType={question.examType.name} />
        <div className="min-w-0 flex-1 space-y-1.5">
          <CardTitle className="text-[0.9375rem] leading-snug">
            <Link
              to={`/questions/${question.id}?submission=${hit.submissionId}`}
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
          <p className="line-clamp-3 text-sm leading-6">
            {hit.snippet.map((part, i) =>
              part.match ? (
                <mark
                  key={i}
                  className="rounded-sm bg-primary-container px-0.5 text-primary-container-foreground"
                >
                  {part.text}
                </mark>
              ) : (
                <span key={i}>{part.text}</span>
              ),
            )}
          </p>
        </div>
      </div>
    </Card>
  );
}

/**
 * Search inside the papers: the words on them, as the AI read them (docs/PLAN.md,
 * decision 22). Courses whose names match come first, since that's often what a
 * student typing a course name wants.
 */
export default function QuestionsSearch({ loaderData }: Route.ComponentProps) {
  const { q, page, courses, papers } = loaderData;
  const hrefFor = (p: number) =>
    `/questions/search?${new URLSearchParams({ q, ...(p > 1 ? { page: String(p) } : {}) })}`;

  return (
    <div className="space-y-8">
      <div className="space-y-5">
        <div className="space-y-3">
          <h1 className="font-display-xl text-5xl sm:text-7xl">
            Search papers
          </h1>
          <p className="max-w-xl text-muted-foreground">
            Find a question by the words on the paper: a topic, a definition,
            something you remember from the exam.
          </p>
        </div>
        <Form
          method="get"
          role="search"
          className="flex h-16 max-w-2xl items-center gap-3 rounded-full bg-surface pr-2 pl-6 focus-within:ring-[3px] focus-within:ring-ring/50"
        >
          <Search
            className="size-5 shrink-0 text-muted-foreground"
            aria-hidden
          />
          <input
            type="search"
            name="q"
            defaultValue={q}
            key={q}
            minLength={MIN_SEARCH_LENGTH}
            maxLength={MAX_SEARCH_LENGTH}
            required
            aria-label="Words to find in papers"
            placeholder="e.g. Dijkstra shortest path"
            className="min-w-0 flex-1 bg-transparent text-base outline-none placeholder:text-muted-foreground"
          />
          <Button type="submit">Search</Button>
        </Form>
      </div>

      {courses.length > 0 && (
        <section className="space-y-3" aria-labelledby="course-results">
          <h2 id="course-results" className="font-expressive text-2xl">
            Courses
          </h2>
          <ul className="flex flex-wrap gap-2">
            {courses.map((course) => (
              <li key={course.id}>
                <Link
                  to={courseHref(course.id)}
                  prefetch="intent"
                  className="inline-flex items-center gap-2 rounded-full bg-surface px-4 py-2 text-sm transition-colors hover:state-layer focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-none"
                >
                  <BookOpen className="size-4 text-primary" aria-hidden />
                  {course.name}
                  <span className="text-muted-foreground">
                    {course.departmentShortName}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      {papers && (
        <section className="space-y-4" aria-labelledby="paper-results">
          <h2 id="paper-results" className="font-expressive text-2xl">
            Inside papers
          </h2>
          {papers.items.length > 0 ? (
            <>
              <ul
                aria-label="Matching papers"
                className={cn(CARD_GRID, "lg:grid-cols-2", CARD_LIST_ON_PHONES)}
              >
                {papers.items.map((hit) => (
                  <li key={hit.question.id} className="grid">
                    <HitCard hit={hit} />
                  </li>
                ))}
              </ul>
              <TablePagination
                page={page}
                pageSize={papers.pageSize}
                total={papers.total}
                noun="exam"
                hrefFor={hrefFor}
              />
            </>
          ) : (
            <EmptyState
              icon={SearchX}
              title={`No paper mentions “${q}”`}
              description="Try fewer or other words. Papers shared long ago may not be searchable yet."
            />
          )}
        </section>
      )}
    </div>
  );
}
