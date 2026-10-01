import { MAX_SUBMISSION_FILE_BYTES } from "@ourdiu/shared/constants";
import { FileText, Upload } from "lucide-react";
import { useId, useRef, useState } from "react";
import { buttonVariants } from "~/components/ui/button";
import { Label } from "~/components/ui/label";
import { formatBytes } from "~/lib/format";
import { cn } from "~/lib/utils";

type PdfFileInputProps = {
  name: string;
  label: string;
  error?: string;
};

/** A file picker styled as a drop zone. The native input stays in the form. */
export function PdfFileInput({ name, label, error }: PdfFileInputProps) {
  const id = useId();
  const errorId = `${id}-error`;
  const inputRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [dragging, setDragging] = useState(false);

  const onDrop = (event: React.DragEvent) => {
    event.preventDefault();
    setDragging(false);
    const dropped = event.dataTransfer.files[0];
    if (!dropped || !inputRef.current) return;
    const transfer = new DataTransfer();
    transfer.items.add(dropped);
    inputRef.current.files = transfer.files;
    setFile(dropped);
  };

  return (
    <div className="grid gap-1.5">
      <Label htmlFor={id}>{label}</Label>
      <div
        onDragOver={(event) => {
          event.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={onDrop}
        className={cn(
          "relative flex items-center gap-3 rounded-lg border border-dashed border-muted-foreground/30 p-3 transition-colors hover:bg-muted/40 has-focus-visible:border-ring has-focus-visible:ring-[3px] has-focus-visible:ring-ring/50 sm:p-4",
          dragging && "border-primary bg-primary/5",
          error && "border-destructive",
        )}
      >
        <div className="flex size-10 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary">
          {file ? (
            <FileText className="size-5" aria-hidden />
          ) : (
            <Upload className="size-5" aria-hidden />
          )}
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium">
            {file ? file.name : "Drop a PDF here or browse"}
          </p>
          <p className="text-xs text-muted-foreground">
            {file
              ? formatBytes(file.size)
              : `PDF only, up to ${formatBytes(MAX_SUBMISSION_FILE_BYTES)}`}
          </p>
        </div>
        <span
          aria-hidden
          className={buttonVariants({ variant: "outline", size: "sm" })}
        >
          {file ? "Change" : "Browse"}
        </span>
        {/* Transparent over the whole zone, so clicks and focus reach the real input. */}
        <input
          ref={inputRef}
          id={id}
          type="file"
          name={name}
          accept="application/pdf,.pdf"
          required
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? errorId : undefined}
          onChange={(event) => setFile(event.target.files?.[0] ?? null)}
          className="absolute inset-0 cursor-pointer opacity-0"
        />
      </div>
      {error && (
        <p id={errorId} className="text-sm text-destructive">
          {error}
        </p>
      )}
    </div>
  );
}
