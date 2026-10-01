import {
  catalogKey,
  MAX_SEMESTER_YEAR,
  MIN_SEMESTER_YEAR,
  normalizeCatalogName,
  parseSemesterName,
  SEMESTER_TERMS,
  type AnalysisFlag,
  type AnalysisValues,
  type Course,
  type Department,
  type ExamType,
  type Semester,
  type SubmissionAnalysis,
} from "@ourdiu/shared";
import { and, eq, isNull } from "drizzle-orm";
import { z } from "zod";
import { createDb, type Database } from "../db/client";
import {
  courses,
  departments,
  examTypes,
  questions,
  semesters,
  submissionAnalyses,
  submissions,
  type SubmissionAnalysisRow,
} from "../db/schema";
import { AppError } from "../lib/errors";
import { GeminiError, generateJsonFromPdf } from "../lib/gemini";
import { compressPdf, type Fetcher } from "../lib/pdf-processor";
import {
  listCourses,
  listDepartments,
  listExamTypes,
  listSemesters,
} from "./taxonomy";
import { watermarkIfMissing, type WatermarkJob } from "./watermark";

/** The queue message. A message whose run was superseded by a re-run is ignored. */
export type AnalysisJob = { submissionId: number; runId: string };

/** First delivery plus `max_retries` (3) of the consumer in wrangler.jsonc. */
export const ANALYSIS_MAX_ATTEMPTS = 4;

/** Section and batch are short labels (see `submissionFieldsSchema`). */
const MAX_DETAIL_LENGTH = 10;

// ── Catalog and prompt ───────────────────────────────────────────────────────

export type Catalog = {
  departments: Department[];
  courses: Course[];
  semesters: Semester[];
  examTypes: ExamType[];
};

export async function loadCatalog(db: Database): Promise<Catalog> {
  const [departments, courses, semesters, examTypes] = await Promise.all([
    listDepartments(db),
    listCourses(db),
    listSemesters(db),
    listExamTypes(db),
  ]);
  return { departments, courses, semesters, examTypes };
}

export function buildPrompt(catalog: Catalog): string {
  const existing = {
    departments: catalog.departments.map((d) => ({
      id: d.id,
      name: d.name,
      shortName: d.shortName,
      courses: catalog.courses
        .filter((c) => c.departmentId === d.id)
        .map((c) => ({ id: c.id, name: c.name })),
    })),
    semesters: catalog.semesters.map(({ id, name }) => ({ id, name })),
    examTypes: catalog.examTypes.map(({ id, name }) => ({ id, name })),
  };

  return `You review PDFs uploaded to a university question bank. Each accepted upload must be exactly one exam question paper.

Answer these questions about the attached PDF:

1. isQuestionPaper: is this an exam question paper (questions set for an exam)? Answer sheets, solutions, notes, slides, syllabi, assignments, blank or unreadable files and anything else are not.
2. paperCount: how many distinct question papers does the file contain? Different courses, exam types or semesters in one file are separate papers, as are several copies of the same paper. Pages of a single paper count as one. Use 0 if it isn't a question paper.
3. note: one or two short sentences explaining your answers to 1 and 2.

Then read the paper's header (usually at the top of the first page) and extract:

- department: the department that set the exam. Always give the full name, never an abbreviation (e.g. "Computer Science and Engineering", not "CSE"). If only an abbreviation is printed, expand it, using the existing departments' short names when one matches. shortName is the abbreviation if known.
- course: the course title only, without the course code (e.g. "Data Structures", not "CSE 134: Data Structures").
- semester: the academic term the exam was held in, written exactly as a term and a two-digit year: "<Term> <YY>", where Term is one of ${SEMESTER_TERMS.join(", ")} and YY is ${MIN_SEMESTER_YEAR} to ${MAX_SEMESTER_YEAR} (e.g. "Fall 25" for Fall 2025, "Spring 26", "Short 20"). Use null if the paper doesn't show a term in this form.
- examType: the kind of exam (e.g. midterm, final).
- section and batch: only if printed on the paper (short labels such as "A" or "61"), otherwise null.

Matching and spelling rules:

- Prefer existing entries. If a value is the same as an existing entry below (ignoring case, abbreviations, word order, "&" versus "and", minor spelling differences), set existingId to that entry's id and name to its exact existing name. Courses must belong to the chosen department.
- Otherwise set existingId to null and give a new name in the same style as the existing entries: Title Case, "and" instead of "&", no abbreviations, no trailing punctuation. Semesters always use the "<Term> <YY>" format above.
- The exam type should be one of the existing exam types whenever possible.
- Use null for any value you can't find in the document. Never guess from the file name.

Existing entries (JSON):
${JSON.stringify(existing)}`;
}

