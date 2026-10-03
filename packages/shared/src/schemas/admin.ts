import { z } from "zod";
import {
  MAX_MERGE_ENTRIES,
  MAX_REVIEW_MESSAGE_LENGTH,
  normalizeCatalogName,
  USER_ROLES,
  WATERMARK_STATUSES,
} from "../constants";
import {
  analysisFilterSchema,
  analysisSummarySchema,
  submissionAnalysisSchema,
} from "./analysis";
import { nullableRef, paginatedSchema, paginationQuerySchema } from "./common";
import { contributorSubmissionSchema } from "./contributor";
import { reportReasonSchema, reportStatusSchema } from "./engagement";
import { reviewMessageSchema } from "./review";
import { submissionCountsSchema, submissionStatusSchema } from "./question";
import {
  refineSubmissionFields,
  semesterNameSchema,
  submissionClassificationSchema,
  submissionFieldsSchema,
} from "./submission";
import {
  courseSchema,
  departmentSchema,
  examTypeSchema,
  idQuerySchema,
  semesterSchema,
} from "./taxonomy";

// Contracts for the admin panel (/api/v1/admin/*). Unlike public responses, these
// include users' email addresses.

export const userRoleSchema = z.enum(USER_ROLES);
export type UserRole = z.infer<typeof userRoleSchema>;

/** A user as admins see them, with their email address. */
export const adminUserRefSchema = z.object({
  id: z.string(),
  username: z.string(),
  name: z.string(),
  email: z.string(),
  image: z.string().nullable(),
});
export type AdminUserRef = z.infer<typeof adminUserRefSchema>;

// ── Dashboard ────────────────────────────────────────────────────────────────

/** Submissions per status, as admins see them: with those waiting for changes. */
export const adminSubmissionCountsSchema = submissionCountsSchema.extend({
  changesRequested: z.number().int(),
});
export type AdminSubmissionCounts = z.infer<typeof adminSubmissionCountsSchema>;

export const adminStatsSchema = z.object({
  submissions: adminSubmissionCountsSchema.extend({
    /** Pending submissions that propose new catalog entries (no question yet). */
    awaitingClassification: z.number().int(),
  }),
  openReports: z.number().int(),
  questions: z.number().int(),
  users: z.number().int(),
  contributors: z.number().int(),
  /** Views of every paper, plus question page views. */
  views: z.number().int(),
  catalog: z.object({
    departments: z.number().int(),
    courses: z.number().int(),
    semesters: z.number().int(),
    examTypes: z.number().int(),
  }),
  /** Submissions per UTC day over the last 30 days, oldest first, gaps filled. */
  dailySubmissions: z.array(
    z.object({ date: z.iso.date(), count: z.number().int() }),
  ),
});
export type AdminStats = z.infer<typeof adminStatsSchema>;

// ── Submissions ──────────────────────────────────────────────────────────────

export const watermarkStatusSchema = z.enum(WATERMARK_STATUSES);
export type WatermarkStatus = z.infer<typeof watermarkStatusSchema>;

/** The watermarked copy that the public downloads (published papers). */
export const submissionWatermarkSchema = z.object({
  status: watermarkStatusSchema,
  /** Why the last attempt failed. */
  error: z.string().nullable(),
  /** Null until done. */
  fileSize: z.number().int().nullable(),
});
export type SubmissionWatermark = z.infer<typeof submissionWatermarkSchema>;

/** How many papers were queued for watermarking. */
export const watermarkQueuedSchema = z.object({ queued: z.number().int() });
export type WatermarkQueued = z.infer<typeof watermarkQueuedSchema>;

/** How many never-checked papers were queued for the AI check. */
export const checksQueuedSchema = z.object({ queued: z.number().int() });
export type ChecksQueued = z.infer<typeof checksQueuedSchema>;

export const adminSubmissionSchema = contributorSubmissionSchema.extend({
  /** Null when the uploader's account no longer exists. */
  uploader: adminUserRefSchema.nullable(),
  pendingReportCount: z.number().int(),
  updatedAt: z.iso.datetime(),
  /** Null for submissions that were never analysed. */
  analysis: nullableRef(analysisSummarySchema),
  /** Published by the AI check right after upload, not by an admin. */
  autoPublished: z.boolean(),
  /** Why it was rejected; null unless rejected. */
  rejectionReason: z.string().nullable(),
  /** Uploader messages and steps no admin has seen yet. */
  adminUnread: z.number().int(),
  /**
   * The public copy with a credit line. Null when it was never requested; until
   * it's done, the public gets the original.
   */
  watermark: submissionWatermarkSchema.nullable(),
});
export type AdminSubmission = z.infer<typeof adminSubmissionSchema>;

