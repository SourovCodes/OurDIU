import type { ContributorList } from "@ourdiu/shared";
import { Users } from "lucide-react";
import { data, Link } from "react-router";
import { ContributorAvatar } from "~/components/contributor-avatar";
import { EmptyState } from "~/components/empty-state";
import { PageHeader } from "~/components/page-header";
import { TablePagination } from "~/components/table-pagination";
import {
  CARD_GRID,
  LINK_CARD,
  STRETCHED_LINK,
} from "~/components/question-cards";
import { Badge } from "~/components/ui/badge";
import { Card, CardTitle } from "~/components/ui/card";
import { apiFetch, readJson } from "~/lib/api.server";
import { formatCount } from "~/lib/format";
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

export default function Contributors({ loaderData }: Route.ComponentProps) {
  const { list } = loaderData;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Contributors"
        description="The students who share question papers with everyone."
      />

      <section aria-labelledby="contributors-heading" className="space-y-4">
        <h2 id="contributors-heading" className="text-sm font-medium">
          {plural(list.total, "contributor")}
        </h2>

        {list.items.length === 0 ? (
          <EmptyState
            icon={Users}
            title="No contributors yet"
            description="People who upload question papers will be listed here."
          />
        ) : (
          <ul aria-label="Contributors" className={CARD_GRID}>
            {list.items.map((contributor, index) => {
              const rank = (list.page - 1) * list.pageSize + index + 1;
              return (
                <li key={contributor.id} className="grid">
                  <Card className={cn(LINK_CARD, "gap-0 py-0")}>
                    <div className="flex items-center gap-4 p-4">
                      <ContributorAvatar
                        name={contributor.name}
                        image={contributor.image}
                        size="lg"
                      />
                      <div className="grid min-w-0 flex-1 gap-1">
                        <CardTitle className="truncate text-[0.9375rem] leading-snug">
                          <Link
                            to={contributorUrl(contributor.username)}
                            prefetch="intent"
                            className={STRETCHED_LINK}
                          >
                            {contributor.name}
                          </Link>
                        </CardTitle>
                        <p className="text-sm text-muted-foreground">
                          <span className="font-medium text-foreground">
                            {plural(contributor.publishedCount, "paper")}
                          </span>
                          {" · "}
                          {formatCount(contributor.viewCount)}{" "}
                          {contributor.viewCount === 1 ? "view" : "views"}
                        </p>
                        {contributor.departments.length > 0 && (
                          <p className="flex flex-wrap gap-1 pt-0.5">
                            {contributor.departments.slice(0, 3).map((d) => (
                              <Badge
                                key={d.id}
                                variant="secondary"
                                title={d.name}
                                className="font-normal"
                              >
                                {d.shortName}
                              </Badge>
                            ))}
                          </p>
                        )}
                      </div>
                      <span
                        className="self-start text-xs font-medium text-muted-foreground tabular-nums"
                        title={`Ranked #${rank} by published papers`}
                      >
                        #{rank}
                      </span>
                    </div>
                  </Card>
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
    </div>
  );
}
