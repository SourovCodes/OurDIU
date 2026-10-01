import type {
  ApiError,
  CreatedReport,
  QuestionDetail,
  QuestionInteractions,
  QuestionList,
  Submission,
} from "@ourdiu/shared";
import { Clock, Download, ExternalLink, FileX } from "lucide-react";
import {
  data,
  Link,
  useSearchParams,
  type ShouldRevalidateFunctionArgs,
} from "react-router";
import { EmptyState } from "~/components/empty-state";
import { OtherSemesters } from "~/components/other-semesters";
import { PageHeader } from "~/components/page-header";
import {
  PaperToolbar,
  ReportNotice,
  type PaperViewer,
} from "~/components/paper-toolbar";
import { PdfViewer } from "~/components/pdf-viewer";
import { PaperSwitcher, SubmissionList } from "~/components/submission-list";
import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import { apiFetch, readJson } from "~/lib/api.server";
import {
  parseVoteValue,
  useCountView,
  type PaperActionResult,
} from "~/lib/engagement";
import { hasSessionCookie, requireUser } from "~/lib/session.server";
import { paperTitles, plural, pickSubmission } from "~/lib/submissions";
import type { Route } from "./+types/question";

/** The signed-in visitor's votes and reports. Skipped for anonymous visitors. */
async function loadInteractions(request: Request, questionId: string) {
  if (!hasSessionCookie(request)) return null;
  const res = await apiFetch(
    request,
    `/api/v1/me/questions/${encodeURIComponent(questionId)}/interactions`,
  );
  return res.ok ? readJson<QuestionInteractions>(res) : null;
}

export async function loader({ request, params }: Route.LoaderArgs) {
  const [res, interactions] = await Promise.all([
    apiFetch(request, `/api/v1/questions/${encodeURIComponent(params.id)}`),
    loadInteractions(request, params.id),
  ]);
  // 422 means a malformed id, which is just as "not found" for a visitor.
  if (res.status === 404 || res.status === 422) {
    throw data("Question not found", { status: 404 });
  }
  if (!res.ok) throw data("Failed to load question", { status: 502 });
  const question = await readJson<QuestionDetail>(res);
  return {
    question,
    interactions,
    otherSemesters: await loadOtherSemesters(request, question),
  };
}

/** The same course and exam type in other semesters (newest first); optional. */
async function loadOtherSemesters(request: Request, question: QuestionDetail) {
  const query = new URLSearchParams({
    courseId: String(question.course.id),
    examTypeId: String(question.examType.id),
    pageSize: "100",
    // Newest semester first.
    sort: "az",
  });
  const res = await apiFetch(request, `/api/v1/questions?${query}`);
  if (!res.ok) return [];
  const list = await readJson<QuestionList>(res);
  return list.items.filter((other) => other.id !== question.id);
}

const jsonInit = (method: string, body: unknown): RequestInit => ({
  method,
  headers: { "content-type": "application/json" },
  body: JSON.stringify(body),
});

async function actionResult(
  res: Response,
  intent: PaperActionResult["intent"],
  questionId: number,
) {
  if (res.ok) {
    const report =
      intent === "report" ? await readJson<CreatedReport>(res) : null;
    return data<PaperActionResult>({
      intent,
      questionId,
      ok: true,
      submissionHidden: report?.submissionHidden,
    });
  }
  const body = await readJson<ApiError>(res).catch(() => null);
  return data<PaperActionResult>(
    {
      intent,
      questionId,
      ok: false,
      error:
        body && body.error.code !== "VALIDATION_ERROR"
          ? body.error.message
          : "Something went wrong. Please try again.",
    },
    { status: res.status },
  );
}

/** Votes and reports on the question's papers, forwarded to the API. */
export async function action({ request, params }: Route.ActionArgs) {
  await requireUser(request);
  const questionId = Number(params.id);
  const form = await request.formData();
  const submissionPath = `/api/v1/submissions/${encodeURIComponent(String(form.get("submissionId") ?? ""))}`;

  switch (form.get("intent")) {
    case "vote": {
      const value = parseVoteValue(form.get("value"));
      if (value === undefined) throw data("Invalid vote", { status: 400 });
      const res = await apiFetch(
        request,
        `${submissionPath}/vote`,
        value === null ? { method: "DELETE" } : jsonInit("PUT", { value }),
      );
      return actionResult(res, "vote", questionId);
    }
    case "report": {
      const details = String(form.get("details") ?? "").trim();
      const res = await apiFetch(
        request,
        `${submissionPath}/reports`,
        jsonInit("POST", {
          reason: form.get("reason"),
          details: details || undefined,
        }),
      );
      return actionResult(res, "report", questionId);
    }
    default:
      throw data("Unknown action", { status: 400 });
  }
}