const nullableString = { type: ["string", "null"] };
const nullableId = {
  type: ["integer", "null"],
  description: "id of the matching existing entry, or null if it's new",
};
const value = (description: string, extra: Record<string, object> = {}) => ({
  description,
  anyOf: [
    {
      type: "object",
      properties: {
        existingId: nullableId,
        name: { type: "string" },
        ...extra,
      },
      required: ["existingId", "name", ...Object.keys(extra)],
    },
    { type: "null" },
  ],
});

/** Constrains Gemini's JSON answer; `analysisReplySchema` validates it. */
export const analysisResponseJsonSchema = {
  type: "object",
  properties: {
    isQuestionPaper: { type: "boolean" },
    paperCount: { type: "integer", minimum: 0 },
    note: { type: "string" },
    department: value("Department, full name", { shortName: nullableString }),
    course: value("Course title without the course code"),
    semester: value('Academic term as "<Term> <YY>", e.g. Fall 25'),
    examType: value("Exam type"),
    section: nullableString,
    batch: nullableString,
  },
  required: [
    "isQuestionPaper",
    "paperCount",
    "note",
    "department",
    "course",
    "semester",
    "examType",
    "section",
    "batch",
  ],
};

const replyValue = z
  .object({ existingId: z.number().int().nullable(), name: z.string() })
  .nullable();

export const analysisReplySchema = z.object({
  isQuestionPaper: z.boolean(),
  paperCount: z.number().int().min(0),
  note: z.string(),
  department: z
    .object({
      existingId: z.number().int().nullable(),
      name: z.string(),
      shortName: z.string().nullable(),
    })
    .nullable(),
  course: replyValue,
  semester: replyValue,
  examType: replyValue,
  section: z.string().nullable(),
  batch: z.string().nullable(),
});
export type AnalysisReply = z.infer<typeof analysisReplySchema>;

// ── Matching ─────────────────────────────────────────────────────────────────

const cleanName = (name: string | undefined | null) => {
  const normalized = name ? normalizeCatalogName(name) : "";
  return normalized.length > 0 ? normalized : null;
};

const cleanDetail = (detail: string | null) => {
  const trimmed = detail?.trim();
  return trimmed && trimmed.length <= MAX_DETAIL_LENGTH ? trimmed : null;
};

/** An existing entry by the id the AI gave, else by name (standard spelling, any case). */
function findEntry<T extends { id: number; name: string }>(
  entries: T[],
  id: number | null,
  name: string,
): T | undefined {
  return (
    entries.find((entry) => entry.id === id) ??
    entries.find((entry) => catalogKey(entry.name) === catalogKey(name))
  );
}

/**
 * Checks the AI's answer against the catalog: ids it gave must exist (and a course
 * must belong to the department), names are matched like uploads are, and new names
 * get the standard spelling.
 */
export function matchToCatalog(
  reply: AnalysisReply,
  catalog: Catalog,
): AnalysisValues {
  let department: AnalysisValues["department"] = null;
  const departmentName = cleanName(reply.department?.name);
  if (reply.department && departmentName) {
    const shortName = cleanName(reply.department.shortName);
    const match =
      findEntry(
        catalog.departments,
        reply.department.existingId,
        departmentName,
      ) ??
      catalog.departments.find((d) =>
        [departmentName, shortName].some(
          (name) =>
            name !== null && catalogKey(d.shortName) === catalogKey(name),
        ),
      );
    department = match
      ? { id: match.id, name: match.name, shortName: match.shortName }
      : { id: null, name: departmentName, shortName };
  }

  const pick = <T extends { id: number; name: string }>(
    entries: T[],
    value: { existingId: number | null; name: string } | null,
  ) => {
    const name = cleanName(value?.name);
    if (!value || !name) return null;
    const match = findEntry(entries, value.existingId, name);
    return match ? { id: match.id, name: match.name } : { id: null, name };
  };

  // Courses only match within the department, so a new department has new courses.
  const departmentCourses =
    department?.id != null
      ? catalog.courses.filter((c) => c.departmentId === department.id)
      : [];

  return {
    department,
    course: pick(departmentCourses, reply.course),
    semester: pickSemester(catalog.semesters, reply.semester),
    examType: pick(catalog.examTypes, reply.examType),
    section: cleanDetail(reply.section),
    batch: cleanDetail(reply.batch),
  };
}

