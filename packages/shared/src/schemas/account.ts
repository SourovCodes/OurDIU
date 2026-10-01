import { z } from "zod";
import { USERNAME_PATTERN, USERNAME_RULES } from "../constants";
import { analysisSummarySchema, submissionAnalysisSchema } from "./analysis";
import { nullableRef } from "./common";
import { contributorSubmissionSchema } from "./contributor";

/** One of the signed-in user's own submissions, with how its review is going. */
export const mySubmissionSchema = contributorSubmissionSchema
  .extend({
    /** Published by the AI check right after upload, not by an admin. */
    autoPublished: z.boolean(),
    /** The admin's reason; null unless rejected. */
    rejectionReason: z.string().nullable(),
    /** Null for papers that were never checked. */
    analysis: nullableRef(analysisSummarySchema),
  })
  .meta({ id: "MySubmission" });
export type MySubmission = z.infer<typeof mySubmissionSchema>;

/** The signed-in user's own submissions, in every status. */
export const mySubmissionListSchema = z
  .object({
    /** Published first (newest first), then pending review, then rejected. */
    items: z.array(mySubmissionSchema),
  })
  .meta({ id: "MySubmissionList" });
export type MySubmissionList = z.infer<typeof mySubmissionListSchema>;

/** What the uploader sees of the AI check: its verdict and what it read. */
export const uploaderAnalysisSchema = submissionAnalysisSchema
  .pick({
    status: true,
    requestedAt: true,
    completedAt: true,
    isQuestionPaper: true,
    paperCount: true,
    note: true,
    flag: true,
    values: true,
  })
  .meta({ id: "UploaderAnalysis" });
export type UploaderAnalysis = z.infer<typeof uploaderAnalysisSchema>;

export const mySubmissionDetailSchema = mySubmissionSchema
  .extend({
    analysisDetail: nullableRef(uploaderAnalysisSchema),
  })
  .meta({ id: "MySubmissionDetail" });
export type MySubmissionDetail = z.infer<typeof mySubmissionDetailSchema>;

/** A username as users type it: trimmed and lowercased before the rules apply. */
export const usernameSchema = z
  .string()
  .trim()
  .toLowerCase()
  .regex(USERNAME_PATTERN, `Use ${USERNAME_RULES}`);

export const updateUsernameInputSchema = z
  .object({ username: usernameSchema })
  .meta({ id: "UpdateUsernameInput" });
export type UpdateUsernameInput = z.infer<typeof updateUsernameInputSchema>;

/** The signed-in user, with the counts their contributor page shows. */
export const profileSchema = z
  .object({
    id: z.string(),
    name: z.string(),
    email: z.string(),
    /** In their contributor page's URL: /contributors/<username>. */
    username: z.string(),
    /** An avatar URL, relative (`/api/v1/avatars/…`) when it's stored by the API. */
    image: z.string().nullable(),
    publishedCount: z.number().int(),
    /** Views of all their published papers. */
    viewCount: z.number().int(),
    /** Whether they can contribute papers: a DIU address, or an admin. */
    canContribute: z.boolean(),
  })
  .meta({ id: "Profile" });
export type Profile = z.infer<typeof profileSchema>;
