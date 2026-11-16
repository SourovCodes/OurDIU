import { eq, sql } from "drizzle-orm";
import type { Database } from "../../db/client";
import { emailOutbox, type EmailKind } from "../../db/schema";

// Sends the queued emails (outbox.ts) through Cloudflare Email Sending, from the
// 5-minute cron. Each is deleted once sent, or after its last failed attempt.

export const EMAIL_FROM = { email: "noreply@ourdiu.com", name: "OurDIU" };
const BATCH = 50;
export const MAX_ATTEMPTS = 3;

const REPORT_REASON_LABELS: Record<string, string> = {
  wrong_details: "Wrong details",
  wrong_file: "Wrong file",
  unreadable: "Unreadable",
  duplicate: "Duplicate",
  inappropriate: "Inappropriate",
  other: "Other",
};

type QueuedEmail = {
  id: number;
  kind: EmailKind;
  submissionId: number;
  body: string | null;
  attempts: number;
  email: string;
  name: string;
  emailNotifications: number;
  course: string | null;
  examType: string | null;
};

export type RenderedEmail = { subject: string; text: string; html: string };

const escapeHtml = (s: string) =>
  s
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");

/** The email for one queued row: what happened, the quoted note, a link and how to stop them. */
export function renderEmail(
  row: Pick<
    QueuedEmail,
    "kind" | "submissionId" | "body" | "name" | "course" | "examType"
  >,
  siteUrl: string,
): RenderedEmail {
  const site = new URL(siteUrl).origin;
  const paper = row.course
    ? row.examType
      ? `${row.course} (${row.examType})`
      : row.course
    : "your paper";
  const mine = `${site}/questions/my-submissions/${row.submissionId}`;
  const admin = `${site}/admin/questions/submissions/${row.submissionId}`;

  let subject: string;
  let lead: string;
  let quoteLabel = "";
  let quote = row.body;
  let link: { href: string; label: string };
  switch (row.kind) {
    case "published":
      subject = `Your paper is published: ${paper}`;
      lead = `Thanks for sharing ${paper}. It's now on the DIU Question Bank for everyone.`;
      link = { href: mine, label: "See your paper" };
      break;
    case "rejected":
      subject = `Your paper wasn't published: ${paper}`;
      lead = `A reviewer decided not to publish ${paper}.`;
      quoteLabel = "Reason";
      link = { href: mine, label: "See your paper" };
      break;
    case "changes_requested":
      subject = `Changes needed: ${paper}`;
      lead = `A reviewer asked you to change ${paper} before it's published.`;
      quoteLabel = "What to change";
      link = { href: mine, label: "Make the changes" };
      break;
    case "admin_message":
      subject = `A reviewer wrote about ${paper}`;
      lead = `A reviewer wrote to you about ${paper}.`;
      quoteLabel = "Message";
      link = { href: mine, label: "Open the conversation" };
      break;
    case "uploader_update":
      subject = `The uploader replied: ${paper}`;
      lead = `The uploader of ${paper} replied or sent it back for review.`;
      quoteLabel = "Note";
      link = { href: admin, label: "Review it" };
      break;
    case "report": {
      // The body is the reason's code, then the reporter's details on the next lines.
      const [reason = "", ...details] = (row.body ?? "").split("\n");
      subject = `Paper reported: ${paper}`;
      quoteLabel = REPORT_REASON_LABELS[reason] ?? "Report";
      quote = details.join("\n").trim() || null;
      lead = `Someone reported ${paper}.${quote ? "" : ` Reason: ${quoteLabel}.`}`;
      link = { href: `${site}/admin/questions/reports`, label: "See reports" };
      break;
    }
  }

  const greeting = `Hi ${row.name},`;
  const text = [
    greeting,
    "",
    lead,
    ...(quote ? ["", `${quoteLabel}:`, quote] : []),
    "",
    `${link.label}: ${link.href}`,
    "",
    "—",
    `You get these emails because of your papers on OurDIU. Turn them off on your account page: ${site}/account`,
  ].join("\n");

  const p = (inner: string, style = "") =>
    `<p style="margin:0 0 16px;${style}">${inner}</p>`;
  const quoteHtml = quote
    ? `<div style="margin:0 0 16px;padding:12px 16px;border-radius:12px;background:#eef0fb"><div style="font-size:13px;color:#5d5e66;margin-bottom:4px">${escapeHtml(quoteLabel)}</div><div style="white-space:pre-wrap">${escapeHtml(quote)}</div></div>`
    : "";
  const html = `<!doctype html><html><body style="margin:0;padding:24px;background:#f5f5f7;font-family:Roboto,Arial,sans-serif;color:#1b1b1f;font-size:15px;line-height:1.5">
<div style="max-width:520px;margin:0 auto;background:#fff;border-radius:16px;padding:28px">
${p(escapeHtml(greeting))}
${p(escapeHtml(lead))}
${quoteHtml}
${p(`<a href="${escapeHtml(link.href)}" style="display:inline-block;padding:10px 20px;border-radius:999px;background:#3f51b5;color:#fff;text-decoration:none">${escapeHtml(link.label)}</a>`, "margin-top:8px")}
</div>
${p(`You get these emails because of your papers on OurDIU. <a href="${site}/account" style="color:#5d5e66">Turn them off</a> on your account page.`, "max-width:520px;margin:16px auto 0;font-size:12px;color:#5d5e66;text-align:center")}
</body></html>`;

  return { subject, text, html };
}

/**
 * Sends up to one batch of queued emails. A recipient who turned emails off gets none:
 * their rows are dropped. Never throws for a failed send.
 */
export async function sendQueuedEmails(
  db: Database,
  env: { EMAIL: SendEmail; SITE_URL: string },
): Promise<{ sent: number; failed: number; skipped: number }> {
  const rows = await db.all<QueuedEmail>(sql`
    select o.id, o.kind, o.submission_id as submissionId, o.body, o.attempts,
      u.email, u.name, u.email_notifications as emailNotifications,
      coalesce(qc.name, sc.name, s.custom_course_name) as course,
      coalesce(qe.name, se.name) as examType
    from email_outbox o
    join user u on u.id = o.recipient_id
    join submissions s on s.id = o.submission_id
    left join questions q on q.id = s.question_id
    left join courses qc on qc.id = q.course_id
    left join courses sc on sc.id = s.course_id
    left join exam_types qe on qe.id = q.exam_type_id
    left join exam_types se on se.id = s.exam_type_id
    order by o.id
    limit ${BATCH}`);

  const result = { sent: 0, failed: 0, skipped: 0 };
  for (const row of rows) {
    if (!row.emailNotifications) {
      await db.delete(emailOutbox).where(eq(emailOutbox.id, row.id));
      result.skipped++;
      continue;
    }
    try {
      await env.EMAIL.send({
        from: EMAIL_FROM,
        to: { email: row.email, name: row.name },
        ...renderEmail(row, env.SITE_URL),
      });
      await db.delete(emailOutbox).where(eq(emailOutbox.id, row.id));
      result.sent++;
    } catch (err) {
      console.error(`Email ${row.id} (${row.kind}) failed:`, err);
      result.failed++;
      if (row.attempts + 1 >= MAX_ATTEMPTS) {
        await db.delete(emailOutbox).where(eq(emailOutbox.id, row.id));
      } else {
        await db
          .update(emailOutbox)
          .set({ attempts: row.attempts + 1 })
          .where(eq(emailOutbox.id, row.id));
      }
    }
  }
  return result;
}
