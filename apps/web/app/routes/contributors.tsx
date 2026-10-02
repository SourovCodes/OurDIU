import type { ContributorList } from "@ourdiu/shared";
import { Plus, Users } from "lucide-react";
import { data, Link } from "react-router";
import { ContributorAvatar } from "~/components/contributor-avatar";
import { EmptyState } from "~/components/empty-state";
import { EXAM_TONE } from "~/components/exam-badge";
import { TablePagination } from "~/components/table-pagination";
import { buttonVariants } from "~/components/ui/button";
import { apiFetch, readJson } from "~/lib/api.server";
import { formatCount, formatNumber } from "~/lib/format";
import { contributorUrl, plural } from "~/lib/submissions";
import { cn } from "~/lib/utils";
import type { Route } from "./+types/contributors";

export const meta: Route.MetaFunction = () => [
  { title: "Contributors — OurDIU Question Bank" },
  {
    name: "description",
    content:
      "The students sharing past question papers on the OurDIU Question Bank.",
  },
];

export async function loader({ request }: Route.LoaderArgs) {
  const page = new URL(request.url).searchParams.get("page");
  // 24 fills a grid of one, two or three columns.
  const query = new URLSearchParams({ pageSize: "24" });
  if (page) query.set("page", page);
  const res = await apiFetch(request, `/api/v1/contributors?${query}`);

  if (res.status === 422) {
    const empty: ContributorList = {
      items: [],
      page: 1,
      pageSize: 24,
      total: 0,
    };
    return { list: empty };
  }
  if (!res.ok) throw data("Failed to load contributors", { status: 502 });
  return { list: await readJson<ContributorList>(res) };
}

/** The top three, on the first page: tiles in the exam colours. */
const PODIUM = [EXAM_TONE.final, EXAM_TONE.midterm, EXAM_TONE.quiz];

export default function Contributors({ loaderData }: Route.ComponentProps) {
  const { list } = loaderData;

  return (
    <div className="space-y-8">
      <div className="space-y-3">
        <h1 className="font-display-xl text-5xl sm:text-7xl">Contributors</h1>
        <p className="max-w-xl text-muted-foreground">
          The {formatNumber(list.total)} students who share question papers with
          everyone. Most papers first.
        </p>
      </div>

      <section className="space-y-4">
        {list.items.length === 0 ? (
          <EmptyState
            icon={Users}
            title="No contributors yet"
            description="People who upload question papers will be listed here."
          />
        ) : (
          <ul
            aria-label="Contributors"
            className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3"
          >
            {list.items.map((contributor, index) => {
              const rank = (list.page - 1) * list.pageSize + index + 1;
              const podium = rank <= 3 ? PODIUM[rank - 1] : null;
              return (
                <li key={contributor.id} className="grid">
                  <Link
                    to={contributorUrl(contributor.username)}
                    prefetch="intent"
                    className={cn(
                      "flex gap-4 rounded-3xl transition-[background-color,scale] focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-none active:scale-[0.99]",
                      podium
                        ? cn(
                            "min-h-52 flex-col justify-between p-6 hover:state-layer",
                            podium,
                          )
                        : "items-center bg-surface p-4 hover:state-layer",
                    )}
                  >
                    {podium ? (
                      <>
                        <div className="flex items-start justify-between">
                          <ContributorAvatar
                            name={contributor.name}
                            image={contributor.image}
                            size="xl"
                          />
                          <span
                            className="font-display-xl text-6xl opacity-80"
                            title={`Ranked #${rank} by published papers`}
                          >
                            #{rank}
                          </span>
                        </div>
                        <ContributorText contributor={contributor} large />
                      </>
                    ) : (
                      <>
                        <ContributorAvatar
                          name={contributor.name}
                          image={contributor.image}
                          size="lg"
                        />
                        <ContributorText contributor={contributor} />
                        <span
                          className="self-start text-sm font-semibold text-muted-foreground tabular-nums"
                          title={`Ranked #${rank} by published papers`}
                        >
                          #{rank}
                        </span>
                      </>
                    )}
                  </Link>
                </li>
              );
            })}
          </ul>
        )}

        <TablePagination
          page={list.page}
          pageSize={list.pageSize}
          total={list.total}
          noun="contributor"
          hrefFor={(page) => `/questions/contributors?page=${page}`}
        />
      </section>

      <section
        aria-labelledby="join-heading"
        className="flex flex-col gap-4 rounded-[1.75rem] bg-primary-container p-6 text-primary-container-foreground sm:flex-row sm:items-center sm:justify-between sm:p-8"
      >
        <div className="space-y-1.5">
          <h2 id="join-heading" className="font-expressive text-2xl">
            Your name could be here
          </h2>
          <p className="max-w-xl text-pretty opacity-85">
            Just sat an exam? Share the paper; it takes a minute, and the next
            batch studies from it.
          </p>
        </div>
        <Link
          to="/questions/contribute"
          className={cn(buttonVariants({ size: "lg" }), "shrink-0")}
        >
          <Plus aria-hidden />
          Share a paper
        </Link>
      </section>
    </div>
  );
}

function ContributorText({
  contributor,
  large = false,
}: {
  contributor: ContributorList["items"][number];
  large?: boolean;
}) {
  return (
    <span className="grid min-w-0 flex-1 gap-1">
      <span
        className={cn(
          "truncate",
          large ? "font-expressive text-2xl" : "font-semibold",
        )}
      >
        {contributor.name}
      </span>
      <span className={cn("text-sm", !large && "text-muted-foreground")}>
        <span className="font-semibold">
          {plural(contributor.publishedCount, "paper")}
        </span>
        {" · "}
        {formatCount(contributor.viewCount)}{" "}
        {contributor.viewCount === 1 ? "view" : "views"}
        {contributor.departments.length > 0 &&
          ` · ${contributor.departments
            .slice(0, 3)
            .map((d) => d.shortName)
            .join(", ")}`}
      </span>
    </span>
  );
}
