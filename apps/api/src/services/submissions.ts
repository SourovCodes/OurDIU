import {
  MAX_SUBMISSION_FILE_BYTES,
  type CreatedSubmission,
  type SubmissionFields,
} from "@ourdiu/shared";
import { and, eq, or, sql } from "drizzle-orm";
import type { SQLiteColumn } from "drizzle-orm/sqlite-core";
import type { Database } from "../db/client";
import {
  courses,
  departments,
  examTypes,
  questions,
  semesters,
  submissions,
} from "../db/schema";
import { AppError } from "../lib/errors";
import { enqueueAnalysis, type AnalysisJob } from "./analysis";

const PDF_MAGIC_BYTES = [0x25, 0x50, 0x44, 0x46, 0x2d]; // "%PDF-"

export async function assertIsPdf(file: File) {
  if (file.size === 0 || file.size > MAX_SUBMISSION_FILE_BYTES) {
    throw new AppError(
      400,
      "INVALID_FILE",
      `The PDF must be smaller than ${MAX_SUBMISSION_FILE_BYTES / 1024 / 1024} MB`,
    );
  }
  const header = new Uint8Array(
    await file.slice(0, PDF_MAGIC_BYTES.length).arrayBuffer(),
  );
  if (!PDF_MAGIC_BYTES.every((byte, i) => header[i] === byte)) {
    throw new AppError(400, "INVALID_FILE", "The file must be a PDF");
  }
}

const nameMatches = (column: SQLiteColumn, name: string) =>
  sql`lower(${column}) = lower(${name})`;

/**
 * Replaces new names that match an existing value (ignoring case) with that value, so
 * typing "cse" or "data structures" files the paper under the existing entries.
 * Departments match by name or short name; courses only within the chosen department.
 */
export async function preferExistingValues(
  db: Database,
  input: SubmissionFields,
): Promise<SubmissionFields> {
  const fields = { ...input };

  if (fields.customDepartmentName) {
    const name = fields.customDepartmentName;
    const match = await db.query.departments.findFirst({
      columns: { id: true },
      where: or(
        nameMatches(departments.name, name),
        nameMatches(departments.shortName, name),
      ),
    });
    if (match) {
      fields.departmentId = match.id;
      delete fields.customDepartmentName;
      delete fields.customDepartmentShortName;
    }
  }

  if (fields.customCourseName && fields.departmentId) {
    const match = await db.query.courses.findFirst({
      columns: { id: true },
      where: and(
        eq(courses.departmentId, fields.departmentId),
        nameMatches(courses.name, fields.customCourseName),
      ),
    });
    if (match) {
      fields.courseId = match.id;
      delete fields.customCourseName;
    }
  }

  if (fields.customSemesterName) {
    const match = await db.query.semesters.findFirst({
      columns: { id: true },
      where: nameMatches(semesters.name, fields.customSemesterName),
    });
    if (match) {
      fields.semesterId = match.id;
      delete fields.customSemesterName;
    }
  }

  return fields;
}

/**
 * Checks that referenced ids exist and fit together. When every value is an existing
 * one, finds or creates the matching question and returns its id; otherwise null.
 */
