import type {
  PaperSearchList,
  QuestionSummary,
  SearchPapersQuery,
  TextPart,
} from "@ourdiu/shared";
import { eq, sql } from "drizzle-orm";
import type { Database } from "../db/client";
import { inList } from "../db/in-list";
import {
  courses,
  departments,
  examTypes,
  questions,
  semesters,
} from "../db/schema";
import { questionSummaryColumns } from "./common";

// Full-text search over published papers' text (`submission_texts_fts`, migration
// 0014). One hit per exam: its best-matching published copy.

/** Words of a query beyond this are ignored. */
const MAX_WORDS = 8;

/** Snippet markers around matches: control characters, which papers' text lacks. */
const MATCH_START = "\u0002";
const MATCH_END = "\u0003";

/**
 * The FTS5 query for what a visitor typed: every word must appear (in any order), and
 * the last one may be the start of a word, as it's often still being typed. Only
 * letters and digits are kept, each word quoted, so nothing typed is FTS5 syntax.
 * Null if nothing searchable is left.
 */
export function matchExpression(query: string): string | null {
  const words = (
    query.normalize("NFKC").match(/[\p{L}\p{M}\p{N}]+/gu) ?? []
  ).slice(0, MAX_WORDS);
  if (words.length === 0) return null;
  return words
    .map((word, i) => `"${word}"${i === words.length - 1 ? "*" : ""}`)
    .join(" ");
}

/**
 * A snippet with markers, as parts that matched and parts that didn't, on one line:
 * the paper's line breaks would split a result's snippet.
 */
export function snippetParts(snippet: string): TextPart[] {
  const parts: TextPart[] = [];
  const add = (text: string, match: boolean) => {
    const line = text.replace(/\s+/g, " ");
    if (line) parts.push({ text: line, match });
  };
  const [before, ...pieces] = snippet.split(MATCH_START);
  add(before ?? "", false);
  for (const piece of pieces) {
    const end = piece.indexOf(MATCH_END);
    add(end === -1 ? piece : piece.slice(0, end), true);
    if (end !== -1) add(piece.slice(end + MATCH_END.length), false);
  }
  return parts;
}

type Hit = { questionId: number; submissionId: number };

export async function searchPapers(
  db: Database,
  query: SearchPapersQuery,
): Promise<PaperSearchList> {
  const empty = {
    items: [],
    page: query.page,
    pageSize: query.pageSize,
    total: 0,
  };
  const match = matchExpression(query.q);
  if (!match) return empty;

  // Published papers whose text matches, ranked by bm25 (materialized: FTS5's
  // functions can't run inside the window that picks each exam's best copy).
  const best = sql`
    with hits as materialized (
      select s.question_id as questionId, s.id as submissionId,
        bm25(submission_texts_fts) as rank
      from submission_texts_fts
      join submissions s on s.id = submission_texts_fts.rowid
      where submission_texts_fts match ${match} and s.status = 'published'
    )
    select questionId, submissionId, rank from (
      select *, row_number() over (
        partition by questionId order by rank, submissionId
      ) as n
      from hits
    ) where n = 1`;
  const [rows, [totals]] = await Promise.all([
    db.all<Hit>(sql`
      select questionId, submissionId from (${best})
      order by rank, questionId
      limit ${query.pageSize} offset ${(query.page - 1) * query.pageSize}`),
    db.all<{ total: number }>(sql`select count(*) as total from (${best})`),
  ]);
  if (rows.length === 0) return { ...empty, total: totals?.total ?? 0 };

  // The text around the matches, for this page's papers only.
  const snippets = await db.all<{ submissionId: number; snippet: string }>(sql`
    select rowid as submissionId,
      snippet(submission_texts_fts, 0, ${MATCH_START}, ${MATCH_END}, '…', 24) as snippet
    from submission_texts_fts
    where submission_texts_fts match ${match}
      and rowid in (select value from json_each(${JSON.stringify(rows.map((row) => row.submissionId))}))`);
  const snippetOf = new Map(
    snippets.map((row) => [row.submissionId, row.snippet]),
  );

  const summaries = await db
    .select(questionSummaryColumns)
    .from(questions)
    .innerJoin(departments, eq(departments.id, questions.departmentId))
    .innerJoin(courses, eq(courses.id, questions.courseId))
    .innerJoin(semesters, eq(semesters.id, questions.semesterId))
    .innerJoin(examTypes, eq(examTypes.id, questions.examTypeId))
    .where(
      inList(
        questions.id,
        rows.map((row) => row.questionId),
      ),
    );
  const byId = new Map<number, QuestionSummary>(
    summaries.map((summary) => [summary.id, summary]),
  );

  return {
    items: rows.flatMap((row) => {
      const question = byId.get(row.questionId);
      return question
        ? [
            {
              question,
              submissionId: row.submissionId,
              snippet: snippetParts(snippetOf.get(row.submissionId) ?? ""),
            },
          ]
        : [];
    }),
    page: query.page,
    pageSize: query.pageSize,
    total: totals?.total ?? 0,
  };
}
