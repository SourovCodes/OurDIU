import type { Course, Department, ExamType, Semester } from "@ourdiu/shared";
import { Info, Send } from "lucide-react";
import { useCallback, useEffect } from "react";
import { Form, Link, useFetcher } from "react-router";
import {
  ClassificationFields,
  type ClassificationDefaults,
} from "~/components/classification-fields";
import { FormMessage } from "~/components/form";
import { PaperDetailsFields } from "~/components/paper-details-fields";
import { PdfFileInput } from "~/components/pdf-file-input";
import { Button } from "~/components/ui/button";
import { plural } from "~/lib/submissions";

type ContributeFormProps = {
  departments: Department[];
  courses: Course[];
  semesters: Semester[];
  examTypes: ExamType[];
  fieldErrors: Record<string, string>;
  message?: string;
  submitting: boolean;
  defaults?: ClassificationDefaults;
};

type ExamPapers = { id: number; published: number } | null;

/** One of the form's steps: a number, a title, then its fields. */
function Step({
  n,
  title,
  hint,
  children,
}: {
  n: number;
  title: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <section
      aria-labelledby={`step-${n}`}
      className="grid gap-4 rounded-[1.75rem] bg-surface p-5 sm:p-7"
    >
      <div className="flex items-center gap-3">
        <span
          aria-hidden
          className="flex size-8 shrink-0 items-center justify-center rounded-full bg-primary text-sm font-bold text-primary-foreground"
        >
          {n}
        </span>
        <div>
          <h2 id={`step-${n}`} className="font-expressive text-xl">
            {title}
          </h2>
          {hint && <p className="text-sm text-muted-foreground">{hint}</p>}
        </div>
      </div>
      {children}
    </section>
  );
}

/**
 * The paper first, then which exam it is, then how to tell it apart, as in the
 * app's upload screen. Says when the exam already has papers, so a second copy comes
 * with its section or batch.
 */
export function ContributeForm({
  departments,
  courses,
  semesters,
  examTypes,
  fieldErrors,
  message,
  submitting,
  defaults,
}: ContributeFormProps) {
  const lookup = useFetcher<ExamPapers>();
  const { load } = lookup;
  const onClassify = useCallback(
    ({
      courseId,
      semesterId,
      examTypeId,
    }: {
      courseId: string | null;
      semesterId: string | null;
      examTypeId: string | null;
    }) => {
      if (!courseId || !semesterId || !examTypeId) return;
      void load(
        `/questions/exam-papers?${new URLSearchParams({ courseId, semesterId, examTypeId })}`,
      );
    },
    [load],
  );
  const existing =
    lookup.data && lookup.data.published > 0 ? lookup.data : null;

  // Leaving with a chosen file would lose it; the browser asks first.
  useEffect(() => {
    const warn = (event: BeforeUnloadEvent) => {
      const input = document.querySelector<HTMLInputElement>(
        'input[type="file"][name="file"]',
      );
      if (input?.files?.length && !submitting) event.preventDefault();
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [submitting]);

  return (
    <Form
      method="post"
      encType="multipart/form-data"
      className="grid min-w-0 gap-3"
    >
      <Step n={1} title="The paper">
        <PdfFileInput label="PDF file" name="file" error={fieldErrors.file} />
      </Step>

      <Step
        n={2}
        title="Which exam is it?"
        hint="Can’t find it? Type the name and choose “Add”."
      >
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
          <ClassificationFields
            departments={departments}
            courses={courses}
            semesters={semesters}
            examTypes={examTypes}
            fieldErrors={fieldErrors}
            defaults={defaults}
            examTypeChips
            onClassify={onClassify}
          />
        </div>
        {existing && (
          <p
            role="status"
            className="flex gap-3 rounded-2xl bg-primary-container p-4 text-sm text-primary-container-foreground"
          >
            <Info className="mt-0.5 size-4 shrink-0" aria-hidden />
            <span>
              This exam already has {plural(existing.published, "paper")}.{" "}
              <Link
                to={`/questions/${existing.id}`}
                target="_blank"
                className="font-semibold underline decoration-1 underline-offset-4 hover:decoration-2"
              >
                Have a look
              </Link>
              ; if yours is a different copy, add its section or batch below.
            </span>
          </p>
        )}
      </Step>

      <Step
        n={3}
        title="Tell it apart"
        hint="Optional, but it helps when an exam has several copies."
      >
        <div className="grid grid-cols-2 gap-3 sm:gap-5">
          <PaperDetailsFields fieldErrors={fieldErrors} />
        </div>
      </Step>

      {message && <FormMessage message={message} />}

      {/* Stays in reach on phones while the form scrolls. */}
      <div className="sticky bottom-0 z-10 -mx-4 flex items-center justify-between gap-4 border-t bg-background/95 px-4 py-3 backdrop-blur sm:static sm:mx-0 sm:border-0 sm:bg-transparent sm:p-0 sm:backdrop-blur-none">
        <p className="text-sm text-muted-foreground max-sm:hidden">
          Your name goes on the paper as the one who shared it.
        </p>
        <Button
          type="submit"
          size="lg"
          disabled={submitting}
          className="max-sm:w-full"
        >
          <Send aria-hidden />
          {submitting ? "Uploading…" : "Share paper"}
        </Button>
      </div>
    </Form>
  );
}