export async function resolveQuestionId(
  db: Database,
  fields: SubmissionFields,
): Promise<number | null> {
  const [department, course, semester, examType] = await Promise.all([
    fields.departmentId
      ? db.query.departments.findFirst({
          where: eq(departments.id, fields.departmentId),
        })
      : undefined,
    fields.courseId
      ? db.query.courses.findFirst({ where: eq(courses.id, fields.courseId) })
      : undefined,
    fields.semesterId
      ? db.query.semesters.findFirst({
          where: eq(semesters.id, fields.semesterId),
        })
      : undefined,
    db.query.examTypes.findFirst({
      where: eq(examTypes.id, fields.examTypeId),
    }),
  ]);

  const issues: { path: string[]; message: string }[] = [];
  if (fields.departmentId && !department) {
    issues.push({ path: ["departmentId"], message: "Department not found" });
  }
  if (fields.courseId && !course) {
    issues.push({ path: ["courseId"], message: "Course not found" });
  } else if (course && department && course.departmentId !== department.id) {
    issues.push({
      path: ["courseId"],
      message: "This course doesn't belong to the selected department",
    });
  }
  if (fields.semesterId && !semester) {
    issues.push({ path: ["semesterId"], message: "Semester not found" });
  }
  if (!examType) {
    issues.push({ path: ["examTypeId"], message: "Exam type not found" });
  }
  if (issues.length > 0) {
    throw new AppError(
      422,
      "VALIDATION_ERROR",
      "Request validation failed",
      issues,
    );
  }

  if (!department || !course || !semester || !examType) return null;

  const combination = and(
    eq(questions.courseId, course.id),
    eq(questions.semesterId, semester.id),
    eq(questions.examTypeId, examType.id),
  );
  // Insert-or-ignore keeps concurrent uploads for the same combination safe.
  await db
    .insert(questions)
    .values({
      departmentId: department.id,
      courseId: course.id,
      semesterId: semester.id,
      examTypeId: examType.id,
    })
    .onConflictDoNothing();
  const question = await db.query.questions.findFirst({
    columns: { id: true },
    where: combination,
  });
  return question?.id ?? null;
}

/**
 * The classification columns of a submission: linked to its question, or carrying
 * the proposed values for admin review. Always sets every column, so it also clears
 * the other shape on update.
 */
export function classificationColumns(
  fields: SubmissionFields,
  questionId: number | null,
) {
  const proposal = questionId === null;
  return {
    questionId,
    departmentId: proposal ? (fields.departmentId ?? null) : null,
    customDepartmentName: proposal
      ? (fields.customDepartmentName ?? null)
      : null,
    customDepartmentShortName: proposal
      ? (fields.customDepartmentShortName ?? null)
      : null,
    courseId: proposal ? (fields.courseId ?? null) : null,
    customCourseName: proposal ? (fields.customCourseName ?? null) : null,
    semesterId: proposal ? (fields.semesterId ?? null) : null,
    customSemesterName: proposal ? (fields.customSemesterName ?? null) : null,
    examTypeId: proposal ? fields.examTypeId : null,
  };
}

/**
 * R2 key for an uploaded PDF. Named before the row exists (its id comes from the
 * insert), so not after the id; a replaced file gets a new key too.
 */
export const newSubmissionFileKey = () =>
  `submissions/${crypto.randomUUID()}.pdf`;

export async function createSubmission(
  db: Database,
  bucket: R2Bucket,
  queue: Queue<AnalysisJob>,
  params: { fields: SubmissionFields; file: File; uploaderId: string },
): Promise<CreatedSubmission> {
  const { file } = params;
  await assertIsPdf(file);
  const fields = await preferExistingValues(db, params.fields);
  const questionId = await resolveQuestionId(db, fields);

  const fileKey = newSubmissionFileKey();
  await bucket.put(fileKey, file, {
    httpMetadata: { contentType: "application/pdf" },
  });

  const classification = classificationColumns(fields, questionId);

  let created: CreatedSubmission;
  try {
    const [row] = await db
      .insert(submissions)
      .values({
        fileKey,
        fileSize: file.size,
        uploaderId: params.uploaderId,
        section: fields.section ?? null,
        batch: fields.batch ?? null,
        ...classification,
      })
      .returning({
        id: submissions.id,
        status: submissions.status,
        questionId: submissions.questionId,
      });
    created = row!;
  } catch (err) {
    // Don't leave an orphaned file behind if the insert fails.
    await bucket.delete(fileKey);
    throw err;
  }
  // The AI check runs in the background and publishes the paper if it confirms it.
  await enqueueAnalysis(db, queue, created.id, { autoPublish: true });
  return created;
}
