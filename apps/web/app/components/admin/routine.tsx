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
import { FileUp, Upload } from "lucide-react";
import { useState } from "react";
import { Link, useFetcher } from "react-router";
import { FormMessage } from "~/components/form";
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

/** What deleting a version does; the live one can't be deleted. */
export const DELETE_DESCRIPTION =
  "Its classes and its PDF are deleted for good. Students don’t notice: they only see the live version. You can upload the PDF again later.";

/** The review page of an uploaded routine version. */
export const versionUrl = (id: number) => `/admin/routine/versions/${id}`;

/** DIU's PDF a version was read from, straight from the API. */
export const versionPdfHref = (v: Pick<AdminRoutineVersion, "id">) =>
  `/api/v1/admin/routine/versions/${v.id}/pdf`;

/** What the upload action answers when the PDF can't be used. */
export type UploadResult = {
  ok: false;
  intent: "upload";
  error: string;
  problems: RoutineFileProblem[];
};

const MAX_MB = MAX_ROUTINE_PDF_BYTES / 1024 / 1024;

/**
 * Uploads DIU's routine PDF, read on the server. One it can't read is answered with
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
            DIU’s routine PDF as the department publishes it, CSE’s or EEE’s.
            It’s read and checked, then kept as a draft for you to review;
            students see nothing until you make it live.
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
              {file ? file.name : "Choose or drop the routine PDF"}
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
              accept="application/pdf,.pdf"
              required
              aria-label="Routine PDF"
              onChange={(event) => setFile(event.target.files?.[0] ?? null)}
              onDragEnter={() => setDragging(true)}
              onDragLeave={() => setDragging(false)}
              onDrop={() => setDragging(false)}
              className="absolute inset-0 cursor-pointer opacity-0"
            />
          </div>
          {tooLarge && (
            <FormMessage message={`The PDF is larger than ${MAX_MB} MB.`} />
          )}
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
                  Nothing was saved. If this is the department’s routine PDF,
                  its layout may have changed: tell the developers.
                </p>
              </AlertDescription>
            </Alert>
          )}
          <p className="text-sm text-muted-foreground">
            Course titles and teachers’ details aren’t in the PDFs: add them on{" "}
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
              {busy ? "Reading the PDF…" : "Upload"}
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
