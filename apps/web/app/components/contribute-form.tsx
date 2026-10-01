import type { Course, Department, ExamType, Semester } from "@ourdiu/shared";
import { Form } from "react-router";
import { ClassificationFields } from "~/components/classification-fields";
import { FormMessage } from "~/components/form";
import { PaperDetailsFields } from "~/components/paper-details-fields";
import { PdfFileInput } from "~/components/pdf-file-input";
import { Button } from "~/components/ui/button";
import { Card, CardFooter } from "~/components/ui/card";

type ContributeFormProps = {
  departments: Department[];
  courses: Course[];
  semesters: Semester[];
  examTypes: ExamType[];
  fieldErrors: Record<string, string>;
  message?: string;
  submitting: boolean;
};

export function ContributeForm({
  departments,
  courses,
  semesters,
  examTypes,
  fieldErrors,
  message,
  submitting,
}: ContributeFormProps) {
  return (
    <Form method="post" encType="multipart/form-data" className="min-w-0">
      <Card className="gap-0 py-0">
        <div className="grid grid-cols-1 gap-5 p-4 sm:grid-cols-2 sm:p-6">
          <ClassificationFields
            departments={departments}
            courses={courses}
            semesters={semesters}
            examTypes={examTypes}
            fieldErrors={fieldErrors}
          />
          {/* Two short fields: side by side on phones too. */}
          <div className="grid grid-cols-2 gap-3 sm:col-span-2 sm:gap-5">
            <PaperDetailsFields fieldErrors={fieldErrors} />
          </div>

          <div className="sm:col-span-2">
            <PdfFileInput
              label="PDF file"
              name="file"
              error={fieldErrors.file}
            />
          </div>

          {message && (
            <div className="sm:col-span-2">
              <FormMessage message={message} />
            </div>
          )}
        </div>

        <CardFooter className="justify-end border-t py-4">
          <Button
            type="submit"
            disabled={submitting}
            className="w-full sm:w-auto"
          >
            {submitting ? "Uploading…" : "Submit paper"}
          </Button>
        </CardFooter>
      </Card>
    </Form>
  );
}
