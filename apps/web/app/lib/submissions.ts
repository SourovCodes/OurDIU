import type {
  ContributorSubmission,
  Submission,
  SubmissionClassification,
  SubmissionStatus,
} from "@ourdiu/shared";
import { formatNumber } from "./format";

export const STATUS_LABELS: Record<SubmissionStatus, string> = {
  published: "Published",
  pending_review: "Pending review",
  rejected: "Rejected",
  changes_requested: "Needs changes",
};

/** The signed-in uploader's copy of their own PDF, available in any status. */
export function ownSubmissionFileUrl(id: number) {
  return `/api/v1/me/submissions/${id}/file`;
}

/**
 * The submission to show in the viewer: the requested one if it is published,
 * otherwise the first published one. Unpublished submissions are never viewable.
 */
export function pickSubmission(
  submissions: Submission[],
  requestedId: string | null,
): Submission | null {
  const published = submissions.filter((s) => s.status === "published");
  return (
    published.find((s) => String(s.id) === requestedId) ?? published[0] ?? null
  );
}

/** e.g. "Section 5A · Batch 61", or null when the uploader gave neither. */
export function paperDetails({
  section,
  batch,
}: {
  section: string | null;
  batch: string | null;
}) {
  const parts = [
    section && `Section ${section}`,
    batch && `Batch ${batch}`,
  ].filter(Boolean);
  return parts.length > 0 ? parts.join(" · ") : null;
}

/**
 * How to tell the papers of one question apart: by section and batch when given,
 * otherwise by who uploaded them, and only then by number ("Paper 2").
 */
export function paperTitle(
  submission: Pick<Submission, "section" | "batch" | "uploader">,
  index: number,
) {
  return (
    paperDetails(submission) ??
    (submission.uploader
      ? `By ${submission.uploader.name}`
      : `Paper ${index + 1}`)
  );
}

/**
 * Titles for a question's published papers (in list order) that tell them apart:
 * two "Batch 65" papers become "Batch 65 · Jane" and "Batch 65 · Sam", and any
 * that still clash are numbered.
 */
export function paperTitles(
  published: Pick<Submission, "id" | "section" | "batch" | "uploader">[],
): Map<number, string> {
  const countOf = (titles: string[]) => {
    const counts = new Map<string, number>();
    for (const title of titles) counts.set(title, (counts.get(title) ?? 0) + 1);
    return counts;
  };

  const base = published.map((s, i) => paperTitle(s, i));
  const baseCounts = countOf(base);
  const named = published.map((s, i) =>
    baseCounts.get(base[i]!)! > 1 && paperDetails(s) && s.uploader
      ? `${base[i]} · ${s.uploader.name}`
      : base[i]!,
  );

  const namedCounts = countOf(named);
  const seen = new Map<string, number>();
  return new Map(
    published.map((s, i) => {
      const title = named[i]!;
      if (namedCounts.get(title)! === 1) return [s.id, title];
      const n = (seen.get(title) ?? 0) + 1;
      seen.set(title, n);
      return [s.id, `${title} (${n})`];
    }),
  );
}

/** e.g. "1 paper", "1,586 questions". */
export function plural(count: number, singular: string, pluralForm?: string) {
  return `${formatNumber(count)} ${count === 1 ? singular : (pluralForm ?? `${singular}s`)}`;
}

/** Whether a submission still proposes new catalog entries. */
export function proposesNewEntries({
  department,
  course,
  semester,
}: SubmissionClassification) {
  return department.id === null || course.id === null || semester.id === null;
}

/** e.g. "CSE · 2nd Semester · Final" */
export function classificationLine({
  department,
  semester,
  examType,
}: SubmissionClassification) {
  return `${department.shortName ?? department.name} · ${semester.name} · ${examType.name}`;
}

/** Where a submission can be opened publicly, or null while it isn't published. */
export function publicUrl(submission: ContributorSubmission) {
  return submission.status === "published" && submission.questionId !== null
    ? `/questions/${submission.questionId}?submission=${encodeURIComponent(submission.id)}`
    : null;
}

/** A contributor's public page, by username. */
export function contributorUrl(username: string) {
  return `/questions/contributors/${encodeURIComponent(username)}`;
}
