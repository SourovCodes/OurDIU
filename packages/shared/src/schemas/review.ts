import { z } from "zod";
import {
  MAX_REVIEW_MESSAGE_LENGTH,
  REVIEW_AUTHOR_ROLES,
  REVIEW_MESSAGE_KINDS,
} from "../constants";

export const reviewMessageKindSchema = z
  .enum(REVIEW_MESSAGE_KINDS)
  .meta({ id: "ReviewMessageKind" });
export type ReviewMessageKind = z.infer<typeof reviewMessageKindSchema>;

export const reviewAuthorRoleSchema = z
  .enum(REVIEW_AUTHOR_ROLES)
  .meta({ id: "ReviewAuthorRole" });
export type ReviewAuthorRole = z.infer<typeof reviewAuthorRoleSchema>;

/**
 * One entry of a submission's review conversation: a message, or a step of the review
 * (with the note that came with it, if any). Oldest first.
 */
export const reviewMessageSchema = z
  .object({
    id: z.number().int(),
    kind: reviewMessageKindSchema,
    /** The message, or the note with a step; null for a step without one. */
    body: z.string().nullable(),
    author: z
      .object({
        role: reviewAuthorRoleSchema,
        /**
         * Null when the account no longer exists, and for admins when the uploader is
         * reading: they see "Reviewer".
         */
        name: z.string().nullable(),
        image: z.string().nullable(),
      })
      .meta({ id: "ReviewAuthor" }),
    createdAt: z.iso.datetime(),
  })
  .meta({ id: "ReviewMessage" });
export type ReviewMessage = z.infer<typeof reviewMessageSchema>;

export const reviewMessageBodySchema = z
  .string()
  .trim()
  .min(1, "Write a message")
  .max(MAX_REVIEW_MESSAGE_LENGTH);

export const postReviewMessageInputSchema = z
  .object({ body: reviewMessageBodySchema })
  .meta({ id: "PostReviewMessageInput" });
export type PostReviewMessageInput = z.infer<
  typeof postReviewMessageInputSchema
>;

export const resubmitInputSchema = z
  .object({
    /** What the uploader changed, for the reviewer. */
    note: z.string().trim().max(MAX_REVIEW_MESSAGE_LENGTH).optional(),
  })
  .meta({ id: "ResubmitInput" });
export type ResubmitInput = z.infer<typeof resubmitInputSchema>;
