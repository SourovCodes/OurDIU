import type { QuestionList, QuestionSort } from "@ourdiu/shared";
import { LayoutGrid, SearchX, SlidersHorizontal, X } from "lucide-react";
import {
  data,
  Link,
  redirect,
  useNavigation,
  useSearchParams,
} from "react-router";
import { EmptyState } from "~/components/empty-state";
import { QuestionCards } from "~/components/question-cards";
import { SearchableSelect } from "~/components/searchable-select";
import { TablePagination } from "~/components/table-pagination";
import { Badge } from "~/components/ui/badge";
import { Button, buttonVariants } from "~/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "~/components/ui/select";
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "~/components/ui/sheet";
import { apiFetch, readJson } from "~/lib/api.server";
import {
  forgetDepartment,
  forgetDepartmentCookie,
  rememberDepartmentCookie,
  rememberedDepartment,
} from "~/lib/department-preference";
import {
  applyFilter,
  courseOptions,
  FILTER_KEYS,
  LIST_KEYS,
  type FilterKey,
} from "~/lib/filters";
import { plural } from "~/lib/submissions";
import { loadTaxonomy } from "~/lib/taxonomy.server";
import { cn } from "~/lib/utils";
import type { Route } from "./+types/questions";

export const meta: Route.MetaFunction = () => [
  { title: "All papers — OurDIU Question Bank" },
  {
    name: "description",
    content:
      "Browse past exam question papers by department, course, semester and exam type.",
  },
];

/** Fills a grid of one, two or three columns without a gap on the last row. */
const PAGE_SIZE = 24;

export async function loader({ request }: Route.LoaderArgs) {
  const url = new URL(request.url);
  const departmentId = url.searchParams.get("departmentId");

  // "Clear" (`?clear`): forget the department, keep the sort. A link rather than a
  // script, so it works before the page has hydrated.
  if (url.searchParams.has("clear")) {
    const sort = url.searchParams.get("sort");
    throw redirect(
      sort
        ? `/questions/browse?sort=${encodeURIComponent(sort)}`
        : "/questions/browse",
      {
        headers: { "set-cookie": forgetDepartmentCookie },
      },
    );
  }

  // A bare /questions opens on the department the visitor last filtered by.
  const remembered = rememberedDepartment(request.headers.get("cookie"));
  if (url.search === "" && remembered) {
    throw redirect(`/questions/browse?departmentId=${remembered}`);
  }

  const query = new URLSearchParams({ pageSize: String(PAGE_SIZE) });
  for (const key of [...FILTER_KEYS, ...LIST_KEYS, "page"]) {
    const value = url.searchParams.get(key);
    if (value) query.set(key, value);
  }

  const [taxonomy, questionsRes] = await Promise.all([
    loadTaxonomy(request),
    apiFetch(request, `/api/v1/questions?${query}`),
  ]);

  const invalid = questionsRes.status === 422;
  if (!questionsRes.ok && !invalid) {
    throw data("Failed to load questions", { status: 502 });
  }
  const list: QuestionList = invalid
    ? { items: [], page: 1, pageSize: PAGE_SIZE, total: 0 }
    : await readJson<QuestionList>(questionsRes);

  // Remember a valid department; an unknown one is dropped, not remembered.
  const knownDepartment =
    departmentId !== null &&
    taxonomy.departments.some((d) => String(d.id) === departmentId);
  return data(
    { ...taxonomy, list, invalid },
    knownDepartment
      ? { headers: { "set-cookie": rememberDepartmentCookie(departmentId) } }
      : undefined,
  );
}

const SORT_LABELS: Record<QuestionSort, string> = {
  newest: "Newest papers",
  popular: "Most viewed",
  az: "A–Z",
};

const FILTER_NOUNS: Record<FilterKey, string> = {
  departmentId: "department",
  courseId: "course",
  semesterId: "semester",
  examTypeId: "exam type",
};

