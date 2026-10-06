import { z } from "zod";
import {
  COVER_PAGE_EXPERIMENT_FIELDS,
  COVER_PAGE_FIELDS,
  COVER_PAGE_TEMPLATES,
  MAX_COVER_PAGE_EXPERIMENTS,
  MAX_COVER_PAGE_MEMBER_ID,
  MAX_COVER_PAGE_MEMBER_NAME,
  MAX_COVER_PAGE_MEMBERS,
  type CoverPageField,
} from "../cover-pages";

export const coverPageTemplateSchema = z
  .enum(COVER_PAGE_TEMPLATES)
  .meta({ id: "CoverPageTemplate" });

const text = (max: number) => z.string().trim().max(max).optional();

const fields = Object.fromEntries(
  Object.entries(COVER_PAGE_FIELDS).map(([key, max]) => [key, text(max)]),
) as Record<CoverPageField, ReturnType<typeof text>>;

/** A cover page's details: every field optional, as the page leaves blanks blank. */
export const coverPageInputSchema = z
  .object({
    ...fields,
    /** A group assignment's members, in order. */
    members: z
      .array(
        z
          .object({
            name: z.string().trim().max(MAX_COVER_PAGE_MEMBER_NAME),
            id: z.string().trim().max(MAX_COVER_PAGE_MEMBER_ID),
          })
          .meta({ id: "CoverPageMember" }),
      )
      .max(MAX_COVER_PAGE_MEMBERS)
      .optional(),
    /** The lab report index's experiments, in order; the rest print blank. */
    experiments: z
      .array(
        z
          .object({
            no: z.string().trim().max(COVER_PAGE_EXPERIMENT_FIELDS.no),
            name: z.string().trim().max(COVER_PAGE_EXPERIMENT_FIELDS.name),
            performedOn: z
              .string()
              .trim()
              .max(COVER_PAGE_EXPERIMENT_FIELDS.performedOn),
            submittedOn: z
              .string()
              .trim()
              .max(COVER_PAGE_EXPERIMENT_FIELDS.submittedOn),
          })
          .meta({ id: "CoverPageExperiment" }),
      )
      .max(MAX_COVER_PAGE_EXPERIMENTS)
      .optional(),
  })
  .meta({ id: "CoverPageInput" });
export type CoverPageInput = z.infer<typeof coverPageInputSchema>;
