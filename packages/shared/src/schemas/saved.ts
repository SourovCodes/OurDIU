import { z } from "zod";
import { questionSchema } from "./question";

/** The most questions one account can keep saved. */
export const MAX_SAVED_QUESTIONS = 500;

/** A question the user saved (bookmarked), synced between the website and the app. */
export const savedQuestionSchema = questionSchema
  .extend({ savedAt: z.iso.datetime() })
  .meta({ id: "SavedQuestion" });
export type SavedQuestion = z.infer<typeof savedQuestionSchema>;

/** Every saved question, most recently saved first. */
export const savedQuestionListSchema = z
  .object({ items: z.array(savedQuestionSchema) })
  .meta({ id: "SavedQuestionList" });
export type SavedQuestionList = z.infer<typeof savedQuestionListSchema>;

/**
 * Several questions to save at once, e.g. the app's saved list when the user signs
 * in. Unknown ids are ignored.
 */
export const saveQuestionsInputSchema = z
  .object({
    questionIds: z
      .array(z.number().int().positive())
      .min(1)
      .max(MAX_SAVED_QUESTIONS),
  })
  .meta({ id: "SaveQuestionsInput" });
export type SaveQuestionsInput = z.infer<typeof saveQuestionsInputSchema>;
