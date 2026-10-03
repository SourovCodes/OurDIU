import { z } from "zod";
import {
  MAX_SEARCH_LENGTH,
  MIN_SEARCH_LENGTH,
  QUESTION_SORTS,
  SUBMISSION_STATUSES,
} from "../constants";
import { nullableRef, paginatedSchema, paginationQuerySchema } from "./common";
import {
  courseSchema,
  departmentSchema,
  examTypeSchema,
  idQuerySchema,
  semesterSchema,
} from "./taxonomy";

export const submissionStatusSchema = z
  .enum(SUBMISSION_STATUSES)
  .meta({ id: "SubmissionStatus" });
export type SubmissionStatus = z.infer<typeof submissionStatusSchema>;

/** Public identity of the user who uploaded a submission (never their email). */
export const uploaderSchema = z
  .object({
    id: z.string(),
    /** In their contributor page's URL. */
    username: z.string(),
    name: z.string(),
    /** Profile image URL, or null to show initials. */
    image: z.string().nullable(),
  })
  .meta({ id: "Uploader" });
export type Uploader = z.infer<typeof uploaderSchema>;

/** Engagement counters, maintained by the API (votes by database triggers). */
export const submissionStatsSchema = z.object({
  likeCount: z.number().int(),
  dislikeCount: z.number().int(),
  viewCount: z.number().int(),
});
export type SubmissionStats = z.infer<typeof submissionStatsSchema>;

/**
 * Public submission metadata. Every status is listed so visitors can see that a paper
 * is already under review, but only `published` files can be downloaded.
 */
export const submissionSchema = submissionStatsSchema
  .extend({
    id: z.number().int(),
    status: submissionStatusSchema,
    fileSize: z.number().int(),
    createdAt: z.iso.datetime(),
    section: z.string().nullable(),
    batch: z.string().nullable(),
    /** Null when the uploader's account no longer exists. */
    uploader: nullableRef(uploaderSchema),
    /**
     * Where the PDF is read and downloaded; null unless published. Its watermarked copy
     * on the public files domain once that exists, until then the API's file endpoint.
     */
    fileUrl: z.string().nullable(),
    /**
     * The paper's text as the AI read it off the PDF (plain text, line by line), for
     * reading without the PDF and for search engines. Null unless published, and
     * until it has been read.
     */
    text: z.string().nullable(),
  })
  .meta({ id: "Submission" });
export type Submission = z.infer<typeof submissionSchema>;

export const submissionCountsSchema = z
  .object({
    published: z.number().int(),
    pendingReview: z.number().int(),
    rejected: z.number().int(),
  })
  .meta({ id: "SubmissionCounts" });
export type SubmissionCounts = z.infer<typeof submissionCountsSchema>;

/** A question is a unique department + course + semester + exam type combination. */
export const questionSummarySchema = z.object({
  id: z.number().int().positive(),
  department: departmentSchema,
  course: courseSchema
    .pick({ id: true, name: true })
    .meta({ id: "QuestionCourse" }),
  semester: semesterSchema,
  examType: examTypeSchema,
});
export type QuestionSummary = z.infer<typeof questionSummarySchema>;

export const questionSchema = questionSummarySchema
  .extend({
    submissionCounts: submissionCountsSchema,
    /** Question page views, counted separately from each paper's views. */
    viewCount: z.number().int(),
  })
  .meta({ id: "Question" });
export type Question = z.infer<typeof questionSchema>;

export const questionDetailSchema = questionSchema
  .extend({
    /**
     * Published first, then pending review, then rejected. Within a status, ranked by
     * score (likes − dislikes), then views, then newest.
     */
    submissions: z.array(submissionSchema),
    /**
     * Send as `X-View-Token` when counting a view of this question or one of its papers.
     * Valid for an hour.
     */
    viewToken: z.string(),
  })
  .meta({ id: "QuestionDetail" });
export type QuestionDetail = z.infer<typeof questionDetailSchema>;

export const questionSortSchema = z
  .enum(QUESTION_SORTS)
  .meta({ id: "QuestionSort" });
export type QuestionSort = z.infer<typeof questionSortSchema>;

export const listQuestionsQuerySchema = paginationQuerySchema.extend({
  /** `newest`: most recently added paper first (default); `popular`: most viewed. */
  sort: questionSortSchema.default("newest"),
  departmentId: idQuerySchema.optional(),
  courseId: idQuerySchema.optional(),
  semesterId: idQuerySchema.optional(),
  examTypeId: idQuerySchema.optional(),
});
export type ListQuestionsQuery = z.infer<typeof listQuestionsQuerySchema>;

export const questionListSchema = paginatedSchema(questionSchema).meta({
  id: "QuestionList",
});
export type QuestionList = z.infer<typeof questionListSchema>;

export const searchPapersQuerySchema = paginationQuerySchema.extend({
  /** Words to find in papers' text, all of them; the last may be a word's start. */
  q: z.string().trim().min(MIN_SEARCH_LENGTH).max(MAX_SEARCH_LENGTH),
});
export type SearchPapersQuery = z.infer<typeof searchPapersQuerySchema>;

/** A piece of text, and whether it matched the search. */
export const textPartSchema = z
  .object({ text: z.string(), match: z.boolean() })
  .meta({ id: "TextPart" });
export type TextPart = z.infer<typeof textPartSchema>;

/** An exam whose paper's text matches a search, with the best-matching copy. */
export const paperSearchHitSchema = z
  .object({
    question: questionSummarySchema.meta({ id: "QuestionSummary" }),
    /** The published paper (copy of the exam) that matched best. */
    submissionId: z.number().int(),
    /** Its text around the matches. */
    snippet: z.array(textPartSchema),
  })
  .meta({ id: "PaperSearchHit" });
export type PaperSearchHit = z.infer<typeof paperSearchHitSchema>;

export const paperSearchListSchema = paginatedSchema(paperSearchHitSchema).meta(
  { id: "PaperSearchList" },
);
export type PaperSearchList = z.infer<typeof paperSearchListSchema>;