/**
 * An existing semester, or a new name in the semester format ("fall 2025" becomes
 * "Fall 25"); anything else counts as not found.
 */
function pickSemester(
  semesters: Semester[],
  value: { existingId: number | null; name: string } | null,
): { id: number | null; name: string } | null {
  if (!value) return null;
  const name = parseSemesterName(value.name);
  const match =
    semesters.find((s) => s.id === value.existingId) ??
    (name ? semesters.find((s) => s.name === name) : undefined);
  if (match) return { id: match.id, name: match.name };
  return name ? { id: null, name } : null;
}

// ── Rows ─────────────────────────────────────────────────────────────────────

export function analysisFlag(row: {
  isQuestionPaper: boolean | null;
  paperCount: number | null;
}): AnalysisFlag | null {
  if (row.isQuestionPaper === false) return "not_a_paper";
  if (row.paperCount !== null && row.paperCount > 1) return "multiple_papers";
  return null;
}

function analysisValues(row: SubmissionAnalysisRow): AnalysisValues {
  const entry = (id: number | null, name: string | null) =>
    name === null ? null : { id, name };
  return {
    department:
      row.departmentName === null
        ? null
        : {
            id: row.departmentId,
            name: row.departmentName,
            shortName: row.departmentShortName,
          },
    course: entry(row.courseId, row.courseName),
    semester: entry(row.semesterId, row.semesterName),
    examType: entry(row.examTypeId, row.examTypeName),
    section: row.section,
    batch: row.batch,
  };
}

export function toSubmissionAnalysis(
  row: SubmissionAnalysisRow,
): SubmissionAnalysis {
  const completed = row.status === "completed";
  return {
    status: row.status,
    error: row.error,
    model: row.model,
    requestedAt: row.createdAt.toISOString(),
    completedAt: row.completedAt?.toISOString() ?? null,
    isQuestionPaper: completed ? row.isQuestionPaper : null,
    paperCount: completed ? row.paperCount : null,
    note: completed ? row.note : null,
    flag: completed ? analysisFlag(row) : null,
    values: completed ? analysisValues(row) : null,
    originalBytes: row.originalBytes,
    sentBytes: row.sentBytes,
  };
}

export async function getSubmissionAnalysis(
  db: Database,
  submissionId: number,
): Promise<SubmissionAnalysis | null> {
  const row = await db.query.submissionAnalyses.findFirst({
    where: eq(submissionAnalyses.submissionId, submissionId),
  });
  return row ? toSubmissionAnalysis(row) : null;
}

/** Every result column, cleared when a new run starts. */
const clearedResult = {
  status: "queued",
  error: null,
  model: null,
  originalBytes: null,
  sentBytes: null,
  isQuestionPaper: null,
  paperCount: null,
  note: null,
  departmentId: null,
  departmentName: null,
  departmentShortName: null,
  courseId: null,
  courseName: null,
  semesterId: null,
  semesterName: null,
  examTypeId: null,
  examTypeName: null,
  section: null,
  batch: null,
  rawResponse: null,
  completedAt: null,
} as const;

// ── Running ──────────────────────────────────────────────────────────────────

/**
 * Starts a new analysis run for a submission (replacing any earlier result) and
 * queues it. Never throws for queue failures: the run is marked failed so an admin
 * can re-run it, and the upload that triggered it still succeeds.
 */
export async function enqueueAnalysis(
  db: Database,
  queue: Queue<AnalysisJob>,
  submissionId: number,
  { autoPublish }: { autoPublish: boolean },
): Promise<SubmissionAnalysis> {
  const runId = crypto.randomUUID();
  const now = new Date();
  await db
    .insert(submissionAnalyses)
    .values({ submissionId, runId, autoPublish, ...clearedResult })
    .onConflictDoUpdate({
      target: submissionAnalyses.submissionId,
      set: {
        runId,
        autoPublish,
        ...clearedResult,
        attempts: 0,
        createdAt: now,
      },
    });
  try {
    await queue.send({ submissionId, runId });
  } catch (err) {
    console.error("Couldn't queue the analysis", err);
    await db
      .update(submissionAnalyses)
      .set({ status: "failed", error: "Couldn't queue the analysis" })
      .where(eq(submissionAnalyses.submissionId, submissionId));
  }
  return (await getSubmissionAnalysis(db, submissionId))!;
}

