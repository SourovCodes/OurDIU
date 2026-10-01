import { z } from "zod";
import {
  ANALYSIS_FILTERS,
  ANALYSIS_FLAGS,
  ANALYSIS_STATUSES,
} from "../constants";
import { nullableRef } from "./common";

// The AI analysis of an uploaded PDF (admin only): is it one question paper, and what
// is it filed under according to its header.

export const analysisStatusSchema = z
  .enum(ANALYSIS_STATUSES)
  .meta({ id: "AnalysisStatus" });
export type AnalysisStatus = z.infer<typeof analysisStatusSchema>;

export const analysisFlagSchema = z
  .enum(ANALYSIS_FLAGS)
  .meta({ id: "AnalysisFlag" });
export type AnalysisFlag = z.infer<typeof analysisFlagSchema>;

export const analysisFilterSchema = z.enum(ANALYSIS_FILTERS);
export type AnalysisFilter = z.infer<typeof analysisFilterSchema>;

/** A value read from the paper. `id` is the matching catalog entry, null if new. */
const extractedValue = z
  .object({
    id: z.number().int().nullable(),
    name: z.string(),
  })
  .meta({ id: "ExtractedValue" });

/** What the AI read from the paper. Any value it couldn't find is null. */
export const analysisValuesSchema = z
  .object({
    department: nullableRef(
      extractedValue
        .extend({ shortName: z.string().nullable() })
        .meta({ id: "ExtractedDepartment" }),
    ),
    course: nullableRef(extractedValue),
    semester: nullableRef(extractedValue),
    examType: nullableRef(extractedValue),
    section: z.string().nullable(),
    batch: z.string().nullable(),
  })
  .meta({ id: "AnalysisValues" });
export type AnalysisValues = z.infer<typeof analysisValuesSchema>;

export const submissionAnalysisSchema = z
  .object({
    status: analysisStatusSchema,
    /** Why the last run failed. */
    error: z.string().nullable(),
    model: z.string().nullable(),
    /** When this run was requested. */
    requestedAt: z.iso.datetime(),
    completedAt: z.iso.datetime().nullable(),
    /** Null until completed. */
    isQuestionPaper: z.boolean().nullable(),
    /** Distinct question papers found in the file. */
    paperCount: z.number().int().nullable(),
    /** The AI's short explanation of its verdict. */
    note: z.string().nullable(),
    flag: nullableRef(analysisFlagSchema),
    /** Null until completed. */
    values: nullableRef(analysisValuesSchema),
    /** PDF size before and after compression. */
    originalBytes: z.number().int().nullable(),
    sentBytes: z.number().int().nullable(),
  })
  .meta({ id: "SubmissionAnalysis" });
export type SubmissionAnalysis = z.infer<typeof submissionAnalysisSchema>;

/** The analysis at a glance, for lists. */
export const analysisSummarySchema = z
  .object({
    status: analysisStatusSchema,
    flag: nullableRef(analysisFlagSchema),
    /**
     * Whether the AI's department, course, semester and exam type match the
     * submission's. Null until completed.
     */
    matches: z.boolean().nullable(),
  })
  .meta({ id: "AnalysisSummary" });
export type AnalysisSummary = z.infer<typeof analysisSummarySchema>;
