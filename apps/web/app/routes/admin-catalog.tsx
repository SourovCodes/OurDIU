import type {
  AdminCatalog,
  ApiError,
  CatalogMergeResult,
  Department,
} from "@ourdiu/shared";
import { MAX_MERGE_ENTRIES } from "@ourdiu/shared/constants";
import {
  Copy,
  EllipsisVertical,
  FolderTree,
  Merge,
  Pencil,
  Plus,
  Search,
  Trash2,
  X,
} from "lucide-react";
import { useEffect, useState } from "react";
import { data, useFetcher, type ShouldRevalidateFunction } from "react-router";
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
import { Checkbox } from "~/components/ui/checkbox";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "~/components/ui/dialog";
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
import { apiFetch, readJson } from "~/lib/api.server";
import { sameCourseKey } from "~/lib/courses";
import { plural } from "~/lib/submissions";
import { cn } from "~/lib/utils";
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

/** What the merge dialog's preview gets back: what a merge would move. */
type PreviewResult =
  | { ok: true; intent: "merge-preview"; preview: CatalogMergeResult }
  | { ok: false; intent: "merge-preview"; error: string };

/** The merge request from the form: the kept id and the comma-separated others. */
function mergeBody(form: FormData) {
  return {
    keepId: Number(form.get("keepId")),
    mergeIds: String(form.get("mergeIds") ?? "")
      .split(",")
      .filter(Boolean)
      .map(Number),
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

  if (intent === "merge-preview") {
    const res = await apiFetch(request, `/api/v1/admin/${kind}/merge`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ ...mergeBody(form), dryRun: true }),
    });
    if (res.ok) {
      return data<PreviewResult>({
        ok: true,
        intent,
        preview: await readJson<CatalogMergeResult>(res),
      });
    }
    const error = await readJson<ApiError>(res).catch(() => null);
    return data<PreviewResult>(
      {
        ok: false,
        intent,
        error: error?.error.message ?? "Couldn’t check this merge.",
      },
      { status: res.status >= 500 ? 502 : res.status },
    );
  }

  const send = () => {
    switch (intent) {
      case "create":
        return adminRequest(request, intent, "POST", `/${kind}`, body);
      case "update":
        return adminRequest(request, intent, "PATCH", `/${kind}/${id}`, body);
      case "delete":
        return adminRequest(request, intent, "DELETE", `/${kind}/${id}`);
      case "merge":
        return adminRequest(
          request,
          intent,
          "POST",
          `/${kind}/merge`,
          mergeBody(form),
        );
      default:
        throw new Response("Unknown intent", { status: 400 });
    }
  };
  const result = await send();
  // Public pages cache the catalog for a minute; this isolate shows the change now.
  invalidateTaxonomy();
  return result;
}

// A merge preview changes nothing, so the catalog isn't loaded again for it.
export const shouldRevalidate: ShouldRevalidateFunction = ({
  formData,
  defaultShouldRevalidate,
}) =>
  formData?.get("intent") === "merge-preview" ? false : defaultShouldRevalidate;

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

/** Lines describing what a merge moves, from its preview. */
function mergeSummary(kind: Kind, preview: CatalogMergeResult) {
  const lines: string[] = [];
  if (preview.questionsMoved > 0) {
    lines.push(
      `${plural(preview.questionsMoved, "exam")} with ${plural(preview.papersMoved, "paper")} move to “${preview.keep.name}”.`,
    );
  } else {
    lines.push("No exams are filed under the others.");
  }
  if (preview.questionsCombined > 0) {
    lines.push(
      `${plural(preview.questionsCombined, "exam")} ${preview.questionsCombined === 1 ? "is" : "are"} already there, so their papers, saves and views join the existing ${preview.questionsCombined === 1 ? "one" : "ones"}.`,
    );
  }
  if (preview.proposalsMoved > 0) {
    lines.push(
      `${plural(preview.proposalsMoved, "paper")} awaiting review ${preview.proposalsMoved === 1 ? "proposes" : "propose"} ${preview.removed === 1 ? "it" : "them"}; ${preview.proposalsMoved === 1 ? "it" : "they"} will propose “${preview.keep.name}” instead.`,
    );
  }
  if (kind === "departments" && preview.coursesMoved) {
    lines.push(
      `${plural(preview.coursesMoved, "course")} ${preview.coursesMoved === 1 ? "moves" : "move"} to “${preview.keep.name}”.`,
    );
  }
  return lines;
}

/**
 * Merging the selected entries: pick the one to keep, see what moves (a dry run of
 * the merge), confirm. Posts through the section's runner: the merged rows go away.
 */
