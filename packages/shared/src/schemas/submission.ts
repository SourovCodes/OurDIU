import { z } from "zod";
import {
  normalizeCatalogName,
  parseSemesterName,
  SEMESTER_FORMAT_MESSAGE,
} from "../constants";
import { submissionStatusSchema } from "./question";
import { examTypeSchema, idQuerySchema } from "./taxonomy";

/** An optional short label; blank form fields count as not given. */
const optionalDetail = z
  .string()
  .trim()
  .max(10, "Must be at most 10 characters")
  .optional()
  .transform((value) => value || undefined);

/** A new catalog name, stored in its standard spelling ("and" instead of "&", …). */
const newName = z
  .string()
  .trim()
  .min(2, "Must be at least 2 characters")
  .max(100, "Must be at most 100 characters")
  .transform(normalizeCatalogName);

/** A semester name, stored in its standard spelling ("fall 2025" → "Fall 25"). */
export const semesterNameSchema = z
  .string()
  .trim()
  .transform((value, ctx) => {
    const name = parseSemesterName(value);
    if (name === null) {
      ctx.addIssue({ code: "custom", message: SEMESTER_FORMAT_MESSAGE });
      return z.NEVER;
    }
    return name;
  });

/**
 * Classification fields sent as multipart form data when contributing a paper.
 * Department, course and semester are each either an existing id or a new name
 * (reviewed by an admin); the exam type must be an existing one.
 */
export const submissionFieldsSchema = z.object({
  departmentId: idQuerySchema.optional(),
  customDepartmentName: newName.optional(),
  customDepartmentShortName: z
    .string()
    .trim()
    .min(2, "Must be at least 2 characters")
    .max(20, "Must be at most 20 characters")
    .optional(),
  courseId: idQuerySchema.optional(),
  customCourseName: newName.optional(),
  semesterId: idQuerySchema.optional(),
  customSemesterName: semesterNameSchema.optional(),
  examTypeId: z.coerce
    .number({ error: "Select an exam type" })
    .int()
    .positive("Select an exam type"),
  /** Optional, tells papers of the same question apart. */
  section: optionalDetail,
  batch: optionalDetail,
});
export type SubmissionFields = z.infer<typeof submissionFieldsSchema>;

const CHOICES = [
  ["departmentId", "customDepartmentName", "department"],
  ["courseId", "customCourseName", "course"],
  ["semesterId", "customSemesterName", "semester"],
] as const;

type IssueSink = {
  addIssue: (issue: {
    code: "custom";
    path: PropertyKey[];
    message: string;
  }) => void;
};

/** Cross-field rules. Kept separate so the API can apply them after adding `file`. */
export function refineSubmissionFields(
  value: SubmissionFields,
  ctx: IssueSink,
) {
  for (const [idKey, nameKey, label] of CHOICES) {
    const hasId = value[idKey] !== undefined;
    const hasName = value[nameKey] !== undefined;
    if (hasId === hasName) {
      ctx.addIssue({
        code: "custom",
        path: [idKey],
        message: hasId
          ? `Choose an existing ${label} or add a new one, not both`
          : `Select a ${label} or add a new one`,
      });
    }
  }
  if (
    value.customDepartmentShortName !== undefined &&
    value.customDepartmentName === undefined
  ) {
    ctx.addIssue({
      code: "custom",
      path: ["customDepartmentShortName"],
      message: "Only a new department needs a short name",
    });
  }
  // Only when the department is genuinely new (not already flagged above as ambiguous).
  if (
    value.customDepartmentName !== undefined &&
    value.departmentId === undefined &&
    value.courseId !== undefined
  ) {
    ctx.addIssue({
      code: "custom",
      path: ["courseId"],
      message: "A new department can only have a new course",
    });
  }
}

export const createSubmissionInputSchema = submissionFieldsSchema.superRefine(
  refineSubmissionFields,
);

export const createdSubmissionSchema = z
  .object({
    id: z.number().int(),
    status: submissionStatusSchema,
    /** Null when the submission uses new values that an admin still has to create. */
    questionId: z.number().int().nullable(),
  })
  .meta({ id: "CreatedSubmission" });
export type CreatedSubmission = z.infer<typeof createdSubmissionSchema>;

/**
 * What a submission was filed under. An `id` of null means a new value proposed by
 * the uploader that doesn't exist yet.
 */
const classifiedValueSchema = z
  .object({ id: z.number().int().nullable(), name: z.string() })
  .meta({ id: "ClassifiedValue" });

export const submissionClassificationSchema = z
  .object({
    department: classifiedValueSchema
      .extend({ shortName: z.string().nullable() })
      .meta({ id: "ClassifiedDepartment" }),
    course: classifiedValueSchema,
    semester: classifiedValueSchema,
    examType: examTypeSchema,
  })
  .meta({ id: "SubmissionClassification" });
export type SubmissionClassification = z.infer<
  typeof submissionClassificationSchema
>;
