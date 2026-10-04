import type {
  AdminRoutineVersion,
  RoutineDepartment,
  RoutineFileProblem,
  RoutineVersionStatus,
} from "@ourdiu/shared";
import {
  MAX_ROUTINE_PDF_BYTES,
  ROUTINE_DEPARTMENTS,
} from "@ourdiu/shared/constants";
import { Check, FileUp, LoaderCircle, Upload, X } from "lucide-react";
import { useState } from "react";
import { Link, useFetcher } from "react-router";
import { ActionDialog } from "~/components/actions";
import { Input } from "~/components/ui/input";
import type { ActionResult } from "~/lib/action-result";
import { FormField, FormMessage } from "~/components/form";
import { Alert, AlertDescription, AlertTitle } from "~/components/ui/alert";
import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "~/components/ui/dialog";
import { cn } from "~/lib/utils";

const STATUS: Record<
  RoutineVersionStatus,
  { label: string; className: string }
> = {
  live: { label: "Live", className: "bg-primary text-primary-foreground" },
  draft: {
    label: "Draft",
    className: "bg-exam-quiz text-exam-quiz-foreground",
  },
  previous: {
    label: "Previous",
    className: "bg-surface-highest text-muted-foreground",
  },
};

export function RoutineStatusBadge({
  status,
}: {
  status: RoutineVersionStatus;
}) {
  return (
    <Badge className={STATUS[status].className}>{STATUS[status].label}</Badge>
  );
}

/** What deleting a version does; the live one takes the department's routine away. */
export function deleteDescription(
  v: Pick<AdminRoutineVersion, "status" | "department">,
) {
  return v.status === "live"
    ? `It’s the live version: students will see no ${v.department} routine (“coming soon”) until you make another version live. Its classes and DIU’s file are deleted for good.`
    : "Its classes and DIU’s file are deleted for good. Students don’t notice: they only see the live version. You can upload the file again later.";
}

/** Gives a version another number, e.g. when DIU's file has a wrong one. */
export function RenumberDialog({
  version,
  open,
  onOpenChange,
  trigger,
}: {
  version: Pick<
    AdminRoutineVersion,
    "id" | "version" | "department" | "status"
  >;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  trigger?: React.ReactElement;
}) {
  return (
    <ActionDialog
      open={open}
      onOpenChange={onOpenChange}
      trigger={trigger}
      title={`Change v${version.version}’s number`}
      description={
        version.status === "live"
          ? "Students see the new number straight away, on the routine and its PDFs."
          : "Each number is used once per department."
      }
      submitLabel="Save"
      pendingLabel="Saving…"
      successMessage="Version number changed"
      fields={{ intent: "renumber", id: String(version.id) }}
    >
      {(fieldErrors) => (
        <FormField
          label="Version"
          name="version"
          defaultValue={version.version}
          placeholder="e.g. 4.1"
          required
          pattern="\d{1,3}(\.\d{1,3}){0,2}"
          title="Numbers and dots, like 4.1"
          inputMode="decimal"
          autoFocus
          error={fieldErrors.version}
        />
      )}
    </ActionDialog>
  );
}

/** The review page of an uploaded routine version. */
export const versionUrl = (id: number) => `/admin/routine/versions/${id}`;

/** DIU's file a version was read from, straight from the API. */
export const versionPdfHref = (v: Pick<AdminRoutineVersion, "id">) =>
  `/api/v1/admin/routine/versions/${v.id}/pdf`;

/** What the upload action answers when the file can't be used. */
export type UploadResult = {
  ok: false;
  intent: "upload";
  error: string;
  problems: RoutineFileProblem[];
};

const MAX_MB = MAX_ROUTINE_PDF_BYTES / 1024 / 1024;

/**
 * Uploads DIU's routine file (a PDF, or SWE's Excel sheet), read on the server. One it can't read is answered with
 * why; one that's read opens as a draft (the action redirects to its review).
 */