function MergeDialog({
  kind,
  rows,
  open,
  onOpenChange,
  run,
  onMerged,
}: {
  kind: Kind;
  rows: Row[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
  run: ReturnType<typeof useFormAction>["run"];
  onMerged: () => void;
}) {
  const { label, noun } = KINDS[kind];
  // The most used entry is the likely keeper.
  const [keepId, setKeepId] = useState(
    () =>
      [...rows].sort(
        (a, b) => b.questionCount - a.questionCount || a.id - b.id,
      )[0]?.id,
  );
  const keep = rows.find((r) => r.id === keepId) ?? rows[0];
  const others = rows.filter((r) => r !== keep);
  const preview = useFetcher<PreviewResult>();
  const { submit } = preview;
  const fields = {
    kind,
    keepId: String(keep?.id ?? ""),
    mergeIds: others.map((r) => r.id).join(","),
  };

  useEffect(() => {
    if (!open || !fields.keepId || !fields.mergeIds) return;
    submit({ intent: "merge-preview", ...fields }, { method: "post" });
    // Asks again whenever the selection or the kept entry changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, fields.keepId, fields.mergeIds, submit]);

  const result =
    preview.state === "idle" &&
    preview.data?.ok &&
    preview.data.preview.keep.id === keep?.id
      ? preview.data.preview
      : undefined;
  const failed =
    preview.state === "idle" && preview.data?.ok === false
      ? preview.data.error
      : undefined;

  if (!keep) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Merge {label.toLowerCase()}</DialogTitle>
          <DialogDescription>
            Everything filed under the others moves to the one you keep, and the
            others are deleted. Their old pages redirect to it. This can’t be
            undone.
          </DialogDescription>
        </DialogHeader>
        <form
          className="grid gap-4"
          onSubmit={(event) => {
            event.preventDefault();
            run({ intent: "merge", ...fields }, `Merged into “${keep.name}”`);
            onMerged();
          }}
        >
          {/* Fieldsets are at least as wide as their content unless told otherwise. */}
          <fieldset className="grid min-w-0 gap-2">
            <legend className="mb-2 text-sm font-medium">
              Keep which {noun}?
            </legend>
            <div className="grid max-h-64 grid-cols-1 gap-2 overflow-y-auto">
              {rows.map((row) => (
                <label
                  key={row.id}
                  className="flex cursor-pointer items-center gap-3 rounded-xl bg-surface-low px-3 py-2.5 hover:state-layer has-checked:bg-primary-container has-checked:text-primary-container-foreground"
                >
                  <input
                    type="radio"
                    name="keep"
                    value={row.id}
                    checked={row.id === keep.id}
                    onChange={() => setKeepId(row.id)}
                    className="size-4 accent-primary"
                  />
                  <span className="min-w-0 flex-1">
                    <span
                      className="block truncate font-medium"
                      title={row.name}
                    >
                      {row.name}
                      {row.shortName && (
                        <span className="font-normal opacity-70">
                          {" "}
                          ({row.shortName})
                        </span>
                      )}
                    </span>
                    <span className="text-sm opacity-70">
                      {plural(row.questionCount, "exam")}
                      {row.courseCount !== undefined &&
                        ` · ${plural(row.courseCount, "course")}`}
                    </span>
                  </span>
                </label>
              ))}
            </div>
          </fieldset>

          <div
            className="grid gap-1.5 rounded-xl bg-surface-high px-4 py-3 text-sm"
            aria-live="polite"
          >
            {failed ? (
              <p className="text-destructive">{failed}</p>
            ) : !result ? (
              <p className="text-muted-foreground">Checking what moves…</p>
            ) : (
              <>
                {mergeSummary(kind, result).map((line) => (
                  <p key={line}>{line}</p>
                ))}
                {result.coursesCombined &&
                  result.coursesCombined.length > 0 && (
                    <div className="grid gap-1 pt-1">
                      <p>Courses with the same name become one:</p>
                      <ul className="grid gap-0.5 pl-4 text-muted-foreground">
                        {result.coursesCombined.map((c) => (
                          <li key={c.keep} className="list-disc">
                            {c.removed.map((name) => `“${name}”`).join(", ")} →
                            “{c.keep}”
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
              </>
            )}
          </div>

          <DialogFooter>
            <DialogClose asChild>
              <Button type="button" variant="outline">
                Cancel
              </Button>
            </DialogClose>
            <Button type="submit" variant="destructive" disabled={!result}>
              <Merge />
              <span className="max-w-60 truncate">
                Merge into “{keep.name}”
              </span>
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
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
  // Owned by the section: a deleted or merged entry's row disappears.
  const { run } = useFormAction();
  const [query, setQuery] = useState("");
  const [department, setDepartment] = useState(ALL);
  const [duplicatesOnly, setDuplicatesOnly] = useState(false);
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const [merging, setMerging] = useState(false);
  const { label, noun } = KINDS[kind];
  const departmentsById = new Map(catalog.departments.map((d) => [d.id, d]));
  const allRows: Record<Kind, Row[]> = {
    departments: catalog.departments,
    courses: catalog.courses,
    semesters: catalog.semesters,
    "exam-types": catalog.examTypes,
  };

  // Courses of one department whose names match up to a plural or case: likely
  // the same course filed twice, worth merging.
  const duplicateKey = (row: Row) =>
    `${row.departmentId}|${sameCourseKey(row.name)}`;
  const keyCounts = new Map<string, number>();
  if (kind === "courses") {
    for (const row of allRows.courses) {
      const key = duplicateKey(row);
      keyCounts.set(key, (keyCounts.get(key) ?? 0) + 1);
    }
  }
  const isDuplicate = (row: Row) => (keyCounts.get(duplicateKey(row)) ?? 0) > 1;

  const needle = query.trim().toLowerCase();
  const filtered = allRows[kind].filter(
    (row) =>
      (!needle ||
        row.name.toLowerCase().includes(needle) ||
        row.shortName?.toLowerCase().includes(needle)) &&
      (kind !== "courses" ||
        department === ALL ||
        String(row.departmentId) === department) &&
      (!duplicatesOnly || isDuplicate(row)),
  );
  // Side by side, so each group can be selected and merged.
  const rows = duplicatesOnly
    ? [...filtered].sort(
        (a, b) => duplicateKey(a).localeCompare(duplicateKey(b)) || a.id - b.id,
      )
    : filtered;

  // Merged and deleted entries drop out of the selection on their own.
  const selected = allRows[kind].filter((row) => selectedIds.includes(row.id));
  const toggle = (id: number, on: boolean) =>
    setSelectedIds((ids) =>
      on ? [...ids, id] : ids.filter((other) => other !== id),
    );
  const mixedDepartments =
    kind === "courses" &&
    new Set(selected.map((row) => row.departmentId)).size > 1;
  const mergeBlocker =
    selected.length < 2
      ? `Select at least two ${label.toLowerCase()} to merge`
      : selected.length > MAX_MERGE_ENTRIES
        ? `Merge at most ${MAX_MERGE_ENTRIES} at a time`
        : mixedDepartments
          ? "Courses must be in the same department; merge the departments instead"
          : undefined;

  // One minmax(0, 1fr) column: long names truncate instead of widening the page.
  return (
    <div className="grid min-w-0 grid-cols-1 gap-4">
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
        {kind === "courses" && (
          <Button
            variant="outline"
            size="sm"
            aria-pressed={duplicatesOnly}
            onClick={() => setDuplicatesOnly((on) => !on)}
            className={cn(
              duplicatesOnly &&
                "border-transparent bg-primary-container text-primary-container-foreground",
            )}
            title="Courses of one department whose names only differ by a plural or case"
          >
            <Copy />
            Likely duplicates
          </Button>
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

      {selected.length > 0 && (
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1 rounded-2xl bg-primary-container px-4 py-2 text-primary-container-foreground">
          <span className="text-sm font-medium">
            {selected.length} selected
          </span>
          {/* Its own line on phones, below the count and the buttons. */}
          <span className="order-last basis-full truncate text-sm opacity-80 sm:order-none sm:min-w-0 sm:flex-1 sm:basis-0">
            {mergeBlocker ?? selected.map((row) => row.name).join(", ")}
          </span>
          <Button
            size="sm"
            className="ml-auto sm:ml-0"
            disabled={mergeBlocker !== undefined}
            onClick={() => setMerging(true)}
          >
            <Merge />
            Merge {selected.length}
          </Button>
          <Button
            size="sm"
            variant="ghost"
            onClick={() => setSelectedIds([])}
            aria-label="Clear selection"
          >
            <X />
            Clear
          </Button>
        </div>
      )}
      {merging && (
        <MergeDialog
          key={selected.map((row) => row.id).join(",")}
          kind={kind}
          rows={selected}
          open
          onOpenChange={setMerging}
          run={run}
          onMerged={() => {
            setMerging(false);
            setSelectedIds([]);
          }}
        />
      )}

      {rows.length === 0 ? (
        <EmptyState
          icon={FolderTree}
          title={
            needle || department !== ALL || duplicatesOnly
              ? `No matching ${label.toLowerCase()}`
              : `No ${label.toLowerCase()} yet`
          }
        />
      ) : (
        <div className="overflow-hidden rounded-2xl bg-surface-low">
          <Table>
            <TableHeader className="bg-surface-high">
              <TableRow>
                <TableHead className="w-10">
                  <span className="sr-only">Select</span>
                </TableHead>
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
                <TableRow
                  key={row.id}
                  data-state={
                    selectedIds.includes(row.id) ? "selected" : undefined
                  }
                >
                  <TableCell>
                    <Checkbox
                      checked={selectedIds.includes(row.id)}
                      onCheckedChange={(on) => toggle(row.id, on === true)}
                      aria-label={`Select ${row.name}`}
                    />
                  </TableCell>
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
        description="The departments, courses, semesters and exam types papers are filed under. Entries in use can be renamed but not deleted; select duplicates to merge them into one."
      />
      <UrlTabs label="Catalog sections" tabs={tabs} value={kind}>
        <CatalogSection key={kind} catalog={catalog} kind={kind} />
      </UrlTabs>
    </>
  );
}
