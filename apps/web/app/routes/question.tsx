import type {
  ApiError,
  CreatedReport,
  QuestionDetail,
  QuestionInteractions,
  Question,
  QuestionList,
  Submission,
} from "@ourdiu/shared";
import { Clock, Download, FileX } from "lucide-react";
import {
  data,
  Link,
  useRouteLoaderData,
  useSearchParams,
  type ShouldRevalidateFunctionArgs,
} from "react-router";
import { useDownloadInvite } from "~/components/android-beta";
import { EmptyState } from "~/components/empty-state";
import { OtherExams } from "~/components/other-exams";
import { courseHref } from "~/components/course-search";
import { ExamBadge } from "~/components/exam-badge";
import { Breadcrumbs } from "~/components/page-header";
import {
  PaperFeedback,
  PaperInfo,
  PaperToolbar,
  ReportNotice,
  type PaperViewer,
} from "~/components/paper-toolbar";
import { PdfViewer } from "~/components/pdf-viewer";
import { SaveButton } from "~/components/save-button";
import { ShareButton } from "~/components/share-button";
import { PaperSwitcher, SubmissionList } from "~/components/submission-list";
import { Button } from "~/components/ui/button";
import { apiFetch, readJson } from "~/lib/api.server";
import { redirectIfMerged } from "~/lib/merged.server";
import {
  parseVoteValue,
  useCountView,
  type PaperActionResult,
} from "~/lib/engagement";
import { hasSessionCookie, requireUser } from "~/lib/session.server";
import { paperTitles, plural, pickSubmission } from "~/lib/submissions";
import { formatViews } from "~/lib/format";
import type { RootLoader } from "~/root";
import type { Route } from "./+types/question";
import { breadcrumbJsonLd, originOf, pageMeta, QB_NAME } from "~/lib/seo";

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
    await redirectIfMerged(
      request,
      "question",
      params.id,
      (id) => `/questions/${id}`,
    );
    throw data("Question not found", { status: 404 });
  }
  if (!res.ok) throw data("Failed to load question", { status: 502 });
  const question = await readJson<QuestionDetail>(res);
  return {
    question,
    interactions,
    otherExams: await loadOtherExams(request, question),
  };
}

/**
 * The course's other exams (optional): the same exam type's other semesters first,
 * then the other exam types, each newest semester first.
 */