export function UploadRoutineDialog() {
  const fetcher = useFetcher<UploadResult>();
  const [tooLarge, setTooLarge] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [dragging, setDragging] = useState(false);
  const busy = fetcher.state !== "idle";
  const result = !busy ? fetcher.data : undefined;

  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button>
          <Upload aria-hidden />
          Upload routine
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>Upload a routine</DialogTitle>
          <DialogDescription>
            DIU’s routine file as the department publishes it: CSE’s or EEE’s
            PDF, or SWE’s Excel sheet. It’s read and checked, then kept as a
            draft for you to review; students see nothing until you make it
            live.
          </DialogDescription>
        </DialogHeader>
        <fetcher.Form
          method="post"
          encType="multipart/form-data"
          className="grid gap-4"
          onSubmit={(event) => {
            const file = new FormData(event.currentTarget).get("file");
            if (file instanceof File && file.size > MAX_ROUTINE_PDF_BYTES) {
              event.preventDefault();
              setTooLarge(true);
            } else setTooLarge(false);
          }}
        >
          <input type="hidden" name="intent" value="upload" />
          {/* The input covers the zone, so a file can be dropped on it too. */}
          <div
            className={cn(
              "relative grid justify-items-center gap-1.5 rounded-2xl border-[1.5px] border-dashed border-input px-4 py-7 text-center text-sm transition-colors focus-within:ring-[3px] focus-within:ring-ring/50 hover:state-layer",
              dragging && "border-primary bg-primary-container/40",
            )}
          >
            <FileUp className="size-7 text-primary" aria-hidden />
            <span className="font-semibold">
              {file ? file.name : "Choose or drop the routine file"}
            </span>
            <span className="text-muted-foreground">
              {file
                ? `${Math.max(1, Math.round(file.size / 1024))} KB · choose another to replace it`
                : `As DIU publishes it, up to ${MAX_MB} MB`}
            </span>
            <input
              id="routine-file"
              name="file"
              type="file"
              accept="application/pdf,.pdf,.xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
              required
              aria-label="Routine file"
              onChange={(event) => setFile(event.target.files?.[0] ?? null)}
              onDragEnter={() => setDragging(true)}
              onDragLeave={() => setDragging(false)}
              onDrop={() => setDragging(false)}
              className="absolute inset-0 cursor-pointer opacity-0"
            />
          </div>
          {tooLarge && (
            <FormMessage message={`The file is larger than ${MAX_MB} MB.`} />
          )}
          <FormField
            label="Version (optional)"
            name="version"
            placeholder="As printed on the file, e.g. 4.1"
            pattern="\d{1,3}(\.\d{1,3}){0,2}"
            title="Numbers and dots, like 4.1"
            inputMode="decimal"
          />
          <p className="-mt-2 text-sm text-muted-foreground">
            Leave it empty to use the number printed on the PDF (for SWE’s
            sheet, the one in its file name). You can change it later too.
          </p>
          {result && !result.ok && (
            <Alert variant="destructive" role="alert">
              <AlertTitle>{result.error}</AlertTitle>
              <AlertDescription>
                {result.problems.length > 0 && (
                  <ul className="mt-1 grid max-h-60 list-disc gap-1 overflow-y-auto pl-4">
                    {result.problems.map((p, i) => (
                      <li key={i}>
                        {p.path && (
                          <code className="text-[0.8125rem] font-semibold">
                            {p.path}
                          </code>
                        )}
                        {p.path && ": "}
                        {p.message}
                      </li>
                    ))}
                  </ul>
                )}
                <p className="mt-2">
                  Nothing was saved. If this is the department’s routine file,
                  its layout may have changed: tell the developers.
                </p>
              </AlertDescription>
            </Alert>
          )}
          <p className="text-sm text-muted-foreground">
            Course titles and teachers’ details aren’t in DIU’s files: add them
            on{" "}
            <Link
              to="/admin/routine/courses"
              className="font-medium text-primary underline"
            >
              Course titles
            </Link>{" "}
            and{" "}
            <Link
              to="/admin/routine/teachers"
              className="font-medium text-primary underline"
            >
              Teachers
            </Link>
            .
          </p>
          <DialogFooter>
            <DialogClose asChild>
              <Button type="button" variant="outline">
                Cancel
              </Button>
            </DialogClose>
            <Button type="submit" disabled={busy}>
              {busy ? "Reading the file…" : "Upload"}
            </Button>
          </DialogFooter>
        </fetcher.Form>
      </DialogContent>
    </Dialog>
  );
}

/** One number of a review: how many classes moved, changed rooms, … */
export function ChangeStat({
  value,
  label,
  className,
}: {
  value: number | string;
  label: string;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "grid gap-0.5 rounded-2xl bg-surface-low px-4 py-3.5",
        className,
      )}
    >
      <span className="font-expressive text-3xl tabular-nums">{value}</span>
      <span className="text-sm text-muted-foreground">{label}</span>
    </div>
  );
}

/** The department in a URL's `?department=`, CSE by default. */
export function routineDepartmentOf(request: Request): RoutineDepartment {
  const asked = new URL(request.url).searchParams.get("department");
  return ROUTINE_DEPARTMENTS.find((d) => d === asked) ?? "CSE";
}

/** A tab per department, through `?department=`. */
export const departmentTabs = ROUTINE_DEPARTMENTS.map((d, i) => ({
  value: d,
  label: d,
  search: i === 0 ? "" : `?department=${d}`,
}));

/** What the course titles' and teachers' lists show: a department's page. */
export type CatalogView = {
  department: RoutineDepartment;
  q: string;
  missing: boolean;
  page: number;
};

/** The view a list's URL asks for. */
export function catalogViewOf(request: Request): CatalogView {
  const params = new URL(request.url).searchParams;
  return {
    department: routineDepartmentOf(request),
    q: params.get("q")?.trim() ?? "",
    missing: params.get("missing") === "true",
    page: Math.max(1, Number(params.get("page")) || 1),
  };
}

