import type { AdminRoutineCourseList } from "@ourdiu/shared";
import { BookOpenText, Search, Trash2 } from "lucide-react";
import { useState } from "react";
import { Form, Link } from "react-router";
import { ConfirmAction, useFormAction } from "~/components/actions";
import { AdminPageHeader } from "~/components/admin/admin-header";
import {
  catalogApiQuery,
  catalogSearch,
  catalogViewOf,
  departmentTabs,
  InlineEdit,
  SelectionBar,
  type CatalogView,
} from "~/components/admin/routine";
import { AdminRouteError } from "~/components/admin/route-error";
import { EmptyState } from "~/components/empty-state";
import { TablePagination } from "~/components/table-pagination";
import { Button, buttonVariants } from "~/components/ui/button";
import { Checkbox } from "~/components/ui/checkbox";
import { Input } from "~/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "~/components/ui/table";
import { UrlTabs } from "~/components/url-tabs";
import { adminGetJson } from "~/lib/admin.server";
import { routineCatalogAction } from "~/lib/routine-admin.server";
import { cn } from "~/lib/utils";
import type { Route } from "./+types/admin-routine-courses";

export const handle = { breadcrumb: "Course titles" };

export const meta: Route.MetaFunction = () => [
  { title: "Course titles — Routine — Admin — OurDIU" },
  { name: "robots", content: "noindex" },
];

const PAGE_SIZE = 25;

export async function loader({ request }: Route.LoaderArgs) {
  const view = catalogViewOf(request);
  const list = await adminGetJson<AdminRoutineCourseList>(
    request,
    `/routine/courses?${catalogApiQuery(view, PAGE_SIZE)}`,
  );
  return { view, list };
}

export const action = ({ request }: Route.ActionArgs) =>
  routineCatalogAction(request);

export { AdminRouteError as ErrorBoundary };

function Courses({
  view,
  list,
}: {
  view: CatalogView;
  list: AdminRoutineCourseList;
}) {
  // Owned by the list: rows go when their titles are removed, with the selection.
  const { run } = useFormAction();
  const [selected, setSelected] = useState<string[]>([]);
  const [removing, setRemoving] = useState(false);
  const { department } = view;
  const { items } = list;
  // Selected rows on this page; ones gone after a removal drop out on their own.
  const picked = selected.filter((code) => items.some((c) => c.code === code));
  const allPicked = items.length > 0 && picked.length === items.length;
  const toggle = (code: string, on: boolean) =>
    setSelected((codes) =>
      on ? [...codes, code] : codes.filter((other) => other !== code),
    );
  const filtered = view.q !== "" || view.missing;

  return (
    <div className="grid min-w-0 grid-cols-1 gap-4">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
        <Form role="search" className="relative sm:w-72">
          {department !== "CSE" && (
            <input type="hidden" name="department" value={department} />
          )}
          {view.missing && <input type="hidden" name="missing" value="true" />}
          <Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            key={view.q}
            type="search"
            name="q"
            defaultValue={view.q}
            placeholder="Search codes and titles…"
            aria-label="Search courses"
            className="h-8 pl-8"
          />
        </Form>
        <Link
          to={catalogSearch({ ...view, missing: !view.missing, page: 1 })}
          aria-pressed={view.missing}
          preventScrollReset
          className={cn(
            buttonVariants({ variant: "outline", size: "sm" }),
            view.missing &&
              "border-transparent bg-primary-container text-primary-container-foreground",
          )}
        >
          Without a title
        </Link>
      </div>

      {picked.length > 0 && (
        <SelectionBar count={picked.length} onClear={() => setSelected([])}>
          <Button
            size="sm"
            variant="destructive"
            onClick={() => setRemoving(true)}
          >
            <Trash2 />
            Remove titles
          </Button>
        </SelectionBar>
      )}
      <ConfirmAction
        open={removing}
        onOpenChange={setRemoving}
        title={`Remove ${picked.length === 1 ? "1 title" : `${picked.length} titles`}?`}
        description={`Students see only the codes again: ${picked.join(", ")}.`}
        confirmLabel="Remove"
        destructive
        successMessage={
          picked.length === 1
            ? "Title removed"
            : `${picked.length} titles removed`
        }
        fields={{
          intent: "remove-titles",
          department,
          list: picked.join("\n"),
        }}
        run={(fields, message, to) => {
          run(fields, message, to);
          setSelected([]);
        }}
      />

      {items.length === 0 ? (
        <EmptyState
          icon={BookOpenText}
          title={
            filtered ? "No matching courses" : `No ${department} courses yet`
          }
          description={
            filtered
              ? undefined
              : `Courses appear here once a ${department} routine PDF is uploaded.`
          }
        />
      ) : (
        <div className="overflow-hidden rounded-2xl bg-surface-low">
          <Table>
            <TableHeader className="bg-surface-high">
              <TableRow>
                <TableHead className="w-10">
                  <Checkbox
                    checked={
                      allPicked
                        ? true
                        : picked.length > 0
                          ? "indeterminate"
                          : false
                    }
                    onCheckedChange={(on) =>
                      setSelected(on === true ? items.map((c) => c.code) : [])
                    }
                    aria-label="Select every course on this page"
                  />
                </TableHead>
                <TableHead className="w-28">Code</TableHead>
                <TableHead>Title</TableHead>
                <TableHead
                  className="hidden text-right @xl/main:table-cell"
                  title={
                    list.version
                      ? `Sections taking it in v${list.version}`
                      : undefined
                  }
                >
                  Sections
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.map((c) => (
                <TableRow
                  key={c.code}
                  data-state={picked.includes(c.code) ? "selected" : undefined}
                >
                  <TableCell>
                    <Checkbox
                      checked={picked.includes(c.code)}
                      onCheckedChange={(on) => toggle(c.code, on === true)}
                      aria-label={`Select ${c.code}`}
                    />
                  </TableCell>
                  <TableCell className="font-semibold tabular-nums">
                    {c.code}
                  </TableCell>
                  <TableCell className="min-w-56">
                    <InlineEdit
                      label={`Title of ${c.code}`}
                      defaultValue={c.title ?? ""}
                      placeholder="Add a title"
                      name="title"
                      maxLength={200}
                      fields={{ intent: "title", department, code: c.code }}
                      emptyFields={{
                        intent: "remove-title",
                        department,
                        code: c.code,
                      }}
                    />
                  </TableCell>
                  <TableCell className="hidden text-right text-muted-foreground tabular-nums @xl/main:table-cell">
                    {c.sections || "—"}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
      <TablePagination
        page={list.page}
        pageSize={list.pageSize}
        total={list.total}
        noun="course"
        hrefFor={(page) => catalogSearch({ ...view, page }) || "?"}
      />
      <p className="px-1 text-sm text-muted-foreground">
        {list.titled} of {list.all} {department} courses have a title
      </p>
    </div>
  );
}

export default function AdminRoutineCourses({
  loaderData,
}: Route.ComponentProps) {
  const { view, list } = loaderData;
  return (
    <>
      <AdminPageHeader
        title="Course titles"
        description="DIU’s routine PDFs give course codes only. Type a course’s title and press Enter to save it and go on to the next; clear it to take it away. Students see titles right away, in every version of the department’s routine."
      />
      <UrlTabs
        label="Departments"
        tabs={departmentTabs}
        value={view.department}
      >
        <Courses key={view.department} view={view} list={list} />
      </UrlTabs>
    </>
  );
}