async function loadOtherExams(request: Request, question: QuestionDetail) {
  const query = new URLSearchParams({
    courseId: String(question.course.id),
    pageSize: "100",
    // By exam type, newest semester first.
    sort: "az",
  });
  const res = await apiFetch(request, `/api/v1/questions?${query}`);
  if (!res.ok) return [];
  const list = await readJson<QuestionList>(res);
  const others = list.items.filter((other) => other.id !== question.id);
  const sameType = (q: Question) => q.examType.id === question.examType.id;
  return [...others.filter(sameType), ...others.filter((q) => !sameType(q))];
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
    case "save": {
      const path = `/api/v1/me/saved/${questionId}`;
      const res = await apiFetch(request, path, {
        method: form.get("saved") === "true" ? "PUT" : "DELETE",
      });
      return actionResult(res, "save", questionId);
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

export const meta: Route.MetaFunction = ({ loaderData, matches }) => {
  if (!loaderData) return [{ title: `Question not found — ${QB_NAME}` }];
  const { id, course, department, semester, examType } = loaderData.question;
  return [
    ...pageMeta({
      title: `${course.name} ${examType.name} Question, ${semester.name} (DIU ${department.shortName}) — ${QB_NAME}`,
      description: `${course.name} ${examType.name.toLowerCase()} exam question paper of ${semester.name}, ${department.name}, Daffodil International University (DIU). Read it free or download the PDF.`,
    }),
    breadcrumbJsonLd(originOf(matches), [
      { name: QB_NAME, path: "/questions" },
      {
        name: department.shortName,
        path: `/questions/departments/${department.id}`,
      },
      { name: course.name, path: courseHref(course.id) },
      {
        name: `${examType.name}, ${semester.name}`,
        path: `/questions/${id}`,
      },
    ]),
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
  const { question, interactions, otherExams } = loaderData;
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

  const inviteToApp = useDownloadInvite();
  const signedIn = Boolean(useRouteLoaderData<RootLoader>("root")?.user);
  const viewer = selected ? viewerFor(selected, interactions) : null;
  const position = {
    index: Math.max(0, selected ? published.indexOf(selected) : 0),
    total: published.length,
  };
  const save = (
    <SaveButton
      questionId={question.id}
      saved={interactions?.saved ?? false}
      signedIn={signedIn}
    />
  );

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-center gap-x-4 gap-y-4">
        <ExamBadge
          examType={question.examType.name}
          size={64}
          className="max-sm:size-11!"
        />
        <div className="min-w-0 flex-1 space-y-1">
          <div className="max-sm:hidden">
            <Breadcrumbs
              crumbs={[
                {
                  label: question.department.shortName,
                  to: `/questions/departments/${question.department.id}`,
                },
                {
                  label: question.course.name,
                  to: courseHref(question.course.id),
                },
              ]}
            />
          </div>
          <h1 className="font-expressive text-2xl text-balance sm:text-4xl">
            {question.course.name}
          </h1>
          <p className="text-sm text-muted-foreground">
            <Link
              to={`/questions/departments/${question.department.id}`}
              className="underline-offset-4 hover:underline sm:hidden"
            >
              {question.department.shortName} ·{" "}
            </Link>
            {question.examType.name} · {question.semester.name} ·{" "}
            {formatViews(question.viewCount)}
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-2 max-sm:w-full">
          {save}
          <ShareButton title={title} />
          {fileUrl && (
            <Button className="max-sm:ml-auto" asChild>
              <a href={fileUrl} download onClick={inviteToApp}>
                <Download aria-hidden />
                Download PDF
              </a>
            </Button>
          )}
        </div>
      </header>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_21rem] lg:items-start">
        {/* The paper comes first on small screens too; the lists follow it. */}
        <section aria-label="Question paper" className="min-w-0 space-y-3">
          <PaperSwitcher
            submissions={question.submissions}
            selectedId={selected?.id ?? null}
          />
          <ReportNotice questionId={question.id} />
          {selected && fileUrl && viewer ? (
            // One keyed wrapper (sibling keys must be unique): switching papers remounts
            // the bars and reloads the embedded document. On phones the bar comes
            // last and sticks to the bottom of the screen while the paper is in view.
            <div
              key={selected.id}
              className="flex flex-col overflow-clip rounded-3xl bg-surface"
            >
              <PaperInfo
                submission={selected}
                label={paperLabel}
                position={position}
                className="max-lg:hidden"
              />
              <PdfViewer
                src={fileUrl}
                title={title}
                className="rounded-none lg:mx-5 lg:mb-5 lg:rounded-2xl"
              />
              <PaperToolbar
                submission={selected}
                label={paperLabel}
                viewer={viewer}
                fileUrl={fileUrl}
                className="sticky bottom-0 z-10 lg:hidden"
              />
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
                  <Link to="/questions/contribute">Share a paper</Link>
                </Button>
              }
            />
          )}
        </section>

        {/* On phones the lists follow the paper; from `lg` they are a column
            beside it. */}
        <aside className="space-y-4">
          <SubmissionList
            submissions={question.submissions}
            selectedId={selected?.id ?? null}
          />
          {selected && viewer && (
            <div className="max-lg:hidden">
              <PaperFeedback
                submission={selected}
                label={paperLabel}
                viewer={viewer}
              />
            </div>
          )}
          <OtherExams course={question.course} questions={otherExams} />
        </aside>
      </div>
    </div>
  );
}
