import type { Database } from "../db/client";

// "Most viewed today": question page views are counted per hour in
// `question_view_hours` (by `recordQuestionView`), and every few minutes the cron sums
// the last 24 hours into `trending_questions`, so lists read a few indexed rows
// instead of summing the window on every request (docs/PLAN.md, decision 24).

/** Hours in the window: the current one and the 23 before it. */
export const TRENDING_HOURS = 24;

/** Questions kept in the list. */
export const TRENDING_LIMIT = 100;

/**
 * Rebuilds `trending_questions` from the window's views and drops older buckets, in
 * one batch (one transaction), so lists never see it half built. Only questions with
 * a published paper are listed, as everywhere public.
 */
export async function refreshTrending(db: Database): Promise<void> {
  const client = db.$client;
  const oldest = `unixepoch() / 3600 - ${TRENDING_HOURS - 1}`;
  await client.batch([
    client.prepare(`delete from question_view_hours where hour < ${oldest}`),
    client.prepare("delete from trending_questions"),
    client.prepare(
      `insert into trending_questions (question_id, views)
      select h.question_id, sum(h.views) as views
      from question_view_hours h
      join questions q on q.id = h.question_id
      where h.hour >= ${oldest} and q.latest_published_at is not null
      group by h.question_id
      order by views desc, h.question_id
      limit ${TRENDING_LIMIT}`,
    ),
  ]);
}
