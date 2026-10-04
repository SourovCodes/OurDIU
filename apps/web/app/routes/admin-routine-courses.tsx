import type {
  AdminRoutineCourse,
  AdminRoutineCourseList,
  RoutineDepartment,
} from "@ourdiu/shared";
import {
  BookOpenText,
  EllipsisVertical,
  Pencil,
  Search,
  Trash2,
} from "lucide-react";
import { useState } from "react";
import {
  ActionDialog,
  ConfirmAction,
  useFormAction,
} from "~/components/actions";
import { AdminPageHeader } from "~/components/admin/admin-header";
import {
  departmentTabs,
  routineDepartmentOf,
} from "~/components/admin/routine";
import { AdminRouteError } from "~/components/admin/route-error";
import { EmptyState } from "~/components/empty-state";
import { FormField } from "~/components/form";
import { Button } from "~/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "~/components/ui/dropdown-menu";
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

export async function loader({ request }: Route.LoaderArgs) {
  const department = routineDepartmentOf(request);
  const { items } = await adminGetJson<AdminRoutineCourseList>(
    request,
    `/routine/courses?department=${department}`,
  );
  return { department, items };
}

export const action = ({ request }: Route.ActionArgs) =>
  routineCatalogAction(request);

export { AdminRouteError as ErrorBoundary };

function TitleDialog({
  course,
  open,
  onOpenChange,
  trigger,
}: {
  course: AdminRoutineCourse;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  trigger?: React.ReactElement;
}) {
  return (
    <ActionDialog
      open={open}
      onOpenChange={onOpenChange}
      trigger={trigger}
      title={
        course.title ? `Edit ${course.code}’s title` : `Title ${course.code}`
      }
      description="Students see it beside the code right away, in every version of the routine."
      submitLabel="Save"
      pendingLabel="Saving…"
      successMessage={`${course.code} is titled`}
      fields={{
        intent: "title",
        department: course.department,
        code: course.code,
      }}
    >
      {(fieldErrors) => (
        <FormField
          label="Course title"
          name="title"
          defaultValue={course.title ?? ""}
          placeholder="e.g. Computer Networks"
          required
          minLength={2}
          maxLength={200}
          autoFocus
          error={fieldErrors.title}
        />
      )}
    </ActionDialog>
  );
}

function RowActions({
  course,
  run,
}: {
  course: AdminRoutineCourse;
  run: ReturnType<typeof useFormAction>["run"];
}) {
  const [dialog, setDialog] = useState<"edit" | "remove" | null>(null);
  const onOpenChange = (open: boolean) => !open && setDialog(null);
  return (
    <>
      <DropdownMenu modal={false}>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            className="size-8 text-muted-foreground data-[state=open]:state-layer"
            aria-label={`Actions for ${course.code}`}
          >
            <EllipsisVertical />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-48">
          <DropdownMenuItem onSelect={() => setDialog("edit")}>
            <Pencil />
            {course.title ? "Edit title" : "Add title"}
          </DropdownMenuItem>
          {course.title && (
            <DropdownMenuItem
              variant="destructive"
              onSelect={() => setDialog("remove")}
            >
              <Trash2 />
              Remove title
            </DropdownMenuItem>
          )}
        </DropdownMenuContent>
      </DropdownMenu>
      <TitleDialog
        course={course}
        open={dialog === "edit"}
        onOpenChange={onOpenChange}
      />
      <ConfirmAction
        open={dialog === "remove"}
        onOpenChange={onOpenChange}
        title={`Remove ${course.code}’s title?`}
        description="Students see only the code again."
        confirmLabel="Remove"
        destructive
        successMessage={`${course.code}’s title removed`}
        fields={{
          intent: "remove-title",
          department: course.department,
          code: course.code,
        }}
        run={run}
      />
    </>
  );
}

function Courses({
  department,
  items,
}: {
  department: RoutineDepartment;
  items: AdminRoutineCourse[];
}) {
  // Owned by the list: a course with only a title goes when it's removed.
  const { run } = useFormAction();
  const [query, setQuery] = useState("");
  const [missingOnly, setMissingOnly] = useState(false);
  const needle = query.trim().toLowerCase();
  const rows = items.filter(
    (c) =>
      (!needle ||
        c.code.toLowerCase().includes(needle) ||
        c.title?.toLowerCase().includes(needle)) &&
      (!missingOnly || !c.title),
  );
  const titled = items.filter((c) => c.title).length;

  return (
    <div className="grid min-w-0 grid-cols-1 gap-4">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
        <div className="relative sm:w-72">
          <Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search codes and titles…"
            aria-label="Search courses"
            className="h-8 pl-8"
          />
        </div>
        <Button
          variant="outline"
          size="sm"
          aria-pressed={missingOnly}
          onClick={() => setMissingOnly((on) => !on)}
          className={cn(
            missingOnly &&
              "border-transparent bg-primary-container text-primary-container-foreground",
          )}
        >
          Without a title
        </Button>
      </div>

      {rows.length === 0 ? (
        <EmptyState
          icon={BookOpenText}
          title={
            items.length === 0
              ? `No ${department} courses yet`
              : "No matching courses"
          }
          description={
            items.length === 0
              ? `Courses appear here once a ${department} routine PDF is uploaded.`
              : undefined
          }
        />
      ) : (
        <div className="overflow-hidden rounded-2xl bg-surface-low">
          <Table>
            <TableHeader className="bg-surface-high">
              <TableRow>
                <TableHead className="w-28">Code</TableHead>
                <TableHead>Title</TableHead>
                <TableHead className="hidden text-right @xl/main:table-cell">
                  Live sections
                </TableHead>
                <TableHead className="w-10">
                  <span className="sr-only">Actions</span>
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((c) => (
                <TableRow key={c.code}>
                  <TableCell className="font-semibold tabular-nums">
                    {c.code}
                  </TableCell>
                  <TableCell className="max-w-96 truncate">
                    {c.title ?? (
                      <TitleDialog
                        course={c}
                        trigger={
                          <Button
                            variant="ghost"
                            size="sm"
                            className="-ml-2 h-7 text-muted-foreground"
                          >
                            <Pencil />
                            Add title
                          </Button>
                        }
                      />
                    )}
                  </TableCell>
                  <TableCell className="hidden text-right text-muted-foreground tabular-nums @xl/main:table-cell">
                    {c.liveSections || "—"}
                  </TableCell>
                  <TableCell>
                    <RowActions course={c} run={run} />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
      <p className="px-1 text-sm text-muted-foreground">
        {titled} of {items.length} courses have a title
      </p>
    </div>
  );
}

export default function AdminRoutineCourses({
  loaderData,
}: Route.ComponentProps) {
  const { department, items } = loaderData;
  return (
    <>
      <AdminPageHeader
        title="Course titles"
        description="DIU’s routine PDFs give course codes only. A title added here shows beside its code for students right away, in every version of the department’s routine."
      />
      <UrlTabs label="Departments" tabs={departmentTabs} value={department}>
        <Courses key={department} department={department} items={items} />
      </UrlTabs>
    </>
  );
}
