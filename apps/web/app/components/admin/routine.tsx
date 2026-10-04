import type {
  AdminRoutineVersion,
  RoutineFileProblem,
  RoutineVersionStatus,
} from "@ourdiu/shared";
import {
  MAX_ROUTINE_FILE_BYTES,
  MAX_ROUTINE_PDF_BYTES,
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
  "Its classes and the uploaded file (or PDF) are deleted for good. Students don’t notice: they only see the live version. You can upload it again later.";

/** The review page of an uploaded routine version. */
export const versionUrl = (id: number) => `/admin/routine/versions/${id}`;

/** The uploaded file of a version, straight from the API. */
export const versionFileHref = (v: Pick<AdminRoutineVersion, "id">) =>
  `/api/v1/admin/routine/versions/${v.id}/file`;

/** DIU's PDF a version was read from, if it was. */
export const versionPdfHref = (v: Pick<AdminRoutineVersion, "id">) =>
  `/api/v1/admin/routine/versions/${v.id}/pdf`;

/** What the upload action answers when the file can't be used. */
export type UploadResult = {
  ok: false;
  intent: "upload";
  error: string;
  problems: RoutineFileProblem[];
};

/** A routine PDF, read by OurDIU, rather than a JSON file. */
export const isPdfFile = (file: File) =>
  file.type === "application/pdf" || /\.pdf$/i.test(file.name);

const mb = (bytes: number) => `${bytes / 1024 / 1024} MB`;

/**
 * Uploads DIU's routine PDF (where OurDIU can read it) or a routine file. Problems
 * with a file are listed where they are in it; one that's fine opens as a draft (the
 * action redirects to its review).
 */
export function UploadRoutineDialog() {
  const fetcher = useFetcher<UploadResult>();
  const [tooLarge, setTooLarge] = useState<string | null>(null);
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
            DIU’s routine PDF as it is, for EEE, or a JSON file made from any
            department’s PDF. It’s read and checked, then kept as a draft for
            you to review; students see nothing until you make it live.
          </DialogDescription>
        </DialogHeader>
        <fetcher.Form
          method="post"
          encType="multipart/form-data"
          className="grid gap-4"
          onSubmit={(event) => {
            const file = new FormData(event.currentTarget).get("file");
            const max =
              file instanceof File && isPdfFile(file)
                ? MAX_ROUTINE_PDF_BYTES
                : MAX_ROUTINE_FILE_BYTES;
            if (file instanceof File && file.size > max) {
              event.preventDefault();
              setTooLarge(`The file is larger than ${mb(max)}.`);
            } else setTooLarge(null);
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
              {file ? file.name : "Choose or drop the PDF or JSON file"}
            </span>
            <span className="text-muted-foreground">
              {file
                ? `${Math.max(1, Math.round(file.size / 1024))} KB · choose another to replace it`
                : `EEE’s PDF up to ${mb(MAX_ROUTINE_PDF_BYTES)}, or a .json file up to ${mb(MAX_ROUTINE_FILE_BYTES)}`}
            </span>
            <input
              id="routine-file"
              name="file"
              type="file"
              accept="application/pdf,.pdf,application/json,.json"
              required
              aria-label="Routine PDF or file (.pdf, .json)"
              onChange={(event) => setFile(event.target.files?.[0] ?? null)}
              onDragEnter={() => setDragging(true)}
              onDragLeave={() => setDragging(false)}
              onDrop={() => setDragging(false)}
              className="absolute inset-0 cursor-pointer opacity-0"
            />
          </div>
          {tooLarge && <FormMessage message={tooLarge} />}
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
                  Fix the file and upload it again. Nothing was saved.
                </p>
              </AlertDescription>
            </Alert>
          )}
          <p className="text-sm text-muted-foreground">
            Another department’s PDF?{" "}
            <Link
              to="/admin/routine/format"
              className="font-medium text-primary underline"
            >
              File format
            </Link>{" "}
            has the JSON file’s rules, an example and instructions for an AI
            chat.
          </p>
          <DialogFooter>
            <DialogClose asChild>
              <Button type="button" variant="outline">
                Cancel
              </Button>
            </DialogClose>
            <Button type="submit" disabled={busy}>
              {busy
                ? file && isPdfFile(file)
                  ? "Reading the PDF…"
                  : "Checking…"
                : "Upload"}
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
