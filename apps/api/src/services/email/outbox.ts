import { eq, sql } from "drizzle-orm";
import type { Database } from "../../db/client";
import { emailOutbox, submissions, type EmailKind } from "../../db/schema";

// Queues emails about a paper for the cron to send (send.ts). Nobody is emailed about
// a step they took themselves.

/** Emails a paper's uploader, if it has one. */
export async function emailUploader(
  db: Database,
  submissionId: number,
  kind: EmailKind,
  body: string | null | undefined,
  actorId: string | null,
) {
  const row = await db.query.submissions.findFirst({
    columns: { uploaderId: true },
    where: eq(submissions.id, submissionId),
  });
  const recipientId = row?.uploaderId;
  if (!recipientId || recipientId === actorId) return;
  await db
    .insert(emailOutbox)
    .values({ recipientId, kind, submissionId, body: body || null });
}

/** Emails every admin. */
export async function emailAdmins(
  db: Database,
  submissionId: number,
  kind: EmailKind,
  body: string | null | undefined,
  actorId: string | null,
) {
  await db.run(sql`
    insert into email_outbox (recipient_id, kind, submission_id, body)
    select id, ${kind}, ${submissionId}, ${body || null}
    from user
    where role = 'admin' and id <> ${actorId ?? ""}`);
}