export default function Questions({ loaderData }: Route.ComponentProps) {
  const { departments, courses, semesters, examTypes, list, invalid } =
    loaderData;
  const [searchParams, setSearchParams] = useSearchParams();
  const navigation = useNavigation();
  const loading =
    navigation.state === "loading" &&
    navigation.location.pathname === "/questions/browse";

  const departmentId = searchParams.get("departmentId");
  const sort = (searchParams.get("sort") as QuestionSort | null) ?? "newest";
  const activeFilters = FILTER_KEYS.filter((key) => searchParams.has(key));
  const hasFilters = activeFilters.length > 0;

  const setSort = (value: string) => {
    const next = new URLSearchParams(searchParams);
    if (value === "newest") next.delete("sort");
    else next.set("sort", value);
    next.delete("page");
    setSearchParams(next, { preventScrollReset: true });
  };

  const setFilter = (key: FilterKey, value: string | null) => {
    // Choosing "All departments" also stops remembering one.
    if (key === "departmentId" && value === null) forgetDepartment();
    setSearchParams(applyFilter(searchParams, key, value, courses), {
      preventScrollReset: true,
    });
  };

  const clearHref = searchParams.has("sort")
    ? `/questions/browse?clear&sort=${encodeURIComponent(searchParams.get("sort")!)}`
    : "/questions/browse?clear";

  /** Labels of the chosen filters, for the chips on phones. */
  const labelFor = (key: FilterKey, id: string) => {
    const match = (list: { id: number; name: string }[]) =>
      list.find((item) => String(item.id) === id)?.name;
    switch (key) {
      case "departmentId":
        return departments.find((d) => String(d.id) === id)?.shortName;
      case "courseId":
        return match(courses);
      case "semesterId":
        return match(semesters);
      case "examTypeId":
        return match(examTypes);
    }
  };

  const filterFields = (
    <>
      <SearchableSelect
        label="Department"
        placeholder="All departments"
        searchPlaceholder="Search departments…"
        emptyText="No department found."
        options={departments.map((d) => ({
          value: String(d.id),
          label: `${d.name} (${d.shortName})`,
        }))}
        value={departmentId}
        onChange={(value) => setFilter("departmentId", value)}
      />
      <SearchableSelect
        label="Course"
        placeholder="All courses"
        searchPlaceholder="Search courses…"
        emptyText="No course found."
        options={courseOptions(courses, departments, departmentId)}
        value={searchParams.get("courseId")}
        onChange={(value) => setFilter("courseId", value)}
      />
      <SearchableSelect
        label="Semester"
        placeholder="All semesters"
        searchPlaceholder="Search semesters…"
        emptyText="No semester found."
        options={semesters.map((s) => ({
          value: String(s.id),
          label: s.name,
        }))}
        value={searchParams.get("semesterId")}
        onChange={(value) => setFilter("semesterId", value)}
      />
      <SearchableSelect
        label="Exam type"
        placeholder="All exam types"
        searchPlaceholder="Search exam types…"
        emptyText="No exam type found."
        options={examTypes.map((e) => ({
          value: String(e.id),
          label: e.name,
        }))}
        value={searchParams.get("examTypeId")}
        onChange={(value) => setFilter("examTypeId", value)}
      />
    </>
  );

  const sortSelect = (size: "sm" | "default") => (
    <Select value={sort} onValueChange={setSort}>
      <SelectTrigger
        size={size}
        aria-label="Sort questions"
        className={cn(size === "default" && "flex-1")}
      >
        {/* The label itself: Radix only knows it once the list has opened. */}
        <SelectValue>{SORT_LABELS[sort]}</SelectValue>
      </SelectTrigger>
      <SelectContent align="end">
        {(Object.keys(SORT_LABELS) as QuestionSort[]).map((value) => (
          <SelectItem key={value} value={value}>
            {SORT_LABELS[value]}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );

  const pageHref = (page: number) => {
    const params = new URLSearchParams(searchParams);
    params.set("page", String(page));
    return `/questions/browse?${params}`;
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
        <div className="space-y-3">
          <h1 className="font-display-xl text-5xl sm:text-7xl">All papers</h1>
          <p className="text-muted-foreground">
            Pick a department, course, semester or exam type, in any
            combination.
          </p>
        </div>
        <Link
          to="/questions/departments"
          className={buttonVariants({ variant: "outline" })}
        >
          <LayoutGrid aria-hidden />
          Browse by department
        </Link>
      </div>

      {/* From `sm` up the four pickers sit in one toolbar; on phones they'd push the
          results below the fold, so they live in a sheet behind one button. */}
      <div
        role="search"
        aria-label="Filter questions"
        className="hidden gap-4 rounded-3xl bg-surface p-5 sm:grid sm:grid-cols-2 lg:grid-cols-4"
      >
        {filterFields}
      </div>

      <div className="space-y-3 sm:hidden">
        <div className="flex gap-2">
          <Sheet>
            <SheetTrigger asChild>
              <Button variant="outline" className="flex-1 justify-between">
                <span className="flex items-center gap-2">
                  <SlidersHorizontal aria-hidden />
                  Filters
                </span>
                {hasFilters && (
                  <Badge variant="secondary">{activeFilters.length}</Badge>
                )}
              </Button>
            </SheetTrigger>
            <SheetContent side="bottom" className="max-h-[85svh]">
              <SheetHeader>
                <SheetTitle>Filter questions</SheetTitle>
                <SheetDescription>
                  Pick a course and exam type to compare semesters.
                </SheetDescription>
              </SheetHeader>
              <div
                role="search"
                aria-label="Filter questions"
                className="grid gap-4 overflow-y-auto px-4"
              >
                {filterFields}
              </div>
              <SheetFooter className="flex-row">
                {hasFilters && (
                  <Button variant="outline" className="flex-1" asChild>
                    <Link to={clearHref} preventScrollReset>
                      Clear
                    </Link>
                  </Button>
                )}
                <SheetClose asChild>
                  <Button className="flex-1" disabled={loading}>
                    {loading
                      ? "Loading…"
                      : `Show ${plural(list.total, "question")}`}
                  </Button>
                </SheetClose>
              </SheetFooter>
            </SheetContent>
          </Sheet>
          {/* Same height as the Filters button beside it. */}
          {sortSelect("default")}
        </div>
        {hasFilters && (
          <ul aria-label="Active filters" className="flex flex-wrap gap-2">
            {activeFilters.map((key) => (
              <li key={key}>
                <Button
                  variant="secondary"
                  size="sm"
                  className="h-7 rounded-full pr-2"
                  onClick={() => setFilter(key, null)}
                  aria-label={`Remove ${FILTER_NOUNS[key]} filter`}
                >
                  {labelFor(key, searchParams.get(key)!) ?? FILTER_NOUNS[key]}
                  <X aria-hidden />
                </Button>
              </li>
            ))}
          </ul>
        )}
      </div>

      <section
        aria-labelledby="results-heading"
        aria-busy={loading}
        className={cn("space-y-4 transition-opacity", loading && "opacity-60")}
      >
        <div className="flex min-h-9 items-center justify-between gap-3">
          <h2 id="results-heading" className="text-sm font-medium">
            {plural(list.total, "question")}
          </h2>
          <div className="flex items-center gap-2 max-sm:hidden">
            {hasFilters && (
              <Button variant="ghost" size="sm" asChild>
                <Link to={clearHref} preventScrollReset>
                  <X />
                  Clear filters
                </Link>
              </Button>
            )}
            {sortSelect("sm")}
          </div>
        </div>

        {invalid && (
          <p role="alert" className="text-sm text-destructive">
            Those filters look invalid. Try clearing them.
          </p>
        )}

        {list.items.length === 0 ? (
          <EmptyState
            icon={SearchX}
            title={
              hasFilters
                ? "No questions match these filters"
                : "No questions yet"
            }
            description={
              hasFilters
                ? "Try removing a filter or choosing a different combination."
                : "Question papers will show up here once they are contributed."
            }
            action={
              hasFilters ? (
                <Button variant="outline" size="sm" asChild>
                  <Link to={clearHref} preventScrollReset>
                    Clear filters
                  </Link>
                </Button>
              ) : (
                <Button variant="outline" size="sm" asChild>
                  <Link to="/questions/contribute">Share a paper</Link>
                </Button>
              )
            }
          />
        ) : (
          <QuestionCards questions={list.items} />
        )}

        <TablePagination
          page={list.page}
          pageSize={list.pageSize}
          total={list.total}
          noun="question"
          hrefFor={pageHref}
        />
      </section>
    </div>
  );
}
