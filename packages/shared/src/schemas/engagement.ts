import { z } from "zod";
import {
  MAX_REPORT_DETAILS_LENGTH,
  REPORT_REASONS,
  REPORT_STATUSES,
} from "../constants";
import { nullableRef } from "./common";
import { submissionStatsSchema } from "./question";

/**
 * 1 = like, -1 = dislike. The document's `enum` is spelled out: generated from the
 * literals it keeps only the first value.
 */
export const voteValueSchema = z
  .literal([1, -1])
  .meta({ id: "VoteValue", type: "integer", enum: [1, -1] });
export type VoteValue = z.infer<typeof voteValueSchema>;

export const castVoteInputSchema = z
  .object({ value: voteValueSchema })
  .meta({ id: "CastVoteInput" });
export type CastVoteInput = z.infer<typeof castVoteInputSchema>;

/** A submission's counters after a vote change, plus the caller's current vote. */
export const voteResultSchema = submissionStatsSchema
  .extend({
    myVote: nullableRef(voteValueSchema),
  })
  .meta({ id: "VoteResult" });
export type VoteResult = z.infer<typeof voteResultSchema>;

export const reportReasonSchema = z
  .enum(REPORT_REASONS)
  .meta({ id: "ReportReason" });
export type ReportReason = z.infer<typeof reportReasonSchema>;
export const reportStatusSchema = z
  .enum(REPORT_STATUSES)
  .meta({ id: "ReportStatus" });
export type ReportStatus = z.infer<typeof reportStatusSchema>;

export const createReportInputSchema = z
  .object({
    reason: reportReasonSchema,
    details: z.string().trim().max(MAX_REPORT_DETAILS_LENGTH).optional(),
  })
  .refine((value) => value.reason !== "other" || Boolean(value.details), {
    path: ["details"],
    message: "Describe the problem",
  })
  .meta({ id: "CreateReportInput" });
export type CreateReportInput = z.infer<typeof createReportInputSchema>;

export const createdReportSchema = z
  .object({
    id: z.number().int(),
    status: reportStatusSchema,
    /** True when this report pushed the paper over the threshold and it is now hidden. */
    submissionHidden: z.boolean(),
  })
  .meta({ id: "CreatedReport" });
export type CreatedReport = z.infer<typeof createdReportSchema>;

/** The signed-in user's votes and open reports on one question's submissions. */
export const questionInteractionsSchema = z
  .object({
    userId: z.string(),
    votes: z.array(
      z
        .object({ submissionId: z.number().int(), value: voteValueSchema })
        .meta({ id: "QuestionVote" }),
    ),
    reportedSubmissionIds: z.array(z.number().int()),
    /** Whether the user saved (bookmarked) the question. */
    saved: z.boolean(),
  })
  .meta({ id: "QuestionInteractions" });
export type QuestionInteractions = z.infer<typeof questionInteractionsSchema>;

export const avatarSchema = z
  .object({
    /** Public URL of the uploaded image, on the files domain (the API's in local dev). */
    image: z.string(),
  })
  .meta({ id: "Avatar" });
export type Avatar = z.infer<typeof avatarSchema>;
