import { sql } from "drizzle-orm";
import type { Database } from "../db/client";
import { AppError } from "../lib/errors";

// Students sometimes upload a file that is already on the site: 74 of 1,315 copies
// of midterms and finals with several copies were the same file again (31 October
// 2026). Each PDF's SHA-256 is stored (`submissions.file_sha256`): uploading a file
// already on the site is refused, and duplicates published before that are shown
// once (`withoutDuplicates`). docs/PLAN.md, decision 68.

/** A file's SHA-256, in hex. */
export async function sha256Hex(data: ArrayBuffer): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", data);
  return [...new Uint8Array(digest)]
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

/**
 * Refuses a file that is already on the site, published or waiting for review (a
 * rejected paper's file may be uploaded again). `exceptId` is the paper whose file
 * is being replaced.
 */
export async function assertNotDuplicate(
  db: Database,
  sha256: string,
  exceptId?: number,
): Promise<void> {
  const [duplicate] = await db.all<{ id: number }>(sql`
    select id from submissions
    where file_sha256 = ${sha256} and status <> 'rejected' and id <> ${exceptId ?? 0}
    limit 1`);
  if (duplicate) {
    throw new AppError(
      409,
      "DUPLICATE_FILE",
      "This PDF is already on the question bank.",
    );
  }
}

type Copy = {
  fileSha256: string | null;
  likeCount: number;
  dislikeCount: number;
  viewCount: number;
  createdAt: Date;
};

/**
 * An exam's published papers with each file once: of the same file uploaded again,
 * the copy with the most net likes, then views, then the first uploaded stays.
 */
export function withoutDuplicates<T extends Copy>(copies: T[]): T[] {
  const kept = new Map<string, T>();
  const keep = (a: T, b: T) =>
    b.likeCount - b.dislikeCount - (a.likeCount - a.dislikeCount) ||
    b.viewCount - a.viewCount ||
    a.createdAt.getTime() - b.createdAt.getTime();
  for (const copy of copies) {
    if (!copy.fileSha256) continue;
    const other = kept.get(copy.fileSha256);
    if (!other || keep(other, copy) > 0) kept.set(copy.fileSha256, copy);
  }
  return copies.filter(
    (copy) => !copy.fileSha256 || kept.get(copy.fileSha256) === copy,
  );
}

/** Papers one cron run hashes: R2 reads, no AI. */
const HASHES_PER_RUN = 20;

/**
 * The cron's backfill of hashes for papers uploaded before they were stored, newest
 * first. A file missing from storage gets "" so it isn't read again. Returns how many
 * it hashed.
 */
export async function hashNextPapers(
  db: Database,
  bucket: R2Bucket,
): Promise<number> {
  const papers = await db.all<{ id: number; fileKey: string }>(sql`
    select id, file_key as fileKey from submissions
    where file_sha256 is null
    order by id desc
    limit ${HASHES_PER_RUN}`);
  for (const paper of papers) {
    const object = await bucket.get(paper.fileKey);
    const sha256 = object ? await sha256Hex(await object.arrayBuffer()) : "";
    // Raw SQL, so `updated_at` stays.
    await db.run(
      sql`update submissions set file_sha256 = ${sha256} where id = ${paper.id}`,
    );
  }
  return papers.length;
}
