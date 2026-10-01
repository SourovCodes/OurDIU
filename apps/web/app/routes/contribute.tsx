import type { ApiError, CreatedSubmission } from "@ourdiu/shared";
import { ChevronDown, Lightbulb } from "lucide-react";
import { redirect, useNavigation } from "react-router";
import { ContributeForm } from "~/components/contribute-form";
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";
import { PageHeader } from "~/components/page-header";
import { apiFetch, readJson } from "~/lib/api.server";
import { fieldErrorsFrom } from "~/lib/api-errors";
import { requireUser } from "~/lib/session.server";
import { loadTaxonomy } from "~/lib/taxonomy.server";
import type { Route } from "./+types/contribute";

export const meta: Route.MetaFunction = () => [
  { title: "Contribute a paper — OurDIU Question Bank" },
  { name: "robots", content: "noindex" },
];

export async function loader({ request }: Route.LoaderArgs) {
  await requireUser(request);
  return loadTaxonomy(request);
}

export async function action({ request }: Route.ActionArgs) {
  await requireUser(request);
  // Forward the multipart body as-is; the API validates it.
  const res = await apiFetch(request, "/api/v1/submissions", {
    method: "POST",
    body: await request.formData(),
  });

  if (res.status === 201) {
    // Follow the review (AI check, then publishing) on the paper's status page.
    const created = await readJson<CreatedSubmission>(res);
    return redirect(
      `/questions/my-submissions/${encodeURIComponent(created.id)}?uploaded`,
    );
  }
  const body = await readJson<ApiError>(res).catch(() => null);
  const fieldErrors = fieldErrorsFrom(body);
  return {
    fieldErrors,
    message:
      Object.keys(fieldErrors).length > 0
        ? undefined
        : (body?.error.message ?? "Upload failed. Please try again."),
  };
}

const STEPS = [
  "Choose the department, course, semester and exam type.",
  "Upload the question paper as a PDF.",
  "AI checks it. If it’s one question paper with the details you chose, it’s published right away.",
  "Otherwise, or if it adds new entries, an admin reviews it first.",
];

function HowItWorks() {
  return (
    <div className="grid gap-4 text-sm">
      <ol className="space-y-3">
        {STEPS.map((step, index) => (
          <li key={step} className="flex gap-3">
            <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-background text-xs font-medium shadow-xs ring-1 ring-border">
              {index + 1}
            </span>
            <span className="pt-0.5 text-muted-foreground">{step}</span>
          </li>
        ))}
      </ol>
      <p className="flex gap-2 border-t pt-4 text-muted-foreground">
        <Lightbulb className="mt-0.5 size-4 shrink-0" aria-hidden />
        <span>
          Can’t find a department, course or semester? Type its name and choose
          “Add”.
        </span>
      </p>
    </div>
  );
}

export default function Contribute({
  loaderData,
  actionData,
}: Route.ComponentProps) {
  const submitting = useNavigation().state === "submitting";
  const failed = actionData ?? null;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Contribute a paper"
        description="Upload a question paper PDF and tell us where it belongs. It’s checked by AI, and by an admin when needed, before it is published."
      />

      {/* Below `lg` the steps would come after the submit button, so they sit
          above the form, folded away. */}
      <details className="group rounded-xl border bg-muted/30 lg:hidden">
        <summary className="flex cursor-pointer list-none items-center justify-between gap-2 px-4 py-3 text-sm font-medium [&::-webkit-details-marker]:hidden">
          How it works
          <ChevronDown
            className="size-4 text-muted-foreground transition-transform group-open:rotate-180"
            aria-hidden
          />
        </summary>
        <div className="px-4 pb-4">
          <HowItWorks />
        </div>
      </details>

      <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_20rem] lg:gap-8">
        <ContributeForm
          {...loaderData}
          fieldErrors={failed?.fieldErrors ?? {}}
          message={failed?.message}
          submitting={submitting}
        />
        <Card className="gap-4 bg-muted/30 shadow-none max-lg:hidden">
          <CardHeader>
            <CardTitle>
              <h2>How it works</h2>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <HowItWorks />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