export const listAdminSubmissionsQuerySchema = paginationQuerySchema.extend({
  status: submissionStatusSchema.optional(),
  /** `flagged`: not a question paper or several papers; `differs`: AI disagrees. */
  ai: analysisFilterSchema.optional(),
});
export type ListAdminSubmissionsQuery = z.infer<
  typeof listAdminSubmissionsQuerySchema
>;

export const adminSubmissionListSchema = paginatedSchema(
  adminSubmissionSchema,
).extend({
  /** Per-status totals, independent of the status filter. */
  counts: adminSubmissionCountsSchema,
});
export type AdminSubmissionList = z.infer<typeof adminSubmissionListSchema>;

/** A report as listed on the submission it is about. */
export const adminSubmissionReportSchema = z.object({
  id: z.number().int(),
  reason: reportReasonSchema,
  details: z.string().nullable(),
  status: reportStatusSchema,
  createdAt: z.iso.datetime(),
  reporter: adminUserRefSchema,
});
export type AdminSubmissionReport = z.infer<typeof adminSubmissionReportSchema>;

export const adminSubmissionDetailSchema = adminSubmissionSchema.extend({
  /** Newest first. */
  reports: z.array(adminSubmissionReportSchema),
  analysisDetail: nullableRef(submissionAnalysisSchema),
  /** The review conversation, oldest first. Opening the paper marks it read. */
  messages: z.array(reviewMessageSchema),
});
export type AdminSubmissionDetail = z.infer<typeof adminSubmissionDetailSchema>;

export const updateSubmissionStatusInputSchema = z
  .object({
    status: submissionStatusSchema,
    /**
     * Shown to the uploader. Required when rejecting or asking for changes; with
     * another status, an optional note added to the conversation.
     */
    reason: z.string().trim().max(MAX_REVIEW_MESSAGE_LENGTH).optional(),
  })
  .refine((input) => input.status !== "rejected" || !!input.reason, {
    path: ["reason"],
    message: "Give a reason for rejecting",
  })
  .refine((input) => input.status !== "changes_requested" || !!input.reason, {
    path: ["reason"],
    message: "Say what the uploader should change",
  });
export type UpdateSubmissionStatusInput = z.infer<
  typeof updateSubmissionStatusInputSchema
>;

/**
 * Files a submission under a department, course, semester and exam type. New names
 * are created right away, so a new department needs its short name.
 */
export const classifySubmissionInputSchema = submissionFieldsSchema.superRefine(
  (value, ctx) => {
    refineSubmissionFields(value, ctx);
    if (
      value.customDepartmentName !== undefined &&
      value.customDepartmentShortName === undefined
    ) {
      ctx.addIssue({
        code: "custom",
        path: ["customDepartmentShortName"],
        message: "Add a short name for the new department",
      });
    }
  },
);
export type ClassifySubmissionInput = z.infer<
  typeof classifySubmissionInputSchema
>;

// ── Reports ──────────────────────────────────────────────────────────────────

export const adminReportSchema = adminSubmissionReportSchema.extend({
  updatedAt: z.iso.datetime(),
  submission: z.object({
    id: z.number().int(),
    status: submissionStatusSchema,
    questionId: z.number().int().nullable(),
    pendingReportCount: z.number().int(),
    classification: submissionClassificationSchema,
  }),
});
export type AdminReport = z.infer<typeof adminReportSchema>;

export const listAdminReportsQuerySchema = paginationQuerySchema.extend({
  status: reportStatusSchema.optional(),
});
export type ListAdminReportsQuery = z.infer<typeof listAdminReportsQuerySchema>;

export const reportCountsSchema = z.object({
  pending: z.number().int(),
  resolved: z.number().int(),
  dismissed: z.number().int(),
});
export type ReportCounts = z.infer<typeof reportCountsSchema>;

export const adminReportListSchema = paginatedSchema(adminReportSchema).extend({
  counts: reportCountsSchema,
});
export type AdminReportList = z.infer<typeof adminReportListSchema>;

export const updateReportStatusInputSchema = z.object({
  status: reportStatusSchema,
});
export type UpdateReportStatusInput = z.infer<
  typeof updateReportStatusInputSchema
>;

// ── Catalog (departments, courses, semesters, exam types) ────────────────────

const catalogName = z
  .string()
  .trim()
  .min(2, "Must be at least 2 characters")
  .max(100, "Must be at most 100 characters")
  .transform(normalizeCatalogName);
const shortName = z
  .string()
  .trim()
  .min(2, "Must be at least 2 characters")
  .max(20, "Must be at most 20 characters");

