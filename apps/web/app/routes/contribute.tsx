import type { ApiError, CreatedSubmission } from "@ourdiu/shared";
import { canContribute, DIU_EMAIL_DOMAINS } from "@ourdiu/shared/constants";
import { MailWarning } from "lucide-react";
import { Form, redirect, useNavigation } from "react-router";
import { AndroidBetaLink } from "~/components/android-beta";
import { ContributeForm } from "~/components/contribute-form";
import { EmptyState } from "~/components/empty-state";
import { Button } from "~/components/ui/button";
import { apiFetch, readJson } from "~/lib/api.server";
import { fieldErrorsFrom } from "~/lib/api-errors";
import { requireUser } from "~/lib/session.server";
import { rememberedDepartment } from "~/lib/department-preference";
import { loadTaxonomy } from "~/lib/taxonomy.server";
import type { Route } from "./+types/contribute";

export const meta: Route.MetaFunction = () => [
  { title: "Share a paper — OurDIU Question Bank" },
  { name: "robots", content: "noindex" },
];

/** "@diu.edu.bd or @s.diu.edu.bd" */
const DOMAINS = DIU_EMAIL_DOMAINS.map((domain) => `@${domain}`).join(" or ");

export async function loader({ request }: Route.LoaderArgs) {
  const user = await requireUser(request);
  // Anyone can have an account, but only DIU addresses (and admins) can upload.
  if (!canContribute({ email: user.email, role: user.role })) {
    return { allowed: false as const, email: user.email };
  }
  const taxonomy = await loadTaxonomy(request);
  // Starts on the department the visitor browses, as the app starts on the one
  // they share or read most.
  const remembered = rememberedDepartment(request.headers.get("cookie"));
  const department = taxonomy.departments.find(
    (d) => String(d.id) === remembered,
  );
  return {
    allowed: true as const,
    ...taxonomy,
    defaultDepartmentId: department ? String(department.id) : null,
  };
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
  {
    title: "Upload",
    text: "The PDF and which exam it is. Takes a minute.",
  },
  {
    title: "AI check",
    text: "It reads the paper. One exam with the details you chose is published straight away.",
  },
  {
    title: "Review",
    text: "Anything else, or a new course or semester, waits for an admin.",
  },
  {
    title: "Published",
    text: "Your name goes on it, and you can follow its views in My submissions.",
  },
];

/** The review as a timeline, like a paper's status page. */
function HowItWorks() {
  return (
    <ol className="grid gap-0">
      {STEPS.map((step, index) => (
        <li key={step.title} className="relative flex gap-4 pb-5 last:pb-0">
          {index < STEPS.length - 1 && (
            <span
              aria-hidden
              className="absolute top-8 bottom-0 left-[0.9375rem] w-0.5 bg-primary/20"
            />
          )}
          <span className="relative flex size-8 shrink-0 items-center justify-center rounded-full bg-primary-container text-sm font-bold text-primary-container-foreground">
            {index + 1}
          </span>
          <span className="pt-1">
            <span className="block font-semibold">{step.title}</span>
            <span className="block text-sm text-muted-foreground">
              {step.text}
            </span>
          </span>
        </li>
      ))}
    </ol>
  );
}

export default function Contribute({
  loaderData,
  actionData,
}: Route.ComponentProps) {
  const submitting = useNavigation().state === "submitting";
  const failed = actionData ?? null;

  if (!loaderData.allowed) {
    return (
      <div className="space-y-6">
        <h1 className="font-display-xl text-5xl sm:text-6xl">Share a paper</h1>
        <EmptyState
          icon={MailWarning}
          shape="midterm"
          title="Sharing needs a DIU email"
          description={
            <>
              You’re signed in as {loaderData.email}. To keep the papers
              trustworthy, only DIU accounts ({DOMAINS}) can share them. Sign in
              with your DIU Google account to contribute.
            </>
          }
          action={
            <Form method="post" action="/logout">
              <input
                type="hidden"
                name="redirectTo"
                value="/login?redirectTo=%2Fquestions%2Fcontribute"
              />
              <Button type="submit">Switch to your DIU account</Button>
            </Form>
          }
        />
      </div>
    );
  }

  const { defaultDepartmentId, ...taxonomy } = loaderData;
  return (
    <div className="space-y-8">
      <div className="space-y-3">
        <h1 className="font-display-xl text-5xl sm:text-7xl">Share a paper</h1>
        <p className="max-w-2xl text-lg text-pretty text-muted-foreground">
          Just sat an exam? Share the question paper so the next batch can study
          from it.
        </p>
      </div>

      <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_20rem] lg:gap-8">
        <ContributeForm
          {...taxonomy}
          defaults={
            defaultDepartmentId
              ? {
                  department: { kind: "existing", id: defaultDepartmentId },
                  shortName: "",
                  course: null,
                  semester: null,
                  examType: null,
                }
              : undefined
          }
          fieldErrors={failed?.fieldErrors ?? {}}
          message={failed?.message}
          submitting={submitting}
        />
        <aside className="grid gap-4 lg:sticky lg:top-24">
          <section
            aria-labelledby="how-heading"
            className="rounded-[1.75rem] bg-surface p-6"
          >
            <h2 id="how-heading" className="mb-4 font-expressive text-xl">
              What happens next
            </h2>
            <HowItWorks />
          </section>
          <AndroidBetaLink>
            Scan papers with your camera in the OurDIU Android app.
          </AndroidBetaLink>
        </aside>
      </div>
    </div>
  );
}