// Switching submissions only changes `?submission=`, which the loader doesn't use.
export function shouldRevalidate({
  currentUrl,
  nextUrl,
  formMethod,
  defaultShouldRevalidate,
}: ShouldRevalidateFunctionArgs) {
  if (formMethod || currentUrl.pathname !== nextUrl.pathname) {
    return defaultShouldRevalidate;
  }
  const withoutSubmission = (url: URL) => {
    const params = new URLSearchParams(url.search);
    params.delete("submission");
    return params.toString();
  };
  return withoutSubmission(currentUrl) !== withoutSubmission(nextUrl);
}

export const meta: Route.MetaFunction = ({ loaderData }) => {
  if (!loaderData)
    return [{ title: "Question not found — OurDIU Question Bank" }];
  const { course, department, semester, examType } = loaderData.question;
  return [
    {
      title: `${course.name} (${department.shortName}) ${examType.name}, ${semester.name} — OurDIU Question Bank`,
    },
    {
      name: "description",
      content: `${examType.name} question papers for ${course.name}, ${semester.name}, ${department.name}.`,
    },
  ];
};

function viewerFor(
  submission: Submission,
  interactions: QuestionInteractions | null,
): PaperViewer {
  if (!interactions) return { kind: "anonymous" };
  if (submission.uploader?.id === interactions.userId) {
    return { kind: "uploader" };
  }
  return {
    kind: "member",
    vote:
      interactions.votes.find((vote) => vote.submissionId === submission.id)
        ?.value ?? null,
    reported: interactions.reportedSubmissionIds.includes(submission.id),
  };
}

export default function QuestionPage({ loaderData }: Route.ComponentProps) {
  const { question, interactions, otherSemesters } = loaderData;
  const [searchParams] = useSearchParams();
  const selected = pickSubmission(
    question.submissions,
    searchParams.get("submission"),
  );
  const { pendingReview } = question.submissionCounts;
  const fileUrl = selected?.fileUrl ?? null;
  const title = `${question.course.name} — ${question.examType.name}, ${question.semester.name}`;
  const published = question.submissions.filter(
    (s) => s.status === "published",
  );
  const paperLabel = selected
    ? (paperTitles(published).get(selected.id) ?? "")
    : "";

  useCountView(`/api/v1/questions/${question.id}/views`, question.viewToken);
  useCountView(
    selected
      ? `/api/v1/submissions/${encodeURIComponent(selected.id)}/views`
      : null,
    question.viewToken,
  );

  return (
    <div className="space-y-6">
      <PageHeader
        breadcrumbs={[
          { label: "Questions", to: "/questions/browse" },
          { label: question.course.name },
        ]}
        title={question.course.name}
        description={question.department.name}
        actions={
          fileUrl && (
            <>
              <Button variant="outline" size="sm" asChild>
                <a href={fileUrl} target="_blank" rel="noopener">
                  <ExternalLink aria-hidden />
                  Open in new tab
                </a>
              </Button>
              <Button size="sm" asChild>
                <a href={fileUrl} download>
                  <Download aria-hidden />
                  Download
                </a>
              </Button>
            </>
          )
        }
      >
        <div className="flex flex-wrap gap-2 pt-1">
          <Badge variant="outline">{question.department.shortName}</Badge>
          <Badge variant="outline">{question.semester.name}</Badge>
          <Badge variant="outline">{question.examType.name}</Badge>
        </div>
      </PageHeader>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1fr)_20rem] lg:items-start">
        {/* The paper comes first on small screens too; the lists follow it. */}
        <section aria-label="Question paper" className="min-w-0 space-y-3">
          <PaperSwitcher
            submissions={question.submissions}
            selectedId={selected?.id ?? null}
          />
          <ReportNotice questionId={question.id} />
          {selected && fileUrl ? (
            // One keyed wrapper (sibling keys must be unique): switching papers remounts
            // the toolbar and reloads the embedded document.
            <div key={selected.id} className="space-y-3">
              <PaperToolbar
                submission={selected}
                label={paperLabel}
                viewer={viewerFor(selected, interactions)}
              />
              <PdfViewer src={fileUrl} title={title} />
            </div>
          ) : (
            <EmptyState
              className="min-h-[32rem] lg:h-[80vh]"
              icon={pendingReview > 0 ? Clock : FileX}
              title="No published paper yet"
              description={
                pendingReview > 0
                  ? `${plural(pendingReview, "submission")} ${pendingReview === 1 ? "is" : "are"} waiting for admin review. The paper will appear here once approved.`
                  : "Papers submitted for this question weren’t approved. You can contribute a new one."
              }
              action={
                <Button variant="outline" size="sm" asChild>
                  <Link to="/questions/contribute">Contribute a paper</Link>
                </Button>
              }
            />
          )}
        </section>

        {/* On phones the papers list follows the paper; from `lg` it is a sticky
            column beside both the paper and the other semesters. */}
        <aside className="lg:row-span-2">
          <div className="lg:sticky lg:top-20">
            <SubmissionList
              submissions={question.submissions}
              selectedId={selected?.id ?? null}
            />
          </div>
        </aside>

        <OtherSemesters
          course={question.course.name}
          examType={question.examType.name}
          questions={otherSemesters}
        />
      </div>
    </div>
  );
}
