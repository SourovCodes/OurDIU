import type {
  AdminRoutineVersion,
  RoutineFileProblem,
  RoutineVersionStatus,
} from "@ourdiu/shared";
import { MAX_ROUTINE_FILE_BYTES } from "@ourdiu/shared/constants";
import { FileJson, Upload } from "lucide-react";
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

/** The review page of an uploaded routine version. */
export const versionUrl = (id: number) => `/admin/routine/versions/${id}`;

/** The uploaded file of a version, straight from the API. */
export const versionFileHref = (v: Pick<AdminRoutineVersion, "id">) =>
  `/api/v1/admin/routine/versions/${v.id}/file`;

/** What the upload action answers when the file can't be used. */
export type UploadResult = {
  ok: false;
  intent: "upload";
  error: string;
  problems: RoutineFileProblem[];
};

/**
 * Uploads a routine file. Problems with the file are listed where they are in it;
 * a file that's fine opens as a draft (the action redirects to its review).
 */
export function UploadRoutineDialog() {
  const fetcher = useFetcher<UploadResult>();
  const [tooLarge, setTooLarge] = useState(false);
  const busy = fetcher.state !== "idle";
  const result = !busy ? fetcher.data : undefined;

  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button>
          <Upload aria-hidden />
          Upload routine file
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>Upload routine file</DialogTitle>
          <DialogDescription>
            A JSON file made from DIU’s routine PDF. It’s checked, then kept as
            a draft for you to review; students see nothing until you make it
            live.
          </DialogDescription>
        </DialogHeader>
        <fetcher.Form
          method="post"
          encType="multipart/form-data"
          className="grid gap-4"
          onSubmit={(event) => {
            const file = new FormData(event.currentTarget).get("file");
            if (file instanceof File && file.size > MAX_ROUTINE_FILE_BYTES) {
              event.preventDefault();
              setTooLarge(true);
            } else setTooLarge(false);
          }}
        >
          <input type="hidden" name="intent" value="upload" />
          <label
            htmlFor="routine-file"
            className="grid gap-2 rounded-2xl border-[1.5px] border-dashed border-input p-4 text-sm"
          >
            <span className="flex items-center gap-2 font-medium">
              <FileJson className="size-4" aria-hidden />
              Routine file (.json)
            </span>
            <input
              id="routine-file"
              name="file"
              type="file"
              accept="application/json,.json"
              required
              className="text-sm file:mr-3 file:rounded-full file:border-0 file:bg-primary-container file:px-4 file:py-1.5 file:font-semibold file:text-primary-container-foreground"
            />
          </label>
          {tooLarge && (
            <FormMessage
              message={`The file is larger than ${MAX_ROUTINE_FILE_BYTES / 1024 / 1024} MB.`}
            />
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
                  Fix the file and upload it again. Nothing was saved.
                </p>
              </AlertDescription>
            </Alert>
          )}
          <p className="text-sm text-muted-foreground">
            Not sure of the format?{" "}
            <Link
              to="/admin/routine/format"
              className="font-medium text-primary underline"
            >
              File format
            </Link>{" "}
            has the rules, an example and instructions for an AI chat.
          </p>
          <DialogFooter>
            <DialogClose asChild>
              <Button type="button" variant="outline">
                Cancel
              </Button>
            </DialogClose>
            <Button type="submit" disabled={busy}>
              {busy ? "Checking…" : "Upload"}
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
