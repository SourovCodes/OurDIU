import type { QuestionList } from "@ourdiu/shared";
import { Check, Search } from "lucide-react";
import { Link } from "react-router";
import { CourseSearchTrigger } from "~/components/course-search";
import { ExamBadge, ExamShape } from "~/components/exam-badge";
import { DepartmentTile, ExamTile } from "~/components/qb-tiles";
import { QuestionCards } from "~/components/question-cards";
import { buttonVariants } from "~/components/ui/button";
import { apiGetJson } from "~/lib/api.server";
import { ANDROID_BETA } from "~/lib/android-app";
import { formatNumber } from "~/lib/format";
import { loadTaxonomy } from "~/lib/taxonomy.server";
import { cn } from "~/lib/utils";
import type { Route } from "./+types/questions-home";

/** The first question of each course, so one course doesn't fill a section. */
function onePerCourse(questions: QuestionList["items"], limit: number) {
  const seen = new Set<number>();
  return questions
    .filter((question) => {
      if (seen.has(question.course.id)) return false;
      seen.add(question.course.id);
      return true;
    })
    .slice(0, limit);
}

/**
 * Live numbers and the departments to browse. The landing page must render even if
 * the API is down, so a failed request just leaves its part out.
 */
export async function loader({ request }: Route.LoaderArgs) {
  const [newest, popular, taxonomy] = await Promise.allSettled([
    apiGetJson<QuestionList>(
      request,
      "/api/v1/questions?sort=newest&pageSize=24",
    ),
    apiGetJson<QuestionList>(
      request,
      "/api/v1/questions?sort=popular&pageSize=24",
    ),
    loadTaxonomy(request),
  ]);
  const value = <T,>(result: PromiseSettledResult<T>) =>
    result.status === "fulfilled" ? result.value : null;

  const tax = value(taxonomy);
  // Departments without papers have nothing to browse yet; most papers first.
  const departments = (tax?.departments ?? [])
    .filter((d) => d.publishedCount > 0)
    .sort((a, b) => b.publishedCount - a.publishedCount);
  const courseCounts = new Map<number, number>();
  for (const course of tax?.courses ?? []) {
    courseCounts.set(
      course.departmentId,
      (courseCounts.get(course.departmentId) ?? 0) + 1,
    );
  }
  return {
    papers: departments.reduce((sum, d) => sum + d.publishedCount, 0),
    courseTotal: tax?.courses.length ?? 0,
    newest: onePerCourse(value(newest)?.items ?? [], 6),
    popular: onePerCourse(value(popular)?.items ?? [], 4),
    departments,
    courseCounts: Object.fromEntries(courseCounts),
  };
}

export const meta: Route.MetaFunction = () => [
  { title: "OurDIU Question Bank — Past exam question papers" },
  {
    name: "description",
    content:
      "Find previous exam question papers by department, course, semester and exam type. Free and community-contributed.",
  },
];

function SectionHeading({
  id,
  title,
  link,
}: {
  id: string;
  title: string;
  link: { to: string; label: string };
}) {
  return (
    <div className="flex items-baseline justify-between gap-4">
      <h2 id={id} className="font-expressive text-3xl sm:text-4xl">
        {title}
      </h2>
      <Link
        to={link.to}
        className="shrink-0 text-sm font-semibold text-primary underline-offset-4 hover:underline"
      >
        {link.label}
      </Link>
    </div>
  );
}

/** The four exam shapes, large, beside the title on wide screens. */
function ShapeCluster() {
  return (
    <div aria-hidden className="relative hidden h-96 lg:block">
      <ExamBadge
        examType="Final"
        size={240}
        className="absolute top-0 left-10"
      />
      <ExamBadge
        examType="Midterm"
        size={170}
        className="absolute top-8 right-0"
      />
      <ExamBadge
        examType="Quiz"
        size={130}
        className="absolute bottom-6 left-0"
      />
      <ExamBadge
        examType="Lab Final"
        size={130}
        className="absolute right-16 bottom-0 rotate-[-8deg]"
      />
    </div>
  );
}