/** The search string of a view, leaving out what's the default. */
export function catalogSearch(view: Partial<CatalogView>) {
  const params = new URLSearchParams();
  if (view.department && view.department !== ROUTINE_DEPARTMENTS[0]) {
    params.set("department", view.department);
  }
  if (view.q) params.set("q", view.q);
  if (view.missing) params.set("missing", "true");
  if (view.page && view.page > 1) params.set("page", String(view.page));
  const search = params.toString();
  return search ? `?${search}` : "";
}

/** The API query for a view's page. */
export const catalogApiQuery = (view: CatalogView, pageSize: number) =>
  new URLSearchParams({
    department: view.department,
    page: String(view.page),
    pageSize: String(pageSize),
    ...(view.q ? { q: view.q } : {}),
    ...(view.missing ? { missing: "true" } : {}),
  });

/** Above a list with rows selected: how many, what to do with them, and Clear. */
export function SelectionBar({
  count,
  onClear,
  children,
}: {
  count: number;
  onClear: () => void;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-center gap-2 rounded-2xl bg-primary-container px-4 py-2 text-primary-container-foreground">
      <span className="mr-auto text-sm font-medium">{count} selected</span>
      {children}
      <Button size="sm" variant="ghost" onClick={onClear}>
        <X />
        Clear
      </Button>
    </div>
  );
}

/**
 * A cell edited where it is, for filling in many rows quickly: Enter saves and moves
 * to the next row's cell, leaving the cell saves too, Escape undoes. Each save is
 * its own fetcher, so typing on doesn't wait for it.
 */
export function InlineEdit({
  label,
  defaultValue,
  placeholder,
  fields,
  name,
  emptyFields,
  minLength = 2,
  maxLength,
}: {
  /** What the input is for, e.g. "Title of CSE321". */
  label: string;
  defaultValue: string;
  placeholder: string;
  /** Sent with the value. */
  fields: Record<string, string>;
  name: string;
  /** Sent instead when the cell is emptied (e.g. to remove a title); none: kept. */
  emptyFields?: Record<string, string>;
  minLength?: number;
  maxLength: number;
}) {
  const fetcher = useFetcher<ActionResult>();
  const [error, setError] = useState<string | null>(null);
  const saving = fetcher.state !== "idle";
  const result = fetcher.state === "idle" ? fetcher.data : undefined;
  const failed =
    result && !result.ok ? (result.fieldErrors[name] ?? result.error) : null;

  const save = (input: HTMLInputElement) => {
    const value = input.value.trim();
    if (value === defaultValue) return true;
    if (!value) {
      if (emptyFields) fetcher.submit(emptyFields, { method: "post" });
      else {
        input.value = defaultValue;
        return true;
      }
      setError(null);
      return true;
    }
    if (value.length < minLength) {
      setError(`At least ${minLength} characters`);
      return false;
    }
    setError(null);
    fetcher.submit({ ...fields, [name]: value }, { method: "post" });
    return true;
  };

  const message = error ?? failed;
  return (
    <div className="grid gap-0.5">
      <div className="relative">
        <Input
          // A new value from the server (saved here or elsewhere) starts afresh.
          key={defaultValue}
          defaultValue={defaultValue}
          placeholder={placeholder}
          aria-label={label}
          aria-invalid={message ? true : undefined}
          maxLength={maxLength}
          data-inline-edit
          onBlur={(event) => save(event.currentTarget)}
          onKeyDown={(event) => {
            const input = event.currentTarget;
            if (event.key === "Escape") {
              input.value = defaultValue;
              setError(null);
              input.blur();
            } else if (event.key === "Enter") {
              event.preventDefault();
              if (!save(input)) return;
              // On to the next row's cell, as in a spreadsheet.
              const cells = [
                ...document.querySelectorAll<HTMLInputElement>(
                  "input[data-inline-edit]",
                ),
              ];
              const next = cells[cells.indexOf(input) + 1];
              if (next) next.focus();
              else input.blur();
            }
          }}
          className={cn(
            "h-8 border-transparent bg-transparent pr-7 shadow-none hover:border-input focus-visible:bg-background",
            !defaultValue && "placeholder:text-muted-foreground/70",
          )}
        />
        {saving ? (
          <LoaderCircle
            className="absolute top-1/2 right-2 size-3.5 -translate-y-1/2 animate-spin text-muted-foreground"
            aria-label="Saving"
          />
        ) : result?.ok ? (
          <Check
            className="absolute top-1/2 right-2 size-3.5 -translate-y-1/2 text-primary"
            aria-label="Saved"
          />
        ) : null}
      </div>
      {message && (
        <p role="alert" className="px-3 text-xs text-destructive">
          {message}
        </p>
      )}
    </div>
  );
}
