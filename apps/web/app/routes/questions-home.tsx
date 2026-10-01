import type { ContributorList, QuestionList } from "@ourdiu/shared";
import {
  ArrowRight,
  ChevronRight,
  Download,
  SlidersHorizontal,
  Sparkles,
  Users,
} from "lucide-react";
import { Link } from "react-router";
import { ContributorAvatar } from "~/components/contributor-avatar";
import {
  CARD_GRID,
  LINK_CARD,
  QuestionCards,
  STRETCHED_LINK,
} from "~/components/question-cards";
import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import {
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
} from "~/components/ui/card";
import { apiGetJson } from "~/lib/api.server";
import { AUTHOR } from "~/lib/author";
import { formatCount } from "~/lib/format";
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
    // Departments without papers have nothing to browse yet.
    departments: (value(taxonomy)?.departments ?? []).filter(
      (d) => d.publishedCount > 0,
    ),
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

const FEATURES = [
  {
    icon: SlidersHorizontal,
    title: "Filter precisely",
    description:
      "Narrow down by department, course, semester and exam type to find exactly the paper you need.",
  },
  {
    icon: Download,
    title: "Read anywhere",
    description:
      "View papers right in the browser on any device, or download the PDF for later.",
  },
  {
    icon: Users,
    title: "Built by students",
    description:
      "Papers are contributed by the community and reviewed before they are published.",
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
        <h2 id={id} className="text-xl font-semibold tracking-tight">
          {title}
        </h2>
        <Link
          to={href}
          className="inline-flex items-center gap-1 text-sm font-medium text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
        >
          See all
          <ArrowRight className="size-4" aria-hidden />
        </Link>
      </div>
      <QuestionCards questions={questions} />
    </section>
  );
}

export default function Home({ loaderData }: Route.ComponentProps) {
  const { stats, newest, popular, departments } = loaderData;

  return (
    <div className="space-y-16 py-4 sm:py-12">
      <section className="mx-auto flex max-w-3xl flex-col items-center gap-6 text-center">
        <Badge variant="secondary" className="rounded-full px-3 py-1">
          <Sparkles />
          Free · Community-contributed
        </Badge>
        <h1 className="text-4xl font-semibold tracking-tight text-balance sm:text-5xl">
          Past question papers, all in one place
        </h1>
        <p className="max-w-xl text-lg text-pretty text-muted-foreground">
          Find previous exam questions by course, department, semester and exam
          type, then read them right in your browser.
        </p>
        <div className="flex flex-wrap justify-center gap-3">
          <Button size="lg" asChild>
            <Link to="/questions/browse">
              Browse questions
              <ArrowRight />
            </Link>
          </Button>
          <Button size="lg" variant="outline" asChild>
            <Link to="/questions/contribute">Contribute a paper</Link>
          </Button>
        </div>
        {stats.length > 0 && (
          <dl className="flex flex-wrap justify-center gap-x-8 gap-y-2 pt-2">
            {stats.map(({ label, count }) => (
              <div key={label} className="flex items-baseline gap-1.5">
                <dd className="text-2xl font-semibold tabular-nums">
                  {formatCount(count)}
                </dd>
                <dt className="text-sm text-muted-foreground">{label}</dt>
              </div>
            ))}
          </dl>
        )}
      </section>

      {newest.length > 0 && (
        <QuestionSection
          id="newest-heading"
          title="Newest papers"
          href="/questions/browse"
          questions={newest}
        />
      )}
      {popular.length > 0 && (
        <QuestionSection
          id="popular-heading"
          title="Most viewed"
          href="/questions/browse?sort=popular"
          questions={popular}
        />
      )}

      {departments.length > 0 && (
        <section aria-labelledby="departments-heading" className="space-y-4">
          <h2
            id="departments-heading"
            className="text-xl font-semibold tracking-tight"
          >
            Browse by department
          </h2>
          <ul className={CARD_GRID}>
            {departments.map((department) => (
              <li key={department.id} className="grid">
                <Card className={cn(LINK_CARD, "py-4")}>
                  <CardHeader className="flex items-center gap-3 px-4">
                    <div className="grid min-w-0 flex-1 gap-1">
                      <CardTitle className="text-sm leading-snug">
                        <Link
                          to={`/questions/browse?departmentId=${department.id}`}
                          className={STRETCHED_LINK}
                        >
                          {department.name}
                        </Link>
                      </CardTitle>
                      <CardDescription className="text-xs">
                        {/* Some short names are just the name in capitals. */}
                        {department.shortName.toLowerCase() !==
                          department.name.toLowerCase() &&
                          `${department.shortName} · `}
                        {formatCount(department.publishedCount)}{" "}
                        {department.publishedCount === 1 ? "paper" : "papers"}
                      </CardDescription>
                    </div>
                    <ChevronRight
                      className="size-4 shrink-0 text-muted-foreground"
                      aria-hidden
                    />
                  </CardHeader>
                </Card>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section
        aria-label="Features"
        className="grid gap-4 *:data-[slot=card]:bg-gradient-to-t *:data-[slot=card]:from-primary/5 *:data-[slot=card]:to-card *:data-[slot=card]:shadow-xs sm:grid-cols-3"
      >
        {FEATURES.map(({ icon: Icon, title, description }) => (
          <Card key={title}>
            <CardHeader>
              <div className="mb-2 flex size-9 items-center justify-center rounded-lg border bg-background shadow-xs">
                <Icon className="size-4" aria-hidden />
              </div>
              <CardTitle>
                <h2>{title}</h2>
              </CardTitle>
              <CardDescription>{description}</CardDescription>
            </CardHeader>
          </Card>
        ))}
      </section>

      <section
        aria-labelledby="why-free-heading"
        className="mx-auto flex max-w-2xl flex-col items-center gap-4 rounded-xl border bg-muted/40 p-6 text-center sm:flex-row sm:text-left"
      >
        <ContributorAvatar
          name={AUTHOR.name}
          image={AUTHOR.avatar}
          size="lg"
          className="shrink-0"
        />
        <div className="grid gap-1">
          <h2 id="why-free-heading" className="font-semibold">
            Why is this free?
          </h2>
          <p className="text-sm text-pretty text-muted-foreground">
            Short version: building this site helped me land a job, so now it
            gets to stay free forever. No ads, ever.{" "}
            <Link
              to="/about"
              className="inline-flex items-center gap-1 font-medium whitespace-nowrap text-foreground underline-offset-4 hover:underline"
            >
              Read the story
              <ArrowRight className="size-3.5" aria-hidden />
            </Link>
          </p>
        </div>
      </section>
    </div>
  );
}
