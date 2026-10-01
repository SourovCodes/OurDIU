import { z } from "zod";
import { paginatedSchema, paginationQuerySchema } from "./common";
import { submissionStatsSchema, submissionStatusSchema } from "./question";
import { submissionClassificationSchema } from "./submission";
import { idQuerySchema } from "./taxonomy";

/**
 * A user with at least one published paper. Only public profile fields are exposed
 * (never the email address), and only published papers are counted.
 */
/** How many of a contributor's published papers belong to one department. */
export const contributorDepartmentSchema = z
  .object({
    id: z.number().int(),
    name: z.string(),
    shortName: z.string(),
    publishedCount: z.number().int(),
  })
  .meta({ id: "ContributorDepartment" });
export type ContributorDepartment = z.infer<typeof contributorDepartmentSchema>;

export const contributorSchema = z
  .object({
    id: z.string(),
    /** In their page's URL: /contributors/<username>. */
    username: z.string(),
    name: z.string(),
    image: z.string().nullable(),
    joinedAt: z.iso.datetime(),
    publishedCount: z.number().int(),
    /** Views of all their published papers. */
    viewCount: z.number().int(),
    /** Departments of their published papers, the most papers first. */
    departments: z.array(contributorDepartmentSchema),
  })
  .meta({ id: "Contributor" });
export type Contributor = z.infer<typeof contributorSchema>;

export const contributorSubmissionSchema = submissionStatsSchema
  .extend({
    id: z.number().int(),
    status: submissionStatusSchema,
    /** What this viewer downloads: the watermarked copy for the public, when ready. */
    fileSize: z.number().int(),
    createdAt: z.iso.datetime(),
    section: z.string().nullable(),
    batch: z.string().nullable(),
    /** Null while the submission proposes new values that aren't approved yet. */
    questionId: z.number().int().nullable(),
    classification: submissionClassificationSchema,
  })
  .meta({ id: "ContributorSubmission" });
export type ContributorSubmission = z.infer<typeof contributorSubmissionSchema>;

export const contributorDetailSchema = contributorSchema
  .extend({
    /** Published papers only, newest first, one page at a time. */
    submissions: paginatedSchema(contributorSubmissionSchema).meta({
      id: "ContributorSubmissionList",
    }),
  })
  .meta({ id: "ContributorDetail" });
export type ContributorDetail = z.infer<typeof contributorDetailSchema>;

export const listContributorsQuerySchema = paginationQuerySchema;

/** Pages through a contributor's papers, optionally of one department. */
export const contributorPapersQuerySchema = paginationQuerySchema.extend({
  pageSize: paginationQuerySchema.shape.pageSize.default(24),
  departmentId: idQuerySchema.optional(),
});
export type ContributorPapersQuery = z.infer<
  typeof contributorPapersQuerySchema
>;
export type ListContributorsQuery = z.infer<typeof listContributorsQuerySchema>;

export const contributorListSchema = paginatedSchema(contributorSchema).meta({
  id: "ContributorList",
});
export type ContributorList = z.infer<typeof contributorListSchema>;
