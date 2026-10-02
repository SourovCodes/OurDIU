import { SUBMISSION_STATUSES, WATERMARK_STATUSES } from "@ourdiu/shared";
import { sql } from "drizzle-orm";
import {
  check,
  foreignKey,
  index,
  integer,
  sqliteTable,
  text,
  unique,
} from "drizzle-orm/sqlite-core";
import { user } from "./auth";
import { timestamps } from "./columns";
import { courses, departments, examTypes, semesters } from "./taxonomy";

/** A question is one department + course + semester + exam type combination. */
export const questions = sqliteTable(
  "questions",
  {
    id: integer().primaryKey({ autoIncrement: true }),
    departmentId: integer()
      .notNull()
      .references(() => departments.id),
    courseId: integer().notNull(),
    semesterId: integer()
      .notNull()
      .references(() => semesters.id),
    examTypeId: integer()
      .notNull()
      .references(() => examTypes.id),
    /** Question page views. Incremented directly, anyone can count a view. */
    viewCount: integer().notNull().default(0),

    // Denormalised from this question's submissions by triggers (migration 0006), so
    // lists don't aggregate the submissions table; never write them from application code.
    publishedCount: integer().notNull().default(0),
    pendingReviewCount: integer().notNull().default(0),
    rejectedCount: integer().notNull().default(0),
    /** created_at of the newest published submission; null while none is published. */
    latestPublishedAt: integer({ mode: "timestamp_ms" }),
    ...timestamps,
  },
  (t) => [
    // (course_id, department_id) must exist in courses, so the department always
    // matches the course's department.
    foreignKey({
      name: "questions_course_department_fk",
      columns: [t.courseId, t.departmentId],
      foreignColumns: [courses.id, courses.departmentId],
    }),
    // department_id is implied by the course, so the course identifies the combination.
    unique("questions_course_semester_exam_type_unique").on(
      t.courseId,
      t.semesterId,
      t.examTypeId,
    ),
    // Public lists: questions with a published paper, newest or most viewed first,
    // optionally in one department (these also serve lookups by department).
    index("questions_latest_published_at_idx").on(t.latestPublishedAt),
    index("questions_view_count_idx").on(t.viewCount),
    index("questions_department_id_latest_published_at_idx").on(
      t.departmentId,
      t.latestPublishedAt,
    ),
    index("questions_department_id_view_count_idx").on(
      t.departmentId,
      t.viewCount,
    ),
    index("questions_semester_id_idx").on(t.semesterId),
    index("questions_exam_type_id_idx").on(t.examTypeId),
  ],
);

/**
 * An uploaded PDF. Only `published` submissions are public.
 *
 * A submission is either linked to a question (`question_id`), or — when the uploader
 * proposed a new department, course or semester — carries the proposed classification
 * in the other columns until an admin creates the missing values and links a question.
 * The CHECK constraint enforces exactly one of these shapes.
 */
export const submissions = sqliteTable(
  "submissions",
  {
    id: integer().primaryKey({ autoIncrement: true }),
    questionId: integer().references(() => questions.id),

    // Proposed classification (only while question_id is null). For each of
    // department, course and semester: an existing id or a new name, never both.
    departmentId: integer().references(() => departments.id),
    customDepartmentName: text(),
    customDepartmentShortName: text(),
    courseId: integer().references(() => courses.id),
    customCourseName: text(),
    semesterId: integer().references(() => semesters.id),
    customSemesterName: text(),
    examTypeId: integer().references(() => examTypes.id),

    /** Optional details that tell papers of the same question apart, e.g. "5A", "61". */
    section: text(),
    batch: text(),

    status: text({ enum: SUBMISSION_STATUSES })
      .notNull()
      .default("pending_review"),
    /**
     * Set when the AI check published the paper without an admin; cleared when an
     * admin changes the status.
     */
    autoPublishedAt: integer({ mode: "timestamp_ms" }),
    /** Why an admin rejected it, shown to the uploader; null unless rejected. */
    rejectionReason: text(),
    /** R2 object key of the PDF. */
    fileKey: text().notNull().unique(),
    fileSize: integer().notNull(),
    /**
     * The public copy: the PDF with a credit line on every page, compressed. Made
     * in the background when the paper is published; the original is kept as is.
     */
    watermarkedFileKey: text().unique(),
    watermarkedFileSize: integer(),
    watermarkStatus: text({ enum: WATERMARK_STATUSES }),
    watermarkError: text(),
    uploaderId: text().references(() => user.id, { onDelete: "set null" }),

    // Denormalised counters. Likes, dislikes and pending reports are maintained by
    // triggers on submission_votes / submission_reports (migration 0001); never write
    // them from application code.
    likeCount: integer().notNull().default(0),
    dislikeCount: integer().notNull().default(0),
    pendingReportCount: integer().notNull().default(0),
    /** Paper views. Incremented directly, anyone can count a view. */
    viewCount: integer().notNull().default(0),
    /**
     * Review conversation entries the other side hasn't seen yet (submission_messages):
     * written by admins for the uploader, and by the uploader for admins. Zeroed when
     * that side opens the paper.
     */
    uploaderUnread: integer().notNull().default(0),
    adminUnread: integer().notNull().default(0),
    ...timestamps,
  },
  (t) => [
    // A proposed existing course must belong to the proposed existing department.
    foreignKey({
      name: "submissions_course_department_fk",
      columns: [t.courseId, t.departmentId],
      foreignColumns: [courses.id, courses.departmentId],
    }),
    check(
      "submissions_classification_check",
      sql.raw(`(
        question_id IS NOT NULL
        AND department_id IS NULL AND custom_department_name IS NULL AND custom_department_short_name IS NULL
        AND course_id IS NULL AND custom_course_name IS NULL
        AND semester_id IS NULL AND custom_semester_name IS NULL
        AND exam_type_id IS NULL
      ) OR (
        question_id IS NULL
        AND exam_type_id IS NOT NULL
        AND (department_id IS NULL) <> (custom_department_name IS NULL)
        AND (course_id IS NULL) <> (custom_course_name IS NULL)
        AND (semester_id IS NULL) <> (custom_semester_name IS NULL)
        AND (custom_department_short_name IS NULL OR custom_department_name IS NOT NULL)
        AND (course_id IS NULL OR department_id IS NOT NULL)
      )`),
    ),
    // Covers the question counter triggers (count and newest published per status).
    index("submissions_question_id_status_created_at_idx").on(
      t.questionId,
      t.status,
      t.createdAt,
    ),
    index("submissions_uploader_id_idx").on(t.uploaderId),
    // The admin catalog counts submissions per department, course, semester and exam type.
    index("submissions_department_id_idx").on(t.departmentId),
    index("submissions_course_id_idx").on(t.courseId),
    index("submissions_semester_id_idx").on(t.semesterId),
    index("submissions_exam_type_id_idx").on(t.examTypeId),
  ],
);

export type QuestionRow = typeof questions.$inferSelect;
export type NewQuestionRow = typeof questions.$inferInsert;
export type SubmissionRow = typeof submissions.$inferSelect;
export type NewSubmissionRow = typeof submissions.$inferInsert;
