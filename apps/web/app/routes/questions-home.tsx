import type { ContributorList, QuestionList } from "@ourdiu/shared";
import { ArrowRight, Search, Smartphone, Upload, Users } from "lucide-react";
import { Link } from "react-router";
import { ContributorAvatar } from "~/components/contributor-avatar";
import { CourseSearchTrigger } from "~/components/course-search";
import { ExamBadge } from "~/components/exam-badge";
import { QuestionCards } from "~/components/question-cards";
import { buttonVariants } from "~/components/ui/button";
import { apiGetJson } from "~/lib/api.server";
import { AUTHOR } from "~/lib/author";
import { formatCount, formatNumber } from "~/lib/format";
import { loadTaxonomy } from "~/lib/taxonomy.server";
import { cn } from "~/lib/utils";
import type { Route } from "./+types/questions-home";

/** The first question of each course, so one course doesn't fill a section. */
function onePerCourse(questions: QuestionList["items"], limit = 6) {
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
  const [newest, popular, contributors, taxonomy] = await Promise.allSettled([
    apiGetJson<QuestionList>(
      request,
      "/api/v1/questions?sort=newest&pageSize=24",
    ),
    apiGetJson<QuestionList>(
      request,
      "/api/v1/questions?sort=popular&pageSize=24",
    ),
    apiGetJson<ContributorList>(request, "/api/v1/contributors?pageSize=1"),
    loadTaxonomy(request),
  ]);
  const value = <T,>(result: PromiseSettledResult<T>) =>
    result.status === "fulfilled" ? result.value : null;

  const stats = [
    { label: "questions", count: value(newest)?.total },
    { label: "courses", count: value(taxonomy)?.courses.length },
    { label: "contributors", count: value(contributors)?.total },
  ].filter((stat): stat is { label: string; count: number } =>
    Boolean(stat.count),
  );
  return {
    stats,
    newest: onePerCourse(value(newest)?.items ?? []),
    popular: onePerCourse(value(popular)?.items ?? []),
    // Departments without papers have nothing to browse yet; most papers first.
    departments: (value(taxonomy)?.departments ?? [])
      .filter((d) => d.publishedCount > 0)
      .sort((a, b) => b.publishedCount - a.publishedCount),
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

/** Below the lists: why it exists and what else there is, like the app's Account tab. */
const NOTES = [
  {
    icon: Users,
    title: "Built by students",
    description:
      "Papers are contributed by the community and reviewed before they are published.",
  },
  {
    icon: Smartphone,
    title: "Also on Android",
    description:
      "Save papers on your phone, read them full screen, and share one straight from your files.",
    link: { to: "/app", label: "Get the app" },
  },
];

function QuestionSection({
  id,
  title,
  href,
  questions,
}: {
  id: string;
  title: string;
  href: string;
  questions: QuestionList["items"];
}) {
  return (
    <section aria-labelledby={id} className="space-y-4">
      <div className="flex items-baseline justify-between gap-4">
        <h2 id={id} className="font-expressive text-2xl sm:text-3xl">
          {title}
        </h2>
        <Link
          to={href}
          className="inline-flex items-center gap-1 text-sm font-semibold text-primary underline-offset-4 hover:underline"
        >
          See all
          <ArrowRight className="size-4" aria-hidden />
        </Link>
      </div>
      <QuestionCards questions={questions} />
    </section>
  );
}

/** The four exam shapes, large, beside the heading on wide screens. */
function ShapeCluster() {
  return (
    <div aria-hidden className="relative hidden h-80 lg:block">
      <ExamBadge
        examType="Final"
        size={200}
        className="absolute top-2 left-8"
      />
      <ExamBadge
        examType="Midterm"
        size={152}
        className="absolute top-32 left-56"
      />
      <ExamBadge
        examType="Quiz"
        size={108}
        className="absolute top-52 left-0"
      />
      <ExamBadge
        examType="Lab Final"
        size={100}
        className="absolute top-0 left-64"
      />
    </div>
  );
}

export default function Home({ loaderData }: Route.ComponentProps) {
  const { stats, newest, popular, departments } = loaderData;
  const statLine = stats
    .map(({ label, count }) => `${formatNumber(count)} ${label}`)
    .join(" · ");

  return (
    <div className="space-y-14 py-2 sm:space-y-16 sm:py-8">
      <section className="grid grid-cols-1 items-center gap-10 lg:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)]">
        <div className="space-y-6">
          <div className="space-y-4">
            {statLine && (
              <p className="text-sm font-medium text-muted-foreground">
                {statLine}
              </p>
            )}
            <h1 className="font-expressive text-5xl sm:text-7xl">
              Find your paper
            </h1>
          </div>
          <CourseSearchTrigger className="flex h-14 max-w-xl items-center gap-3.5 rounded-full bg-muted pr-3 pl-5 text-muted-foreground transition-colors hover:bg-accent focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-none sm:h-15 sm:text-lg">
            <Search className="size-5 shrink-0" aria-hidden />
            <span className="flex-1 truncate">
              Search a course, like Data Structure
            </span>
            <kbd className="hidden rounded-lg border border-input px-2 py-0.5 font-sans text-sm sm:inline">
              /
            </kbd>
          </CourseSearchTrigger>
          {departments.length > 0 && (
            <nav
              aria-label="Departments"
              className="-mx-4 flex max-w-2xl [scrollbar-width:none] gap-2 overflow-x-auto px-4 pb-1 sm:mx-0 sm:flex-wrap sm:overflow-visible sm:px-0"
            >
              {departments.map((department) => (
                <Link
                  key={department.id}
                  to={`/questions/departments/${department.id}`}
                  title={department.name}
                  className="flex h-9 shrink-0 items-center gap-2 rounded-xl border border-input px-3.5 text-sm font-semibold transition-colors hover:bg-accent"
                >
                  {department.shortName}
                  <span className="text-xs font-medium text-muted-foreground tabular-nums">
                    {formatCount(department.publishedCount)}
                  </span>
                </Link>
              ))}
              <Link
                to="/questions/browse"
                className="flex h-9 shrink-0 items-center gap-1 px-2 text-sm font-semibold text-primary"
              >
                Browse all questions
                <ArrowRight className="size-4" aria-hidden />
              </Link>
            </nav>
          )}
        </div>
        <ShapeCluster />
      </section>

      {popular.length > 0 && (
        <QuestionSection
          id="popular-heading"
          title="Most viewed"
          href="/questions/browse?sort=popular"
          questions={popular}
        />
      )}
      {newest.length > 0 && (
        <QuestionSection
          id="newest-heading"
          title="Recently added"
          href="/questions/browse"
          questions={newest}
        />
      )}

      <section
        aria-labelledby="share-heading"
        className="flex flex-col gap-6 rounded-[1.75rem] bg-primary-container p-6 text-primary-container-foreground sm:p-10 md:flex-row md:items-center md:justify-between"
      >
        <div className="max-w-2xl space-y-3">
          <h2
            id="share-heading"
            className="font-expressive text-3xl sm:text-4xl"
          >
            Got last semester’s paper?
          </h2>
          <p className="text-pretty sm:text-lg">
            Share it in a minute. It’s checked, watermarked with your name, and
            the next batch gets to study from it.
          </p>
        </div>
        <Link
          to="/questions/contribute"
          className={cn(
            buttonVariants({ size: "lg" }),
            "h-12 shrink-0 self-start rounded-full px-6 md:self-auto",
          )}
        >
          <Upload aria-hidden />
          Contribute a paper
        </Link>
      </section>

      <section
        aria-label="About the Question Bank"
        className="grid gap-8 sm:grid-cols-3"
      >
        <div className="flex gap-4 sm:col-span-1">
          <ContributorAvatar
            name={AUTHOR.name}
            image={AUTHOR.avatar}
            size="lg"
            className="shrink-0"
          />
          <div className="space-y-1">
            <h2 className="font-semibold">Why is this free?</h2>
            <p className="text-sm text-pretty text-muted-foreground">
              Building this site helped me land a job, so now it gets to stay
              free forever. No ads, ever.{" "}
              <Link
                to="/about"
                className="font-medium whitespace-nowrap text-foreground underline-offset-4 hover:underline"
              >
                Read the story
              </Link>
            </p>
          </div>
        </div>
        {NOTES.map(({ icon: Icon, title, description, link }) => (
          <div key={title} className="flex gap-4">
            <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-muted">
              <Icon className="size-5" aria-hidden />
            </span>
            <div className="space-y-1">
              <h2 className="font-semibold">{title}</h2>
              <p className="text-sm text-pretty text-muted-foreground">
                {description}{" "}
                {link && (
                  <Link
                    to={link.to}
                    className="font-medium whitespace-nowrap text-foreground underline-offset-4 hover:underline"
                  >
                    {link.label}
                  </Link>
                )}
              </p>
            </div>
          </div>
        ))}
      </section>
    </div>
  );
}
