import type { AdminCatalog, Department } from "@ourdiu/shared";
import {
  EllipsisVertical,
  FolderTree,
  Pencil,
  Plus,
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
import { AdminRouteError } from "~/components/admin/route-error";
import { UrlTabs } from "~/components/url-tabs";
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
import { Label } from "~/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "~/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "~/components/ui/table";
import { adminGetJson, adminRequest, formObject } from "~/lib/admin.server";
import { plural } from "~/lib/submissions";
import { invalidateTaxonomy } from "~/lib/taxonomy.server";
import type { Route } from "./+types/admin-catalog";

export const handle = { breadcrumb: "Catalog" };

export const meta: Route.MetaFunction = () => [
  { title: "Catalog — Admin — OurDIU" },
  { name: "robots", content: "noindex" },
];

const KINDS = {
  departments: { label: "Departments", noun: "department" },
  courses: { label: "Courses", noun: "course" },
  semesters: { label: "Semesters", noun: "semester" },
  "exam-types": { label: "Exam types", noun: "exam type" },
} as const;
type Kind = keyof typeof KINDS;

const isKind = (value: unknown): value is Kind =>
  typeof value === "string" && value in KINDS;

export async function loader({ request }: Route.LoaderArgs) {
  const tab = new URL(request.url).searchParams.get("tab");
  return {
    catalog: await adminGetJson<AdminCatalog>(request, "/catalog"),
    kind: isKind(tab) ? tab : "departments",
  };
}

export async function action({ request }: Route.ActionArgs) {
  const form = await request.formData();
  const intent = String(form.get("intent"));
  const kind = form.get("kind");
  if (!isKind(kind)) {
    throw new Response("Unknown catalog kind", { status: 400 });
  }
  const id = encodeURIComponent(String(form.get("id") ?? ""));
  const body = formObject(form, "intent", "kind", "id");

  const send = () => {
    switch (intent) {
      case "create":
        return adminRequest(request, intent, "POST", `/${kind}`, body);
      case "update":
        return adminRequest(request, intent, "PATCH", `/${kind}/${id}`, body);
      case "delete":
        return adminRequest(request, intent, "DELETE", `/${kind}/${id}`);
      default:
        throw new Response("Unknown intent", { status: 400 });
    }
  };
  const result = await send();
  // Public pages cache the catalog for a minute; this isolate shows the change now.
  invalidateTaxonomy();
  return result;
}

export { AdminRouteError as ErrorBoundary };

type Row = {
  id: number;
  name: string;
  questionCount: number;
  submissionCount: number;
  courseCount?: number;
  shortName?: string;
  departmentId?: number;
};

const ALL = "all";

/** Department select for the "add course" form, submitted as `departmentId`. */
function DepartmentField({
  departments,
  defaultValue,
  error,
}: {
  departments: Department[];
  defaultValue?: string;
  error?: string;
}) {
  return (
    <div className="grid gap-1.5">
      <Label htmlFor="course-department">Department</Label>
      <Select name="departmentId" defaultValue={defaultValue} required>
        <SelectTrigger
          id="course-department"
          className="w-full"
          aria-invalid={error ? true : undefined}
        >
          <SelectValue placeholder="Select a department" />
        </SelectTrigger>
        <SelectContent>
          {departments.map((d) => (
            <SelectItem key={d.id} value={String(d.id)}>
              {d.name} ({d.shortName})
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      {error && <p className="text-sm text-destructive">{error}</p>}
    </div>
  );
}

/** Name (and for departments, short name) inputs for the create and rename forms. */
function EntryFields({
  kind,
  row,
  fieldErrors,
}: {
  kind: Kind;
  row?: Row;
  fieldErrors: Record<string, string>;
}) {
  return (
    <>
      <FormField
        label="Name"
        name="name"
        defaultValue={row?.name}
        placeholder={kind === "semesters" ? "e.g. Fall 25" : undefined}
        required
        minLength={2}
        maxLength={100}
        autoFocus
        error={fieldErrors.name}
      />
      {kind === "departments" && (
        <FormField
          label="Short name"
          name="shortName"
          defaultValue={row?.shortName}
          placeholder="e.g. CSE"
          required
          minLength={2}
          maxLength={20}
          error={fieldErrors.shortName}
        />
      )}
    </>
  );
}

function RowActions({
  kind,
  row,
  run,
}: {
  kind: Kind;
  row: Row;
  run: ReturnType<typeof useFormAction>["run"];
}) {
  const { noun } = KINDS[kind];
  const [dialog, setDialog] = useState<"rename" | "delete" | null>(null);
  const inUse =
    row.questionCount + row.submissionCount + (row.courseCount ?? 0) > 0;
  const onOpenChange = (open: boolean) => !open && setDialog(null);

  return (
    <>
      <DropdownMenu modal={false}>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            className="size-8 text-muted-foreground data-[state=open]:state-layer"
            aria-label={`Actions for ${row.name}`}
          >
            <EllipsisVertical />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-48">
          <DropdownMenuItem onSelect={() => setDialog("rename")}>
            <Pencil />
            Rename
          </DropdownMenuItem>
          <DropdownMenuItem
            variant="destructive"
            disabled={inUse}
            onSelect={() => setDialog("delete")}
          >
            <Trash2 />
            {inUse ? "In use, can’t delete" : "Delete"}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      <ActionDialog
        open={dialog === "rename"}
        onOpenChange={onOpenChange}
        title={`Rename ${noun}`}
        description={
          row.questionCount > 0
            ? `Papers filed under it (${plural(row.questionCount, "question")}) show the new name right away.`
            : undefined
        }
        submitLabel="Save"
        pendingLabel="Saving…"
        successMessage={`Renamed “${row.name}”`}
        fields={{ intent: "update", kind, id: String(row.id) }}
      >
        {(fieldErrors) => (
          <EntryFields kind={kind} row={row} fieldErrors={fieldErrors} />
        )}
      </ActionDialog>
      <ConfirmAction
        open={dialog === "delete"}
        onOpenChange={onOpenChange}
        title={`Delete ${noun}?`}
        description={`“${row.name}” is removed from the catalog. This can’t be undone.`}
        confirmLabel="Delete"
        destructive
        successMessage={`Deleted “${row.name}”`}
        fields={{ intent: "delete", kind, id: String(row.id) }}
        run={run}
      />
    </>
  );
}

function Count({ value }: { value: number }) {
  return (
    <span className={value === 0 ? "text-muted-foreground" : undefined}>
      {value}
    </span>
  );
}

/** Toolbar and table for one kind of entry. Keyed by kind, so filters reset. */
function CatalogSection({
  catalog,
  kind,
}: {
  catalog: AdminCatalog;
  kind: Kind;
}) {
  // Owned by the section: a deleted entry's row disappears.
  const { run } = useFormAction();
  const [query, setQuery] = useState("");
  const [department, setDepartment] = useState(ALL);
  const { label, noun } = KINDS[kind];
  const departmentsById = new Map(catalog.departments.map((d) => [d.id, d]));
  const allRows: Record<Kind, Row[]> = {
    departments: catalog.departments,
    courses: catalog.courses,
    semesters: catalog.semesters,
    "exam-types": catalog.examTypes,
  };

  const needle = query.trim().toLowerCase();
  const rows = allRows[kind].filter(
    (row) =>
      (!needle ||
        row.name.toLowerCase().includes(needle) ||
        row.shortName?.toLowerCase().includes(needle)) &&
      (kind !== "courses" ||
        department === ALL ||
        String(row.departmentId) === department),
  );

  return (
    <div className="grid gap-4">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
        <div className="relative sm:w-72">
          <Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder={`Search ${label.toLowerCase()}…`}
            aria-label={`Search ${label.toLowerCase()}`}
            className="h-8 pl-8"
          />
        </div>
        {kind === "courses" && (
          <Select value={department} onValueChange={setDepartment}>
            <SelectTrigger
              size="sm"
              className="sm:w-56"
              aria-label="Department"
            >
              <SelectValue>
                {department === ALL
                  ? "All departments"
                  : (catalog.departments.find(
                      (d) => String(d.id) === department,
                    )?.name ?? "All departments")}
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>All departments</SelectItem>
              {catalog.departments.map((d) => (
                <SelectItem key={d.id} value={String(d.id)}>
                  {d.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
        <ActionDialog
          trigger={
            <Button size="sm" className="sm:ml-auto">
              <Plus />
              Add {noun}
            </Button>
          }
          title={`Add ${noun}`}
          submitLabel="Add"
          pendingLabel="Adding…"
          successMessage={`${noun[0]!.toUpperCase()}${noun.slice(1)} added`}
          fields={{ intent: "create", kind }}
        >
          {(fieldErrors) => (
            <>
              {kind === "courses" && (
                <DepartmentField
                  departments={catalog.departments}
                  defaultValue={department === ALL ? undefined : department}
                  error={fieldErrors.departmentId}
                />
              )}
              <EntryFields kind={kind} fieldErrors={fieldErrors} />
            </>
          )}
        </ActionDialog>
      </div>

      {rows.length === 0 ? (
        <EmptyState
          icon={FolderTree}
          title={
            needle || department !== ALL
              ? `No matching ${label.toLowerCase()}`
              : `No ${label.toLowerCase()} yet`
          }
        />
      ) : (
        <div className="overflow-hidden rounded-2xl bg-surface-low">
          <Table>
            <TableHeader className="bg-surface-high">
              <TableRow>
                <TableHead>Name</TableHead>
                {kind === "departments" && <TableHead>Short name</TableHead>}
                {kind === "courses" && <TableHead>Department</TableHead>}
                {kind === "departments" && (
                  <TableHead className="text-right">Courses</TableHead>
                )}
                <TableHead className="text-right">Questions</TableHead>
                <TableHead
                  className="hidden text-right @xl/main:table-cell"
                  title="Pending submissions that propose this entry"
                >
                  Proposals
                </TableHead>
                <TableHead className="w-10">
                  <span className="sr-only">Actions</span>
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((row) => (
                <TableRow key={row.id}>
                  <TableCell className="max-w-72 truncate font-medium">
                    {row.name}
                  </TableCell>
                  {kind === "departments" && (
                    <TableCell className="text-muted-foreground">
                      {row.shortName}
                    </TableCell>
                  )}
                  {kind === "courses" && (
                    <TableCell className="text-muted-foreground">
                      {departmentsById.get(row.departmentId!)?.shortName ?? "—"}
                    </TableCell>
                  )}
                  {kind === "departments" && (
                    <TableCell className="text-right tabular-nums">
                      <Count value={row.courseCount ?? 0} />
                    </TableCell>
                  )}
                  <TableCell className="text-right tabular-nums">
                    <Count value={row.questionCount} />
                  </TableCell>
                  <TableCell className="hidden text-right tabular-nums @xl/main:table-cell">
                    <Count value={row.submissionCount} />
                  </TableCell>
                  <TableCell>
                    <RowActions kind={kind} row={row} run={run} />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
      <p className="px-1 text-sm text-muted-foreground">
        {rows.length} of {plural(allRows[kind].length, noun)}
      </p>
    </div>
  );
}

export default function AdminCatalogPage({ loaderData }: Route.ComponentProps) {
  const { catalog, kind } = loaderData;
  const counts: Record<Kind, number> = {
    departments: catalog.departments.length,
    courses: catalog.courses.length,
    semesters: catalog.semesters.length,
    "exam-types": catalog.examTypes.length,
  };
  const tabs = (Object.keys(KINDS) as Kind[]).map((k) => ({
    value: k,
    label: KINDS[k].label,
    search: k === "departments" ? "" : `?tab=${k}`,
    count: counts[k],
  }));

  return (
    <>
      <AdminPageHeader
        title="Catalog"
        description="The departments, courses, semesters and exam types papers are filed under. Entries in use can be renamed but not deleted."
      />
      <UrlTabs label="Catalog sections" tabs={tabs} value={kind}>
        <CatalogSection key={kind} catalog={catalog} kind={kind} />
      </UrlTabs>
    </>
  );
}