export default function Home({ loaderData }: Route.ComponentProps) {
  const { papers, courseTotal, newest, popular, departments, courseCounts } =
    loaderData;
  const [featured, ...others] = departments;

  return (
    <div className="space-y-16 pt-2 sm:pt-6">
      <section className="grid grid-cols-1 items-center gap-10 lg:grid-cols-[minmax(0,1.35fr)_minmax(0,1fr)]">
        <div className="space-y-7">
          <p className="inline-flex items-center gap-2 rounded-full bg-primary-container py-1.5 pr-4 pl-1.5 text-sm font-medium text-primary-container-foreground">
            <span className="flex size-6 items-center justify-center rounded-full bg-primary text-primary-foreground">
              <Check className="size-3.5" aria-hidden />
            </span>
            Free, no ads, shared by DIU students
          </p>
          <div className="space-y-5">
            <h1 className="font-display-xl text-6xl sm:text-8xl xl:text-[6.5rem]">
              Find your paper.
            </h1>
            {papers > 0 && (
              <p className="max-w-xl text-lg text-pretty text-muted-foreground">
                {formatNumber(papers)} past exam papers across{" "}
                {departments.length} departments. Search a course, pick the
                semester, and read it right here.
              </p>
            )}
          </div>
          <CourseSearchTrigger className="flex h-16 max-w-xl items-center gap-3 rounded-full bg-surface pr-2 pl-6 text-muted-foreground transition-colors hover:bg-surface-high focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-none">
            <Search className="size-5 shrink-0" aria-hidden />
            <span className="flex-1 truncate text-base">
              Search {courseTotal > 0 ? `${formatNumber(courseTotal)} ` : ""}
              courses, e.g. Data Structure
            </span>
            <span
              className={cn(
                buttonVariants(),
                "pointer-events-none h-12 px-6 max-sm:hidden",
              )}
            >
              Search
            </span>
          </CourseSearchTrigger>
          {departments.length > 0 && (
            <nav
              aria-label="Departments"
              className="-mx-4 flex [scrollbar-width:none] gap-2 overflow-x-auto px-4 pb-1 sm:mx-0 sm:flex-wrap sm:px-0"
            >
              {departments.slice(0, 6).map((department) => (
                <Link
                  key={department.id}
                  to={`/questions/departments/${department.id}`}
                  title={department.name}
                  className="flex h-10 shrink-0 items-center gap-2 rounded-full border border-input pr-3.5 pl-1.5 text-sm transition-colors hover:bg-accent"
                >
                  <span className="rounded-full bg-primary-container px-2 py-0.5 text-xs font-bold text-primary-container-foreground">
                    {department.shortName}
                  </span>
                  <span className="text-muted-foreground tabular-nums">
                    {formatNumber(department.publishedCount)}
                  </span>
                </Link>
              ))}
            </nav>
          )}
        </div>
        <ShapeCluster />
      </section>

      {popular.length > 0 && (
        <section aria-labelledby="popular-heading" className="space-y-5">
          <SectionHeading
            id="popular-heading"
            title="Most viewed"
            link={{ to: "/questions/browse?sort=popular", label: "See all" }}
          />
          <ul className="-mx-4 flex snap-x snap-mandatory [scrollbar-width:none] gap-3 overflow-x-auto px-4 pb-1 sm:mx-0 sm:grid sm:grid-cols-2 sm:overflow-visible sm:px-0 lg:grid-cols-4">
            {popular.map((question) => (
              <li
                key={question.id}
                className="grid w-[72%] shrink-0 snap-start sm:w-auto"
              >
                <ExamTile question={question} />
              </li>
            ))}
          </ul>
        </section>
      )}

      {featured && (
        <section aria-labelledby="departments-heading" className="space-y-5">
          <SectionHeading
            id="departments-heading"
            title="Browse by department"
            link={{
              to: "/questions/departments",
              label: `All ${departments.length} departments`,
            }}
          />
          <ul className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <li className="col-span-2 grid lg:row-span-2">
              <DepartmentTile
                department={featured}
                courseCount={courseCounts[featured.id]}
                featured
              />
            </li>
            {others.slice(0, 4).map((department) => (
              <li key={department.id} className="grid">
                <DepartmentTile department={department} />
              </li>
            ))}
          </ul>
        </section>
      )}

      {newest.length > 0 && (
        <section aria-labelledby="newest-heading" className="space-y-5">
          <SectionHeading
            id="newest-heading"
            title="Recently added"
            link={{ to: "/questions/browse", label: "See all" }}
          />
          <QuestionCards questions={newest} />
        </section>
      )}

      <section className="grid gap-3 md:grid-cols-2">
        <div className="relative flex flex-col items-start gap-4 overflow-hidden rounded-[1.75rem] bg-surface p-7 sm:p-9">
          <ExamShape
            kind="midterm"
            className="absolute -top-4 -right-4 size-24 rotate-12"
          />
          <ExamShape kind="quiz" className="absolute top-16 right-20 size-8" />
          <h2 className="pr-24 font-expressive text-3xl sm:text-4xl">
            Just sat an exam?
          </h2>
          <p className="max-w-sm pr-10 text-pretty text-muted-foreground">
            Share the question paper. It takes a minute, the AI fills in the
            details, and it helps the next batch.
          </p>
          <Link
            to="/questions/contribute"
            className={buttonVariants({ size: "lg" })}
          >
            Share a paper
          </Link>
        </div>
        <div className="relative flex flex-col items-start gap-4 overflow-hidden rounded-[1.75rem] bg-primary p-7 text-primary-foreground sm:p-9">
          <ExamShape
            kind="final"
            colored={false}
            className="absolute -right-10 -bottom-12 size-56 text-primary-foreground/15"
          />
          <h2 className="relative font-expressive text-3xl sm:text-4xl">
            Papers in your pocket.
          </h2>
          <p className="relative max-w-sm text-pretty opacity-90">
            OurDIU for Android: save papers for exam week, and share a paper
            straight from your camera.
          </p>
          <Link
            to="/app"
            className={cn(
              buttonVariants({ size: "lg" }),
              "relative bg-primary-foreground text-primary hover:bg-primary-foreground/90",
            )}
          >
            {ANDROID_BETA ? "Try the app early" : "Get it on Google Play"}
          </Link>
        </div>
      </section>
    </div>
  );
}
