import type { ContributorDetail } from "@ourdiu/shared";
import { data, Link, redirect, useSearchParams } from "react-router";
import { ContributorAvatar } from "~/components/contributor-avatar";
import { Breadcrumbs } from "~/components/page-header";
import { SubmissionCards } from "~/components/submission-cards";
import { TablePagination } from "~/components/table-pagination";
import { UrlTabs } from "~/components/url-tabs";
import { apiFetch, readJson } from "~/lib/api.server";
import { formatMonth } from "~/lib/dates";
import { formatCount } from "~/lib/format";
import { contributorUrl, plural } from "~/lib/submissions";
import type { Route } from "./+types/contributor";
import { pageMeta, QB_NAME } from "~/lib/seo";

export async function loader({ request, params }: Route.LoaderArgs) {
  const url = new URL(request.url);
  const query = new URLSearchParams();
  for (const key of ["page", "departmentId"]) {
    const value = url.searchParams.get(key);
    if (value) query.set(key, value);
  }
  const res = await apiFetch(
    request,
    `/api/v1/contributors/${encodeURIComponent(params.username)}?${query}`,
  );
  if (res.status === 404 || res.status === 422) {
    throw data("Contributor not found", { status: 404 });
  }
  if (!res.ok) throw data("Failed to load contributor", { status: 502 });
  const contributor = await readJson<ContributorDetail>(res);
  // Found by user id (links from before usernames) or in other case: send to the
  // one URL for this page.
  if (contributor.username !== params.username) {
    throw redirect(`${contributorUrl(contributor.username)}${url.search}`, 301);
  }
  return { contributor };
}

export const meta: Route.MetaFunction = ({ loaderData }) => {
  if (!loaderData) return [{ title: `Contributor not found — ${QB_NAME}` }];
  const { name, publishedCount } = loaderData.contributor;
  return pageMeta({
    title: `${name} — Contributor — ${QB_NAME}`,
    description: `${name} has shared ${plural(publishedCount, "question paper")} on the ${QB_NAME}.`,
  });
};

function Stat({ value, label }: { value: string; label: string }) {
  return (
    <div className="grid gap-1 rounded-2xl bg-card/60 px-4 py-3">
      <dd className="font-expressive text-2xl tabular-nums">{value}</dd>
      <dt className="text-xs font-medium opacity-80">{label}</dt>
    </div>
  );
}

export default function ContributorPage({ loaderData }: Route.ComponentProps) {
  const { contributor } = loaderData;
  const papers = contributor.submissions;
  const [searchParams] = useSearchParams();
  const departmentId = searchParams.get("departmentId");
  const { departments } = contributor;

  // One tab per department they've shared papers for, when there's more than one.
  const tabs = [
    {
      value: "all",
      label: "All",
      search: "",
      count: contributor.publishedCount,
    },
    ...departments.map((department) => ({
      value: String(department.id),
      label: department.shortName,
      search: `?departmentId=${department.id}`,
      count: department.publishedCount,
    })),
  ];
  const hrefFor = (page: number) => {
    const params = new URLSearchParams();
    if (departmentId) params.set("departmentId", departmentId);
    if (page > 1) params.set("page", String(page));
    return `?${params}`;
  };

  const list = (
    <>
      <SubmissionCards submissions={papers.items} />
      <TablePagination
        page={papers.page}
        pageSize={papers.pageSize}
        total={papers.total}
        noun="paper"
        hrefFor={hrefFor}
      />
    </>
  );

  return (
    <div className="space-y-8">
      <div className="space-y-4">
        <Breadcrumbs
          crumbs={[
            { label: "Contributors", to: "/questions/contributors" },
            { label: contributor.name },
          ]}
        />
        <section className="grid grid-cols-1 gap-6 rounded-[2rem] bg-primary-container p-6 text-primary-container-foreground sm:p-8 md:grid-cols-[minmax(0,1fr)_auto] md:items-end">
          <div className="flex min-w-0 items-center gap-5">
            <ContributorAvatar
              name={contributor.name}
              image={contributor.image}
              size="xl"
              className="size-24 text-3xl max-sm:size-16 max-sm:text-xl"
            />
            <div className="min-w-0 space-y-1.5">
              <h1 className="font-display-xl text-3xl break-words sm:text-5xl">
                {contributor.name}
              </h1>
              <p className="text-sm opacity-85">
                Contributor since {formatMonth(contributor.joinedAt)}
              </p>
            </div>
          </div>
          <dl className="grid grid-cols-3 gap-2">
            <Stat
              value={formatCount(contributor.publishedCount)}
              label={contributor.publishedCount === 1 ? "paper" : "papers"}
            />
            <Stat
              value={formatCount(contributor.viewCount)}
              label={contributor.viewCount === 1 ? "view" : "views"}
            />
            <Stat
              value={String(departments.length)}
              label={departments.length === 1 ? "department" : "departments"}
            />
          </dl>
        </section>
      </div>

      <section aria-labelledby="papers-heading" className="space-y-4">
        <div className="flex items-center justify-between gap-3">
          <h2 id="papers-heading" className="font-expressive text-2xl">
            Papers
          </h2>
          <Link
            to="/questions/contribute"
            className="text-sm font-semibold text-primary underline-offset-4 hover:underline"
          >
            Share a paper too
          </Link>
        </div>
        {departments.length > 1 ? (
          <UrlTabs
            label="Filter by department"
            tabs={tabs}
            value={departmentId ?? "all"}
          >
            {list}
          </UrlTabs>
        ) : (
          list
        )}
      </section>
    </div>
  );
}
