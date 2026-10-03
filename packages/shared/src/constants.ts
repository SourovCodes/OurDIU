// Plain constants with no Zod import, so browser bundles can use them without shipping Zod.
// Import via `@ourdiu/shared/constants` in client code.
export const SUBMISSION_STATUSES = [
  "pending_review",
  "published",
  "rejected",
  /** An admin asked the uploader to fix something; it waits for them to resubmit. */
  "changes_requested",
] as const;
export const MAX_SUBMISSION_FILE_BYTES = 20 * 1024 * 1024;

/** Why a signed-in user reports a published submission. */
export const REPORT_REASONS = [
  "wrong_details",
  "wrong_file",
  "unreadable",
  "duplicate",
  "inappropriate",
  "other",
] as const;
export const REPORT_STATUSES = ["pending", "resolved", "dismissed"] as const;
export const MAX_REPORT_DETAILS_LENGTH = 500;

export const MAX_REJECTION_REASON_LENGTH = 1000;

/** Common reasons for rejecting a paper, offered to admins as starting points. */
export const REJECTION_REASON_PRESETS = [
  {
    label: "Multiple papers",
    text: "This PDF contains multiple question papers. Please upload each question paper as a separate PDF.",
  },
  {
    label: "Not a question paper",
    text: "This file is not a valid exam question paper.",
  },
  {
    label: "Wrong details",
    text: "The details you provided (department, course, semester or exam type) do not match the uploaded paper.",
  },
  {
    label: "Unreadable",
    text: "The PDF is too blurry or incomplete to read. Please upload a clearer scan.",
  },
  {
    label: "Duplicate",
    text: "This paper is already in the question bank.",
  },
] as const;
export const MAX_REVIEW_MESSAGE_LENGTH = 2000;

/**
 * Entries in a submission's review conversation: messages either side writes, and the
 * steps of the review (an admin's decision, the uploader's edits and resubmission).
 */
export const REVIEW_MESSAGE_KINDS = [
  "comment",
  "changes_requested",
  "rejected",
  "published",
  "returned_to_review",
  "details_edited",
  "file_replaced",
  "resubmitted",
] as const;
export const REVIEW_AUTHOR_ROLES = ["admin", "uploader"] as const;

/** Common things to ask an uploader to fix, offered to admins as starting points. */
export const CHANGE_REQUEST_PRESETS = [
  {
    label: "Wrong details",
    text: "The department, course, semester or exam type doesn't match the paper. Please check them and correct what's wrong.",
  },
  {
    label: "Blurry scan",
    text: "Some pages are hard to read. Please replace the file with a clearer scan.",
  },
  {
    label: "Pages missing",
    text: "Some pages of the paper seem to be missing. Please replace the file with the complete paper.",
  },
  {
    label: "Multiple papers",
    text: "This PDF contains more than one question paper. Please replace it with just one paper, and upload the others separately.",
  },
  {
    label: "Section or batch",
    text: "Please add the section and batch this paper is from.",
  },
] as const;

/**
 * Pending reports from different users that move a published submission back to
 * pending review. Enforced by the `submission_reports_after_insert` trigger in
 * migration 0003 — change both together.
 */
export const REPORT_HIDE_THRESHOLD = 3;

export const AVATAR_CONTENT_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
] as const;
export const MAX_AVATAR_BYTES = 2 * 1024 * 1024;

/** `admin` can moderate submissions and reports and manage the catalog and users. */
export const USER_ROLES = ["user", "admin"] as const;

/**
 * DIU addresses (staff and students). Any Google account can sign in, but only these
 * (and admins) can contribute papers.
 */
export const DIU_EMAIL_DOMAINS = ["diu.edu.bd", "s.diu.edu.bd"] as const;

/** Whether an address is on one of DIU_EMAIL_DOMAINS (exactly, not a subdomain). */
export function isDiuEmail(email: string): boolean {
  const [local, domain, ...rest] = email.trim().toLowerCase().split("@");
  return (
    !!local &&
    rest.length === 0 &&
    (DIU_EMAIL_DOMAINS as readonly string[]).includes(domain ?? "")
  );
}

/** Whether a user may contribute papers: a DIU address, or an admin. */
export function canContribute(user: {
  email: string;
  role?: string | null;
}): boolean {
  return user.role === "admin" || isDiuEmail(user.email);
}