/** Re-runs the analysis of a submission in any status (admin action). */
export async function rerunAnalysis(
  db: Database,
  queue: Queue<AnalysisJob>,
  submissionId: number,
): Promise<SubmissionAnalysis> {
  const submission = await db.query.submissions.findFirst({
    columns: { id: true },
    where: eq(submissions.id, submissionId),
  });
  if (!submission) {
    throw new AppError(404, "NOT_FOUND", "Submission not found");
  }
  // Re-runs only inform the admin; they never publish.
  return enqueueAnalysis(db, queue, submissionId, { autoPublish: false });
}

/** Most papers `checkUnchecked` queues per call: a few queries each, per request. */
export const CHECK_UNCHECKED_LIMIT = 100;

/**
 * Admin backfill: runs the upload check on pending papers that were never checked
 * (e.g. imported ones), publishing those it confirms, as after an upload. Queues at
 * most CHECK_UNCHECKED_LIMIT; returns how many were queued.
 */
export async function checkUnchecked(
  db: Database,
  queue: Queue<AnalysisJob>,
): Promise<number> {
  const rows = await db
    .select({ id: submissions.id })
    .from(submissions)
    .leftJoin(
      submissionAnalyses,
      eq(submissionAnalyses.submissionId, submissions.id),
    )
    .where(
      and(
        eq(submissions.status, "pending_review"),
        isNull(submissionAnalyses.submissionId),
      ),
    )
    .orderBy(submissions.id)
    .limit(CHECK_UNCHECKED_LIMIT);
  for (const { id } of rows) {
    await enqueueAnalysis(db, queue, id, { autoPublish: true });
  }
  return rows.length;
}

/** The bindings an analysis needs (vars widened to plain strings, for tests). */
export type AnalysisEnv = {
  BUCKET: R2Bucket;
  GEMINI_API_KEY: string;
  GEMINI_MODEL: string;
  COMPRESSOR_API_KEY: string;
  PDF_PROCESSOR_URL: string;
  WATERMARK_QUEUE: Queue<WatermarkJob>;
};

/**
 * Publishes a paper without an admin when the AI confirms it: exactly one question
 * paper, and the department, course, semester and exam type the AI read are the same
 * existing catalog entries (same id, same name, character for character) as the ones
 * the paper is filed under. Papers with new entries, reports or a status an admin
 * already changed are left for review. A published paper is queued for its
 * watermarked copy. Returns whether it published.
 */
export async function publishIfConfirmed(
  db: Database,
  watermarkQueue: Queue<WatermarkJob>,
  submissionId: number,
  reply: Pick<AnalysisReply, "isQuestionPaper" | "paperCount">,
  values: AnalysisValues,
): Promise<boolean> {
  if (!reply.isQuestionPaper || reply.paperCount !== 1) return false;

  const [filed] = await db
    .select({
      status: submissions.status,
      pendingReportCount: submissions.pendingReportCount,
      department: { id: departments.id, name: departments.name },
      course: { id: courses.id, name: courses.name },
      semester: { id: semesters.id, name: semesters.name },
      examType: { id: examTypes.id, name: examTypes.name },
    })
    .from(submissions)
    // Only papers filed under a question: every value already exists.
    .innerJoin(questions, eq(questions.id, submissions.questionId))
    .innerJoin(departments, eq(departments.id, questions.departmentId))
    .innerJoin(courses, eq(courses.id, questions.courseId))
    .innerJoin(semesters, eq(semesters.id, questions.semesterId))
    .innerJoin(examTypes, eq(examTypes.id, questions.examTypeId))
    .where(eq(submissions.id, submissionId));
  if (
    !filed ||
    filed.status !== "pending_review" ||
    filed.pendingReportCount > 0
  ) {
    return false;
  }

  const same = (
    ai: { id: number | null; name: string } | null,
    mine: { id: number; name: string },
  ) => ai !== null && ai.id === mine.id && ai.name === mine.name;
  if (
    !same(values.department, filed.department) ||
    !same(values.course, filed.course) ||
    !same(values.semester, filed.semester) ||
    !same(values.examType, filed.examType)
  ) {
    return false;
  }

  // Guarded by the status, in case an admin decided in the meantime.
  const published = await db
    .update(submissions)
    .set({ status: "published", autoPublishedAt: new Date() })
    .where(
      and(
        eq(submissions.id, submissionId),
        eq(submissions.status, "pending_review"),
      ),
    )
    .returning({ id: submissions.id });
  if (published.length === 0) return false;
  await watermarkIfMissing(db, watermarkQueue, submissionId);
  return true;
}

/** A failure that retrying won't fix. */
class PermanentError extends Error {}

