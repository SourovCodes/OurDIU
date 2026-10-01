import type { Sitemap } from "@ourdiu/shared";
import { asc, desc, gt, isNotNull } from "drizzle-orm";
import type { Database } from "../db/client";
import { usernameOf } from "../db/username";
import { questions, user } from "../db/schema";

/** A sitemap file holds at most 50,000 URLs (sitemaps.org). */
export const SITEMAP_LIMIT = 50_000;

/**
 * Public pages for the sitemap. Both lists read trigger-maintained counters
 * (migration 0006), so only published papers make a page appear.
 */
export async function getSitemap(db: Database): Promise<Sitemap> {
  const [questionRows, contributorRows] = await Promise.all([
    db
      .select({ id: questions.id, lastModified: questions.latestPublishedAt })
      .from(questions)
      .where(isNotNull(questions.latestPublishedAt))
      .orderBy(desc(questions.latestPublishedAt))
      .limit(SITEMAP_LIMIT),
    db
      .select({ username: usernameOf })
      .from(user)
      .where(gt(user.publishedSubmissionCount, 0))
      .orderBy(desc(user.publishedSubmissionCount), asc(user.id))
      .limit(SITEMAP_LIMIT),
  ]);
  return {
    questions: questionRows.map((row) => ({
      id: row.id,
      lastModified: row.lastModified!.toISOString(),
    })),
    contributors: contributorRows,
  };
}