/** How often a catalog entry is used; entries in use can't be deleted. */
const usage = {
  questionCount: z.number().int(),
  /** Submissions that reference the entry directly (proposals awaiting review). */
  submissionCount: z.number().int(),
};

export const adminDepartmentSchema = departmentSchema.extend({
  ...usage,
  courseCount: z.number().int(),
});
export const adminCourseSchema = courseSchema.extend(usage);
export const adminSemesterSchema = semesterSchema.extend(usage);
export const adminExamTypeSchema = examTypeSchema.extend(usage);
export type AdminDepartment = z.infer<typeof adminDepartmentSchema>;
export type AdminCourse = z.infer<typeof adminCourseSchema>;
export type AdminSemester = z.infer<typeof adminSemesterSchema>;
export type AdminExamType = z.infer<typeof adminExamTypeSchema>;

export const adminCatalogSchema = z.object({
  departments: z.array(adminDepartmentSchema),
  courses: z.array(adminCourseSchema),
  semesters: z.array(adminSemesterSchema),
  examTypes: z.array(adminExamTypeSchema),
});
export type AdminCatalog = z.infer<typeof adminCatalogSchema>;

export const departmentInputSchema = z.object({ name: catalogName, shortName });
export type DepartmentInput = z.infer<typeof departmentInputSchema>;

export const createCourseInputSchema = z.object({
  name: catalogName,
  departmentId: idQuerySchema,
});
export type CreateCourseInput = z.infer<typeof createCourseInputSchema>;

/** Exam types and course renames only carry a name. */
export const nameInputSchema = z.object({ name: catalogName });
export type NameInput = z.infer<typeof nameInputSchema>;

/** Semesters carry a name in the semester format, e.g. "Fall 25". */
export const semesterInputSchema = z.object({ name: semesterNameSchema });

/**
 * Folds `mergeIds` into `keepId`: everything filed under them moves to it and they are
 * deleted. `dryRun` only reports what would happen (the merge dialog's preview).
 */
export const catalogMergeInputSchema = z
  .object({
    keepId: idQuerySchema,
    mergeIds: z
      .array(idQuerySchema)
      .min(1, "Pick at least one entry to merge")
      .max(MAX_MERGE_ENTRIES, `Merge at most ${MAX_MERGE_ENTRIES} at a time`),
    dryRun: z.boolean().optional().default(false),
  })
  .refine((d) => !d.mergeIds.includes(d.keepId), {
    message: "The kept entry can't also be merged away",
    path: ["mergeIds"],
  });
export type CatalogMergeInput = z.infer<typeof catalogMergeInputSchema>;

export const catalogMergeResultSchema = z.object({
  /** The entry everything moved to. */
  keep: z.object({ id: z.number().int(), name: z.string() }),
  /** Entries deleted, not counting courses combined in a department merge. */
  removed: z.number().int(),
  /** Questions (exams) filed under a removed entry, each moved or combined. */
  questionsMoved: z.number().int(),
  /** Of those, questions that became the same exam as another and were folded into it. */
  questionsCombined: z.number().int(),
  /** Papers of the moved questions. */
  papersMoved: z.number().int(),
  /** Papers awaiting review that propose a removed entry directly. */
  proposalsMoved: z.number().int(),
  /** Department merges: courses moved to the kept department as they are. */
  coursesMoved: z.number().int().optional(),
  /** Department merges: same-named courses combined into one. */
  coursesCombined: z
    .array(z.object({ keep: z.string(), removed: z.array(z.string()) }))
    .optional(),
});
export type CatalogMergeResult = z.infer<typeof catalogMergeResultSchema>;

// ── Users ────────────────────────────────────────────────────────────────────

export const adminUserSchema = adminUserRefSchema.extend({
  role: userRoleSchema,
  createdAt: z.iso.datetime(),
  submissionCounts: adminSubmissionCountsSchema,
});
export type AdminUser = z.infer<typeof adminUserSchema>;

export const listAdminUsersQuerySchema = paginationQuerySchema.extend({
  /** Matches name, username or email, ignoring case. */
  q: z.string().trim().max(100).optional(),
  role: userRoleSchema.optional(),
});
export type ListAdminUsersQuery = z.infer<typeof listAdminUsersQuerySchema>;

export const adminUserListSchema = paginatedSchema(adminUserSchema);
export type AdminUserList = z.infer<typeof adminUserListSchema>;

export const updateUserRoleInputSchema = z.object({ role: userRoleSchema });
export type UpdateUserRoleInput = z.infer<typeof updateUserRoleInputSchema>;
