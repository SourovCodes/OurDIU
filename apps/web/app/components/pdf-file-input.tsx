import { MAX_SUBMISSION_FILE_BYTES } from "@ourdiu/shared/constants";
import { FileText, Upload } from "lucide-react";
import { useId, useRef, useState } from "react";
import { ExamShape } from "~/components/exam-badge";
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
      <Label htmlFor={id} className="sr-only">
        {label}
      </Label>
      <div
        onDragOver={(event) => {
          event.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={onDrop}
        className={cn(
          "relative flex items-center gap-4 overflow-hidden rounded-[1.75rem] border-2 border-dashed p-5 transition-colors has-focus-visible:ring-[3px] has-focus-visible:ring-ring/50 sm:p-6",
          file
            ? "border-transparent bg-surface"
            : "border-primary/30 bg-primary-container/60 hover:bg-primary-container",
          dragging && "border-primary bg-primary-container",
          error && "border-destructive",
        )}
      >
        <span className="relative flex size-16 shrink-0 items-center justify-center">
          <ExamShape
            kind={file ? "lab" : "final"}
            colored={false}
            className="absolute inset-0 size-full text-primary"
          />
          {file ? (
            <FileText
              className="relative size-7 text-primary-foreground"
              aria-hidden
            />
          ) : (
            <Upload
              className="relative size-7 text-primary-foreground"
              aria-hidden
            />
          )}
        </span>
        <div className="min-w-0 flex-1">
          <p className={cn("font-expressive text-lg", file && "truncate")}>
            {file ? file.name : "Drop the question paper here"}
          </p>
          <p className="text-sm text-muted-foreground">
            {file
              ? `${formatBytes(file.size)} · PDF`
              : `Or choose a PDF, up to ${formatBytes(MAX_SUBMISSION_FILE_BYTES)}. One exam per file.`}
          </p>
        </div>
        <span
          aria-hidden
          className={cn(
            buttonVariants({ variant: file ? "outline" : "default" }),
            "max-sm:hidden",
          )}
        >
          {file ? "Change" : "Choose PDF"}
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
