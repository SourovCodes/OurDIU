import type { RoutineSectionList } from "@ourdiu/shared";
import { CalendarClock, ChevronRight } from "lucide-react";
import { data, Link } from "react-router";
import { ComingSoon } from "~/components/coming-soon";
import { NARROW_PAGE } from "~/components/page-header";
import { SectionSearch } from "~/components/routine";
import { apiFetch, readJson } from "~/lib/api.server";
import { formatDate } from "~/lib/dates";
import { product as findProduct } from "~/lib/products";
import {
  pickLabel,
  routineHref,
  savedRoutine,
  sectionChoices,
  type RoutineDepartmentSlug,
} from "~/lib/routine";
import { pageMeta } from "~/lib/seo";
import { cn } from "~/lib/utils";
import type { Route } from "./+types/routine";

const product = findProduct("routine");
const DEPARTMENT: RoutineDepartmentSlug = "cse";

export const meta: Route.MetaFunction = () =>
  pageMeta({
    title: "DIU Class Routine — find your section's classes | OurDIU",
    description:
      "The DIU CSE class routine by section: today's classes, your week with lab groups, rooms and teachers, and a PDF to download.",
  });

export async function loader({ request }: Route.LoaderArgs) {
  const res = await apiFetch(request, `/api/v1/routine/${DEPARTMENT}/sections`);
  // Until a routine is live, the space stays "coming soon".
  if (res.status === 404) return { list: null, saved: null };
  if (!res.ok) throw data("API request failed", { status: 502 });
  const list = await readJson<RoutineSectionList>(res);
  const saved = savedRoutine(request.headers.get("cookie"));
  return {
    list,
    saved:
      saved && list.sections.some((s) => s.section === saved.section)
        ? saved
        : null,
  };
}

/** The batch a section belongs to ("67" for 67_B), or null for retakes and others. */
const batchOf = (section: string) => /^(\d+)_/.exec(section)?.[1] ?? null;

/** /routine: find your section. */
export default function Routine({ loaderData }: Route.ComponentProps) {
  const { list, saved } = loaderData;
  if (!list) return <ComingSoon product={product} />;

  const choices = sectionChoices(list.sections);
  const batches = new Map<string, string[]>();
  for (const { section } of list.sections) {
    const batch = batchOf(section) ?? "Others";
    batches.set(batch, [...(batches.get(batch) ?? []), section]);
  }
  const ordered = [...batches.entries()].sort(([a], [b]) =>
    a === "Others" ? 1 : b === "Others" ? -1 : Number(b) - Number(a),
  );

  return (
    <div className="space-y-12">
      <section className={cn(NARROW_PAGE, "space-y-6 pt-4 text-center")}>
        <h1 className="font-display-xl text-5xl text-balance sm:text-6xl">
          Find your class routine.
        </h1>
        <p className="text-muted-foreground">
          <span className="rounded-lg bg-primary-container px-2 py-0.5 text-sm font-semibold text-primary-container-foreground">
            {list.version.department}
          </span>{" "}
          Routine v{list.version.version}
          {list.version.publishedOn &&
            `, published ${formatDate(list.version.publishedOn)}`}
          . More departments later.
        </p>
        <div className="mx-auto max-w-xl text-left">
          <SectionSearch
            department={DEPARTMENT}
            choices={choices}
            autoFocus={!saved}
          />
        </div>
        {saved && (
          <Link
            to={routineHref(saved)}
            className="mx-auto flex max-w-xl items-center gap-4 rounded-3xl bg-primary-container px-5 py-4 text-left text-primary-container-foreground transition-colors hover:state-layer"
          >
            <CalendarClock className="size-6 shrink-0" aria-hidden />
            <span className="min-w-0 flex-1">
              <span className="block text-sm opacity-85">My section</span>
              <span className="font-expressive text-2xl">
                {pickLabel(saved)}
              </span>
            </span>
            <ChevronRight className="size-5 shrink-0" aria-hidden />
          </Link>
        )}
      </section>

      <section className="space-y-5" aria-labelledby="all-sections">
        <h2 id="all-sections" className="font-expressive text-2xl">
          Every section
        </h2>
        <div className="grid gap-x-8 gap-y-5 md:grid-cols-2">
          {ordered.map(([batch, sections]) => (
            <div key={batch} className="grid gap-2">
              <h3 className="text-sm font-semibold text-muted-foreground">
                {batch === "Others" ? "Retakes and others" : `Batch ${batch}`}
              </h3>
              <ul className="flex flex-wrap gap-1.5">
                {sections.map((section) => (
                  <li key={section}>
                    <Link
                      to={routineHref({
                        department: DEPARTMENT,
                        section,
                        group: null,
                      })}
                      className="inline-flex h-9 items-center rounded-xl border border-input px-3 text-sm font-medium transition-colors hover:state-layer"
                    >
                      {section}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
