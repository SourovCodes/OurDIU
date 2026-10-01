import type {
  AnalysisFilter,
  AnalysisSummary,
  AnalysisValues,
  SubmissionClassification,
} from "@ourdiu/shared";
import { catalogKey } from "@ourdiu/shared/constants";

export const ANALYSIS_FILTER_LABELS: Record<AnalysisFilter, string> = {
  flagged: "Flagged by AI",
  differs: "AI disagrees",
};

/** Short label for an analysis at a glance, and whether it needs attention. */
export function analysisLabel(summary: AnalysisSummary): {
  label: string;
  tone: "muted" | "warning" | "ok";
} {
  switch (summary.status) {
    case "queued":
    case "processing":
      return { label: "AI checking", tone: "muted" };
    case "failed":
      return { label: "AI failed", tone: "warning" };
    case "completed":
      if (summary.flag === "not_a_paper") {
        return { label: "Not a paper", tone: "warning" };
      }
      if (summary.flag === "multiple_papers") {
        return { label: "Multiple papers", tone: "warning" };
      }
      return summary.matches
        ? { label: "AI agrees", tone: "ok" }
        : { label: "AI disagrees", tone: "warning" };
  }
}

type Named = { id: number | null; name: string } | null;

/** Same catalog entry, or the same name ignoring case and "&" vs "and". */
function sameValue(a: Named, b: Named) {
  if (!a || !b) return false;
  if (a.id !== null && b.id !== null) return a.id === b.id;
  return catalogKey(a.name) === catalogKey(b.name);
}

export type ComparisonRow = {
  label: string;
  submitted: string | null;
  ai: string | null;
  /** The AI's value isn't in the catalog yet. */
  aiIsNew: boolean;
  /** The AI read a value, and it isn't the submitted one. */
  differs: boolean;
  /**
   * Using the AI's details would change this field. Not for a new exam type: those
   * can't be proposed, so the submitted one is kept.
   */
  applies: boolean;
};

/** The submission's values next to the AI's, field by field. */
export function compareWithAnalysis(
  submission: {
    classification: SubmissionClassification;
    section: string | null;
    batch: string | null;
  },
  values: AnalysisValues,
): ComparisonRow[] {
  const { department, course, semester, examType } = submission.classification;
  const entry = (
    label: string,
    mine: Named,
    theirs: Named,
    isEntry = true,
  ): ComparisonRow => {
    const aiIsNew = isEntry && theirs !== null && theirs.id === null;
    const differs = theirs !== null && !sameValue(mine, theirs);
    return {
      label,
      submitted: mine?.name ?? null,
      ai: theirs?.name ?? null,
      aiIsNew,
      differs,
      applies: differs && !(label === "Exam type" && aiIsNew),
    };
  };
  const detail = (label: string, mine: string | null, theirs: string | null) =>
    entry(
      label,
      mine === null ? null : { id: null, name: mine },
      theirs === null ? null : { id: null, name: theirs },
      false,
    );

  return [
    entry("Department", department, values.department),
    entry("Course", course, values.course),
    entry("Semester", semester, values.semester),
    entry("Exam type", examType, values.examType),
    detail("Section", submission.section, values.section),
    detail("Batch", submission.batch, values.batch),
  ];
}

/**
 * The AI's values as a classification, to prefill the edit dialog. Values the AI
 * couldn't read keep the submission's; so does the exam type unless the AI matched an
 * existing one (new exam types can't be proposed).
 */
export function classificationFromAnalysis(
  current: SubmissionClassification,
  values: AnalysisValues,
): SubmissionClassification {
  return {
    department: values.department ?? current.department,
    course: values.course ?? current.course,
    semester: values.semester ?? current.semester,
    examType:
      values.examType?.id != null
        ? { id: values.examType.id, name: values.examType.name }
        : current.examType,
  };
}

/**
 * A classification as the fields of the upload form: an id for existing entries, a
 * name for new ones. Used to send the AI's reading as the uploader's own details.
 */
export function classificationFields(
  classification: SubmissionClassification,
  details: { section: string | null; batch: string | null },
): Record<string, string> {
  const { department, course, semester, examType } = classification;
  const fields: Record<string, string> = {
    examTypeId: String(examType.id),
  };
  if (department.id !== null) {
    fields.departmentId = String(department.id);
  } else {
    fields.customDepartmentName = department.name;
    if (department.shortName) {
      fields.customDepartmentShortName = department.shortName;
    }
  }
  if (course.id !== null) fields.courseId = String(course.id);
  else fields.customCourseName = course.name;
  if (semester.id !== null) fields.semesterId = String(semester.id);
  else fields.customSemesterName = semester.name;
  if (details.section) fields.section = details.section;
  if (details.batch) fields.batch = details.batch;
  return fields;
}
