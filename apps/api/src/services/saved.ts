import type { SavedQuestionList } from "@ourdiu/shared";
import { MAX_SAVED_QUESTIONS } from "@ourdiu/shared";
import { and, count, desc, eq } from "drizzle-orm";
import type { Database } from "../db/client";
import { inList } from "../db/in-list";
import {
  courses,
  departments,
  examTypes,
  questions,
  savedQuestions,
  semesters,
} from "../db/schema";
import { AppError } from "../lib/errors";
import { questionSummaryColumns } from "./common";

/** The user's saved questions, most recently saved first. */
export async function listSavedQuestions(
  db: Database,
  userId: string,
): Promise<SavedQuestionList> {
  const rows = await db
    .select({
      ...questionSummaryColumns,
      viewCount: questions.viewCount,
      submissionCounts: {
        published: questions.publishedCount,
        pendingReview: questions.pendingReviewCount,
        rejected: questions.rejectedCount,
      },
      savedAt: savedQuestions.createdAt,
    })
    .from(savedQuestions)
    .innerJoin(questions, eq(questions.id, savedQuestions.questionId))
    .innerJoin(departments, eq(departments.id, questions.departmentId))
    .innerJoin(courses, eq(courses.id, questions.courseId))
    .innerJoin(semesters, eq(semesters.id, questions.semesterId))
    .innerJoin(examTypes, eq(examTypes.id, questions.examTypeId))
    .where(eq(savedQuestions.userId, userId))
    .orderBy(desc(savedQuestions.createdAt), desc(questions.id))
    .limit(MAX_SAVED_QUESTIONS);
  return {
    items: rows.map((row) => ({ ...row, savedAt: row.savedAt.toISOString() })),
  };
}

async function savedCount(db: Database, userId: string) {
  const [row] = await db
    .select({ total: count() })
    .from(savedQuestions)
    .where(eq(savedQuestions.userId, userId));
  return row?.total ?? 0;
}

const FULL = () =>
  new AppError(
    409,
    "SAVED_LIMIT",
    `You can keep up to ${MAX_SAVED_QUESTIONS} saved papers. Remove some first.`,
  );

/** Saves one question; saving it again is a no-op. */
export async function saveQuestion(
  db: Database,
  userId: string,
  questionId: number,
) {
  const [question] = await db
    .select({ id: questions.id })
    .from(questions)
    .where(eq(questions.id, questionId));
  if (!question) throw new AppError(404, "NOT_FOUND", "Question not found");
  const [existing] = await db
    .select({ id: savedQuestions.questionId })
    .from(savedQuestions)
    .where(
      and(
        eq(savedQuestions.userId, userId),
        eq(savedQuestions.questionId, questionId),
      ),
    );
  if (existing) return;
  if ((await savedCount(db, userId)) >= MAX_SAVED_QUESTIONS) throw FULL();
  await db
    .insert(savedQuestions)
    .values({ userId, questionId })
    .onConflictDoNothing();
}

/**
 * Saves several questions at once (the app's list when the user signs in), keeping
 * those already saved. Unknown ids are skipped; the limit still applies.
 */
export async function saveQuestions(
  db: Database,
  userId: string,
  questionIds: number[],
) {
  const unique = [...new Set(questionIds)];
  const known = await db
    .select({ id: questions.id })
    .from(questions)
    .where(inList(questions.id, unique));
  if (known.length === 0) return;
  const room = MAX_SAVED_QUESTIONS - (await savedCount(db, userId));
  const ids = new Set(known.map((q) => q.id));
  // In the order given, so the newest of the app's list survive a full account.
  const toSave = unique.filter((id) => ids.has(id)).slice(0, Math.max(0, room));
  if (toSave.length === 0) {
    if (room <= 0) throw FULL();
    return;
  }
  // D1 allows 100 bound parameters per statement: 40 rows of 2 at a time.
  for (let i = 0; i < toSave.length; i += 40) {
    await db
      .insert(savedQuestions)
      .values(
        toSave.slice(i, i + 40).map((questionId) => ({ userId, questionId })),
      )
      .onConflictDoNothing();
  }
}

/** Removes a saved question; removing one that isn't saved is a no-op. */
export async function unsaveQuestion(
  db: Database,
  userId: string,
  questionId: number,
) {
  await db
    .delete(savedQuestions)
    .where(
      and(
        eq(savedQuestions.userId, userId),
        eq(savedQuestions.questionId, questionId),
      ),
    );
}

/** Whether the user saved a question. */
export async function isSaved(
  db: Database,
  userId: string,
  questionId: number,
) {
  const [row] = await db
    .select({ id: savedQuestions.questionId })
    .from(savedQuestions)
    .where(
      and(
        eq(savedQuestions.userId, userId),
        eq(savedQuestions.questionId, questionId),
      ),
    );
  return Boolean(row);
}