/** Usernames, as on the old site: 3–50 of a-z, 0-9, `_`, `.` and `-`. */
export const USERNAME_PATTERN = /^[a-z0-9_.-]{3,50}$/;
export const USERNAME_RULES =
  "3–50 lowercase letters, digits, dots, dashes or underscores";

/** The error code for a contribution from an account that isn't on a DIU address. */
export const DIU_EMAIL_REQUIRED = "DIU_EMAIL_REQUIRED";

/** Lifecycle of a submission's AI analysis (compress, then ask Gemini). */
export const ANALYSIS_STATUSES = [
  "queued",
  "processing",
  "completed",
  "failed",
] as const;
/**
 * Lifecycle of a published paper's watermarked copy (the public download). Null
 * means it was never requested.
 */
export const WATERMARK_STATUSES = ["queued", "done", "failed"] as const;

/** Why the AI flags a submission for a closer look. */
export const ANALYSIS_FLAGS = ["not_a_paper", "multiple_papers"] as const;
/** Admin submission list filters on the AI result. */
export const ANALYSIS_FILTERS = ["flagged", "differs"] as const;

/**
 * Standard spelling for catalog names (departments, courses, semesters, exam types):
 * trimmed, single spaces, "and" instead of "&", straight quotes, no trailing period
 * or comma, and a numbered part as its own word ("Physics I", not "Physics-I").
 * Applied to names typed by users and admins and to the AI's output.
 */
export function normalizeCatalogName(name: string): string {
  return (
    name
      .replace(/[‘’]/g, "'")
      .replace(/[“”]/g, '"')
      .replace(/\s*[&＆]\s*/g, " and ")
      .replace(/\s+/g, " ")
      .trim()
      .replace(/[.,]+$/, "")
      .trim()
      // A numbered part is a separate word: "Physics-I" → "Physics I".
      .replace(
        /\s*[-–]\s*(I{1,3}|IV|VI{0,3}|IX|X|\d{1,2})$/i,
        (_, part: string) => ` ${part.toUpperCase()}`,
      )
  );
}

/** Compares catalog names: normalized and case-insensitive. */
export function catalogKey(name: string): string {
  return normalizeCatalogName(name).toLowerCase();
}

/**
 * Kinds of entries an admin merge removes (`merged_ids.kind`): the four catalog kinds,
 * plus questions (exams), which are combined when a merge makes two of them the same.
 */
export const MERGED_KINDS = [
  "question",
  "department",
  "course",
  "semester",
  "exam_type",
] as const;
/** At most this many entries are merged into one at a time. */
export const MAX_MERGE_ENTRIES = 20;

/** Semester names are a term and a two-digit year: "Fall 25", "Short 20". */
export const SEMESTER_TERMS = ["Spring", "Summer", "Fall", "Short"] as const;
export const MIN_SEMESTER_YEAR = 15;
export const MAX_SEMESTER_YEAR = 30;
export const SEMESTER_FORMAT_MESSAGE = `Use a term and a year, e.g. Fall 25 (${SEMESTER_TERMS.join(", ")}; ${MIN_SEMESTER_YEAR}–${MAX_SEMESTER_YEAR})`;

const SEMESTER_PATTERN = new RegExp(
  `^(${SEMESTER_TERMS.join("|")})[\\s'’_-]*(?:20)?(\\d{2})$`,
  "i",
);

/**
 * The standard spelling of a semester name, or null if it isn't one. Lenient about
 * case, separators and four-digit years: "fall 2025", "FALL-25" and "Fall'25" all
 * become "Fall 25".
 */
export function parseSemesterName(name: string): string | null {
  const match = SEMESTER_PATTERN.exec(name.trim());
  if (!match) return null;
  const year = Number(match[2]);
  if (year < MIN_SEMESTER_YEAR || year > MAX_SEMESTER_YEAR) return null;
  const term = SEMESTER_TERMS.find(
    (t) => t.toLowerCase() === match[1]!.toLowerCase(),
  )!;
  return `${term} ${match[2]}`;
}

/**
 * Orders for the questions list: newest papers, most viewed (all time), by name, or
 * most viewed in the last 24 hours.
 */
export const QUESTION_SORTS = ["newest", "popular", "az", "trending"] as const;

/** Paper search (`GET /api/v1/questions/search`): query length, in characters. */
export const MIN_SEARCH_LENGTH = 2;
export const MAX_SEARCH_LENGTH = 100;