/**
 * Runs one analysis: reads the PDF from R2, compresses it, asks Gemini in one call and
 * stores the answer matched against the catalog. Returns "retry" when a later attempt
 * might succeed; the run is marked failed after the last attempt.
 */
export async function runAnalysis(
  db: Database,
  env: AnalysisEnv,
  job: AnalysisJob,
  options: { attempt?: number; fetch?: Fetcher } = {},
): Promise<"done" | "retry"> {
  const attempt = options.attempt ?? 1;
  const thisRun = and(
    eq(submissionAnalyses.submissionId, job.submissionId),
    eq(submissionAnalyses.runId, job.runId),
  );
  const update = (values: Partial<typeof submissionAnalyses.$inferInsert>) =>
    db.update(submissionAnalyses).set(values).where(thisRun);

  const [row] = await db
    .select({
      fileKey: submissions.fileKey,
      autoPublish: submissionAnalyses.autoPublish,
    })
    .from(submissionAnalyses)
    .innerJoin(submissions, eq(submissions.id, submissionAnalyses.submissionId))
    .where(thisRun);
  // Deleted, or superseded by a re-run.
  if (!row) return "done";

  await update({ status: "processing", error: null, attempts: attempt });
  try {
    if (!env.GEMINI_API_KEY) {
      throw new PermanentError(
        "AI analysis isn't configured (GEMINI_API_KEY is missing)",
      );
    }
    const object = await env.BUCKET.get(row.fileKey);
    if (!object) throw new PermanentError("The PDF is missing from storage");
    const original = new Uint8Array(await object.arrayBuffer());
    const compressed = env.COMPRESSOR_API_KEY
      ? await compressPdf(original, {
          url: env.PDF_PROCESSOR_URL,
          apiKey: env.COMPRESSOR_API_KEY,
          fetch: options.fetch,
        })
      : null;
    const pdf = compressed ?? original;

    const catalog = await loadCatalog(db);
    const { json, text } = await generateJsonFromPdf({
      apiKey: env.GEMINI_API_KEY,
      model: env.GEMINI_MODEL,
      pdf,
      prompt: buildPrompt(catalog),
      responseJsonSchema: analysisResponseJsonSchema,
      fetch: options.fetch,
    });
    const reply = analysisReplySchema.safeParse(json);
    if (!reply.success) {
      throw new GeminiError(
        "Gemini's answer doesn't have the expected shape",
        true,
      );
    }
    const values = matchToCatalog(reply.data, catalog);

    await update({
      status: "completed",
      error: null,
      model: env.GEMINI_MODEL,
      originalBytes: original.byteLength,
      sentBytes: pdf.byteLength,
      isQuestionPaper: reply.data.isQuestionPaper,
      paperCount: reply.data.paperCount,
      note: reply.data.note.trim() || null,
      departmentId: values.department?.id ?? null,
      departmentName: values.department?.name ?? null,
      departmentShortName: values.department?.shortName ?? null,
      courseId: values.course?.id ?? null,
      courseName: values.course?.name ?? null,
      semesterId: values.semester?.id ?? null,
      semesterName: values.semester?.name ?? null,
      examTypeId: values.examType?.id ?? null,
      examTypeName: values.examType?.name ?? null,
      section: values.section,
      batch: values.batch,
      rawResponse: text,
      completedAt: new Date(),
    });
    if (row.autoPublish) {
      await publishIfConfirmed(
        db,
        env.WATERMARK_QUEUE,
        job.submissionId,
        reply.data,
        values,
      );
    }
    return "done";
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    const retryable =
      !(err instanceof PermanentError) &&
      !(err instanceof GeminiError && !err.retryable);
    const final = !retryable || attempt >= ANALYSIS_MAX_ATTEMPTS;
    console.error(
      `Analysis of ${job.submissionId} failed (attempt ${attempt})`,
      err,
    );
    await update({
      status: final ? "failed" : "queued",
      error: final ? message : `Retrying after an error: ${message}`,
    });
    return final ? "done" : "retry";
  }
}

/** Queue consumer: one analysis per message. */
export async function handleAnalysisBatch(
  batch: MessageBatch<AnalysisJob>,
  env: Env,
) {
  // Per invocation, like the per-request context of the HTTP handler.
  const db = createDb(env.DB);
  for (const message of batch.messages) {
    const outcome = await runAnalysis(db, env, message.body, {
      attempt: message.attempts,
    });
    if (outcome === "retry") {
      message.retry({ delaySeconds: 30 * message.attempts });
    } else {
      message.ack();
    }
  }
}
