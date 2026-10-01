// Imports the legacy site (api.diuqbank.com) into D1 and R2: departments, courses,
// semesters, exam types, questions, published submissions, manual/auto uploads in every
// status, users and their avatars. Original (unwatermarked) PDFs are copied into R2.
//
// Usage: LEGACY_TOKEN=<legacy admin JWT> pnpm import-legacy [--remote]
//   (local D1/R2 unless --remote is given; LEGACY_API_URL overrides the API origin)
//
// Fills a database without legacy data (it stops if it finds any): the R2 bucket is
// public, so papers get random file keys, and a re-run couldn't tell which papers it
// already imported. Taxonomy and questions are matched by name, so they are reused.
// Downloads are cached in apps/api/.legacy-import/, so a retry after a failure (on a
// cleared database) doesn't download everything again.
//
// Legacy users signed in with Google. Each imported user gets a random, discarded
// password, so they can only sign in after resetting it. A legacy user whose email
// already has an account here is mapped to that account instead.
import { execFileSync } from "node:child_process";
import { createHash, randomBytes, randomUUID } from "node:crypto";
import {
  existsSync,
  mkdirSync,
  readFileSync,
  renameSync,
  statSync,
  writeFileSync,
} from "node:fs";
import path from "node:path";
import { hashPassword } from "better-auth/crypto";

const remote = process.argv.includes("--remote");
const token = process.env.LEGACY_TOKEN;
const legacyApi = (
  process.env.LEGACY_API_URL ?? "https://api.diuqbank.com"
).replace(/\/$/, "");
if (!token) {
  console.error("Set LEGACY_TOKEN to a legacy admin bearer token.");
  console.error("Usage: LEGACY_TOKEN=<token> pnpm import-legacy [--remote]");
  process.exit(1);
}

const apiDir = path.join(import.meta.dirname, "..");
// Wrangler runs where the Worker's config (and its local state) lives.
const webDir = path.join(apiDir, "../web");
const cacheDir = path.join(apiDir, ".legacy-import");
const bucket = "questionbank-papers";
const target = remote ? "--remote" : "--local";
// Keep in sync with AVATAR_CONTENT_TYPES / MAX_AVATAR_BYTES in @ourdiu/shared.
const MAX_AVATAR_BYTES = 2 * 1024 * 1024;
const DOWNLOAD_CONCURRENCY = 8;

// ---------------------------------------------------------------------------- helpers

/** `output`: "inherit" prints wrangler's output, "json" parses it, "quiet" drops it. */
function wrangler(args, { output = "inherit" } = {}) {
  const stdout = execFileSync("pnpm", ["exec", "wrangler", ...args], {
    cwd: webDir,
    encoding: "utf8",
    stdio: ["ignore", output === "inherit" ? "inherit" : "pipe", "inherit"],
    maxBuffer: 256 * 1024 * 1024,
  });
  return output === "json" ? JSON.parse(stdout) : undefined;
}

function d1Query(sql) {
  return (
    wrangler(["d1", "execute", "DB", target, "--json", "--command", sql], {
      output: "json",
    })[0]?.results ?? []
  );
}

async function withRetry(label, fn, attempts = 4) {
  for (let attempt = 1; ; attempt++) {
    try {
      return await fn();
    } catch (err) {
      if (attempt >= attempts) {
        throw new Error(`${label}: ${err.message}`, { cause: err });
      }
      await new Promise((resolve) => setTimeout(resolve, 500 * 2 ** attempt));
    }
  }
}

async function legacyGet(pathname) {
  return withRetry(`GET ${pathname}`, async () => {
    const res = await fetch(`${legacyApi}${pathname}`, {
      headers: { authorization: `Bearer ${token}`, accept: "application/json" },
    });
    if (res.status === 401 || res.status === 403) {
      console.error(
        `Legacy API refused the token (${res.status}). Is it an unexpired admin token?`,
      );
      process.exit(1);
    }
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return res.json();
  });
}

async function fetchAll(resource, query = "") {
  const rows = [];
  for (let page = 1; ; page++) {
    const { data, meta } = await legacyGet(
      `/admin/${resource}?perPage=100&page=${page}${query}`,
    );
    rows.push(...data);
    if (page >= meta.totalPages) return rows;
  }
}

/** Runs `fn` over `items` with limited concurrency. */
async function pool(items, fn, concurrency = DOWNLOAD_CONCURRENCY) {
  let next = 0;
  let done = 0;
  const worker = async () => {
    while (next < items.length) {
      const item = items[next++];
      await fn(item);
      if (++done % 100 === 0) console.log(`  ${done}/${items.length}`);
    }
  };
  await Promise.all(Array.from({ length: concurrency }, worker));
}

/** Downloads `url` to the cache (once) and returns the local path. */
async function download(url, relPath) {
  const file = path.join(cacheDir, "files", relPath);
  if (existsSync(file)) return file;
  mkdirSync(path.dirname(file), { recursive: true });
  const bytes = await withRetry(`download ${url}`, async () => {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return Buffer.from(await res.arrayBuffer());
  });
  writeFileSync(`${file}.part`, bytes);
  renameSync(`${file}.part`, file);
  return file;
}

function detectImageType(bytes) {
  const starts = (sig, offset = 0) =>
    sig.every((b, i) => bytes[offset + i] === b);
  if (starts([0xff, 0xd8, 0xff])) return "image/jpeg";
  if (starts([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))
    return "image/png";
  if (starts([0x52, 0x49, 0x46, 0x46]) && starts([0x57, 0x45, 0x42, 0x50], 8))
    return "image/webp";
  return null;
}

const UUID_RE = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i;

/** The avatar route only accepts UUIDs: reuse the legacy one, or derive one from the URL. */
function avatarId(url) {
  const existing = new URL(url).pathname.match(UUID_RE)?.[0];
  if (existing) return existing.toLowerCase();
  const h = createHash("sha1").update(url).digest("hex");
  const variant = ((parseInt(h[16], 16) & 0x3) | 0x8).toString(16);
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-5${h.slice(13, 16)}-${variant}${h.slice(17, 20)}-${h.slice(20, 32)}`;
}

const sq = (value) =>
  value === null || value === undefined
    ? "NULL"
    : `'${String(value).replaceAll("'", "''")}'`;
const ms = (epochSeconds) => (epochSeconds ? epochSeconds * 1000 : Date.now());
const norm = (name) => name?.trim().toLowerCase();
/**
 * A legacy username under USERNAME_PATTERN: lowercase ("Al_Masrur" → "al_masrur"),
 * spaces as underscores, other characters dropped ("@arko07" → "arko07"). The
 * legacy ones stay unique that way (checked against the data on 2026-09-28).
 */
const legacyUsername = (name) =>
  name
    .trim()
    .toLowerCase()
    .replaceAll(" ", "_")
    .replace(/[^a-z0-9_.-]/g, "");
/**
 * A section or batch. The app allows 10 characters; longer legacy values are mostly
 * lists like "A, B, C, D, E" that don't tell papers apart, so they are dropped.
 */
const detail = (value) => {
  const trimmed = value?.trim();
  return trimmed && trimmed.length <= 10 ? trimmed : null;
};

// Name-based lookups, so taxonomy that already exists here is reused rather than duplicated.
const deptExpr = (d) =>
  `(SELECT id FROM departments WHERE name = ${sq(d.name)} OR short_name = ${sq(d.shortName)} ORDER BY name = ${sq(d.name)} DESC LIMIT 1)`;
const courseExpr = (d, name) =>
  `(SELECT id FROM courses WHERE department_id = ${deptExpr(d)} AND name = ${sq(name)})`;
const semesterExpr = (name) =>
  `(SELECT id FROM semesters WHERE name = ${sq(name)})`;
const examTypeExpr = (name) =>
  `(SELECT id FROM exam_types WHERE name = ${sq(name)})`;
const userExpr = (email) =>
  `(SELECT id FROM "user" WHERE email = ${sq(email)})`;

// ---------------------------------------------------------------------------- fetch

console.log(`Fetching legacy data from ${legacyApi} …`);
const [
  departments,
  courses,
  semesters,
  examTypes,
  questions,
  submissions,
  users,
] = await Promise.all([
  fetchAll("departments"),
  fetchAll("courses"),
  fetchAll("semesters"),
  fetchAll("exam-types"),
  fetchAll("questions"),
  fetchAll("submissions"),
  fetchAll("users"),
]);
/**
 * Status here of a legacy upload. Auto uploads that were still processing or failed
 * were never reviewed, so an admin decides on them. Published uploads are left out:
 * each one became a legacy submission, which is imported as published.
 */
const UPLOAD_STATUS = {
  manual: { pending: "pending_review", rejected: "rejected" },
  auto: {
    needs_review: "pending_review",
    processing: "pending_review",
    failed: "pending_review",
    rejected: "rejected",
  },
};
const allUploads = [
  ...(await fetchAll("manual-submissions")).map((s) => ({
    ...s,
    kind: "manual",
  })),
  ...(await fetchAll("auto-submissions")).map((s) => ({ ...s, kind: "auto" })),
];
const uploads = allUploads
  .filter((s) => s.status !== "published")
  .map((s) => ({ ...s, newStatus: UPLOAD_STATUS[s.kind][s.status] }));

// Numbered course parts as their own word, like the API's name normalizer does for new
// names: "Physics-I" / "Chemistry -I" / "Manufacturing - II" → "Physics I". A name is
// kept as is when the new one is already taken in the same department. Questions
// refer to courses by department and course name, so they are renamed too.
const NUMBERED_PART = /\s*[-–]\s*(I{1,3}|IV|VI{0,3}|IX|X|[1-9]|1[0-2])$/;
const courseDeptName = new Map(departments.map((d) => [d.id, d.name]));
const courseKey = (departmentName, name) => `${departmentName}\u0000${name}`;
const courseNames = new Set(
  courses.map((c) => courseKey(courseDeptName.get(c.departmentId), c.name)),
);
const renamedCourses = new Map();
for (const c of courses) {
  const departmentName = courseDeptName.get(c.departmentId);
  const name = c.name.replace(NUMBERED_PART, " $1");
  if (name === c.name || courseNames.has(courseKey(departmentName, name)))
    continue;
  courseNames.add(courseKey(departmentName, name));
  renamedCourses.set(courseKey(departmentName, c.name), name);
  c.name = name;
}
for (const q of questions) {
  q.course.name =
    renamedCourses.get(courseKey(q.department.name, q.course.name)) ??
    q.course.name;
}
console.log(
  `  ${departments.length} departments, ${courses.length} courses, ${semesters.length} semesters, ` +
    `${examTypes.length} exam types, ${questions.length} questions, ${submissions.length} submissions, ` +
    `${uploads.length} unpublished uploads, ${users.length} users`,
);

const deptById = new Map(departments.map((d) => [d.id, d]));
const questionById = new Map(questions.map((q) => [q.id, q]));
const emailByUserId = new Map(
  users.map((u) => [u.id, u.email.trim().toLowerCase()]),
);

// ---------------------------------------------------------------------------- plan

console.log(
  `Checking for earlier imports (${remote ? "remote" : "local"} D1) …`,
);
const [{ imported: alreadyImported }] = d1Query(
  `SELECT count(*) AS imported FROM "user" WHERE id LIKE 'legacy-%'`,
);
if (alreadyImported > 0) {
  console.error(
    `${alreadyImported} legacy users are already imported. This script only fills a database without legacy data.`,
  );
  process.exit(1);
}

const warnings = [];

const submissionIds = new Set(submissions.map((s) => s.id));
for (const s of allUploads) {
  if (s.status === "published" && !submissionIds.has(s.submissionId)) {
    warnings.push(
      `legacy-${s.kind}-${s.id}: published upload without a legacy submission (deleted?), skipped`,
    );
  }
}

/**
 * Legacy submissions and unpublished uploads, each with a `ref` for messages and the
 * download cache (e.g. `legacy-auto-12`), and a random R2 key for its PDF.
 */
const allPapers = [
  ...submissions.map((s) => ({
    ...s,
    kind: "published",
    newStatus: "published",
    ref: `legacy-${s.id}`,
  })),
  ...uploads.map((s) => ({ ...s, ref: `legacy-${s.kind}-${s.id}` })),
].map((s) => ({ ...s, fileKey: `submissions/${randomUUID()}.pdf` }));
const newPapers = allPapers
  .filter((s) => {
    if (s.newStatus) return true;
    warnings.push(`${s.ref}: unknown legacy status "${s.status}", skipped`);
    return false;
  })
  .filter((s) => {
    if (s.pdfUrl) return true;
    warnings.push(`${s.ref}: no original PDF, skipped`);
    return false;
  });

const newUsers = users;

// ---------------------------------------------------------------------------- download

console.log(`Downloading ${newPapers.length} PDFs …`);
await pool(newPapers, async (paper) => {
  paper.file = await download(paper.pdfUrl, `submissions/${paper.ref}.pdf`);
  paper.fileSize = statSync(paper.file).size;
  const head = readFileSync(paper.file).subarray(0, 5).toString("latin1");
  if (head !== "%PDF-")
    warnings.push(`${paper.ref}: ${paper.pdfUrl} does not look like a PDF`);
});

console.log(`Downloading avatars for ${newUsers.length} users …`);
const avatars = [];
await pool(
  newUsers.filter((u) => u.image?.startsWith("http")),
  async (u) => {
    const id = avatarId(u.image);
    let file;
    try {
      file = await download(u.image, `avatars/${id}`);
    } catch (err) {
      warnings.push(`user ${u.id}: avatar not downloaded (${err.message})`);
      return;
    }
    const bytes = readFileSync(file);
    const contentType = detectImageType(bytes);
    if (!contentType || bytes.length > MAX_AVATAR_BYTES) {
      warnings.push(
        `user ${u.id}: avatar skipped (not a JPEG/PNG/WebP under 2 MB)`,
      );
      return;
    }
    u.avatar = `/api/v1/avatars/${id}`;
    avatars.push({ key: `avatars/${id}`, file, contentType });
  },
);

// ---------------------------------------------------------------------------- R2

// Uploaded before the rows are written, so no row ever points at a missing object.
function bulkPut(entries, contentType, name) {
  if (entries.length === 0) return;
  const manifest = path.join(cacheDir, `${name}.json`);
  writeFileSync(
    manifest,
    JSON.stringify(entries.map(({ key, file }) => ({ key, file }))),
  );
  wrangler([
    "r2",
    "bulk",
    "put",
    bucket,
    "--filename",
    manifest,
    "--content-type",
    contentType,
    target,
  ]);
}

console.log(
  `Uploading ${newPapers.length} PDFs and ${avatars.length} avatars to R2 …`,
);
bulkPut(
  newPapers.map((p) => ({ key: p.fileKey, file: p.file })),
  "application/pdf",
  "r2-pdfs",
);
for (const type of ["image/jpeg", "image/png", "image/webp"]) {
  bulkPut(
    avatars.filter((a) => a.contentType === type),
    type,
    `r2-avatars-${type.split("/")[1]}`,
  );
}

// ---------------------------------------------------------------------------- SQL

const statements = [];

console.log(`Hashing placeholder passwords for ${newUsers.length} users …`);
for (const u of newUsers) {
  const id = sq(`legacy-${u.id}`);
  const created = ms(u.createdAt);
  // A random password nobody knows: the account exists, but signing in needs a reset.
  const hash = await hashPassword(randomBytes(32).toString("base64url"));
  statements.push(
    `INSERT OR IGNORE INTO "user" (id, name, email, email_verified, image, role, username, created_at, updated_at) VALUES (${id}, ${sq(u.name.trim() || u.username)}, ${sq(emailByUserId.get(u.id))}, 1, ${sq(u.avatar ?? null)}, ${sq(u.role === "admin" ? "admin" : "user")}, ${sq(legacyUsername(u.username))}, ${created}, ${created});`,
    // Skipped when the email already belonged to an account here (the user insert was ignored).
    `INSERT OR IGNORE INTO account (id, account_id, provider_id, user_id, password, created_at, updated_at) SELECT ${id}, ${id}, 'credential', ${id}, ${sq(hash)}, ${created}, ${created} WHERE EXISTS (SELECT 1 FROM "user" WHERE id = ${id});`,
  );
}

for (const d of departments) {
  statements.push(
    `INSERT OR IGNORE INTO departments (name, short_name) VALUES (${sq(d.name)}, ${sq(d.shortName)});`,
  );
}
for (const c of courses) {
  const d = deptById.get(c.departmentId);
  if (!d) {
    warnings.push(
      `course ${c.id} (${c.name}): unknown department ${c.departmentId}, skipped`,
    );
    continue;
  }
  statements.push(
    `INSERT OR IGNORE INTO courses (name, department_id) VALUES (${sq(c.name)}, ${deptExpr(d)});`,
  );
}
for (const s of semesters)
  statements.push(
    `INSERT OR IGNORE INTO semesters (name) VALUES (${sq(s.name)});`,
  );
for (const e of examTypes)
  statements.push(
    `INSERT OR IGNORE INTO exam_types (name) VALUES (${sq(e.name)});`,
  );

// Legacy questions have no timestamp of their own: use their oldest submission's.
const firstSubmittedAt = new Map();
for (const s of submissions) {
  const prev = firstSubmittedAt.get(s.question.id);
  if (prev === undefined || s.createdAt < prev)
    firstSubmittedAt.set(s.question.id, s.createdAt);
}
const questionExpr = (q) =>
  `(SELECT id FROM questions WHERE course_id = ${courseExpr(q.department, q.course.name)} AND semester_id = ${semesterExpr(q.semester.name)} AND exam_type_id = ${examTypeExpr(q.examType.name)})`;

for (const q of questions) {
  const created = ms(firstSubmittedAt.get(q.id));
  // The legacy view count is the sum over the question's papers, the closest thing it has
  // to question page views.
  statements.push(
    `INSERT OR IGNORE INTO questions (department_id, course_id, semester_id, exam_type_id, view_count, created_at, updated_at) VALUES (${deptExpr(q.department)}, ${courseExpr(q.department, q.course.name)}, ${semesterExpr(q.semester.name)}, ${examTypeExpr(q.examType.name)}, ${q.viewCount}, ${created}, ${created});`,
  );
}

/** Proposed classification of an upload: existing ids where the names match, else custom names. */
function proposedClassification(s) {
  const dept = departments.find(
    (d) =>
      norm(d.name) === norm(s.departmentName) ||
      norm(d.shortName) === norm(s.departmentName),
  );
  const course =
    dept &&
    courses.find(
      (c) => c.departmentId === dept.id && norm(c.name) === norm(s.courseName),
    );
  const semester = semesters.find((x) => norm(x.name) === norm(s.semesterName));
  const examType = examTypes.find((x) => norm(x.name) === norm(s.examTypeName));
  if (
    !examType ||
    !s.departmentName?.trim() ||
    !s.courseName?.trim() ||
    !s.semesterName?.trim()
  ) {
    return null;
  }
  return {
    department_id: dept ? deptExpr(dept) : "NULL",
    custom_department_name: dept ? "NULL" : sq(s.departmentName.trim()),
    course_id: course ? courseExpr(dept, course.name) : "NULL",
    custom_course_name: course ? "NULL" : sq(s.courseName.trim()),
    semester_id: semester ? semesterExpr(semester.name) : "NULL",
    custom_semester_name: semester ? "NULL" : sq(s.semesterName.trim()),
    exam_type_id: examTypeExpr(examType.name),
  };
}

const imported = [];
for (const p of newPapers) {
  const email =
    p.kind === "published"
      ? emailByUserId.get(p.contributor?.id)
      : emailByUserId.get(p.userId);
  const created = ms(p.createdAt);
  const columns = {
    status: sq(p.newStatus),
    file_key: sq(p.fileKey),
    file_size: p.fileSize,
    uploader_id: email ? userExpr(email) : "NULL",
    view_count: p.kind === "published" ? p.viewCount : (p.legacyViews ?? 0),
    section: sq(detail(p.section)),
    batch: sq(detail(p.batch)),
    created_at: created,
    updated_at: created,
  };
  if (p.kind === "published") {
    const q = questionById.get(p.question.id);
    if (!q) {
      warnings.push(`${p.ref}: unknown question ${p.question.id}, skipped`);
      continue;
    }
    columns.question_id = questionExpr(q);
  } else {
    const classification = proposedClassification(p);
    if (!classification) {
      warnings.push(
        `${p.ref}: incomplete classification or unknown exam type "${p.examTypeName}", skipped`,
      );
      continue;
    }
    Object.assign(columns, classification);
  }
  imported.push(p);
  statements.push(
    `INSERT OR IGNORE INTO submissions (${Object.keys(columns).join(", ")}) VALUES (${Object.values(columns).join(", ")});`,
  );
}

// Like an upload here (createSubmission): an upload whose values all exist is filed
// under its question straight away. Only uploads proposing a new name stay a
// proposal, since the admin page can only publish filed submissions.
const fullyExisting = `question_id IS NULL AND department_id IS NOT NULL AND course_id IS NOT NULL AND semester_id IS NOT NULL`;
const sameQuestion = `q.course_id = submissions.course_id AND q.semester_id = submissions.semester_id AND q.exam_type_id = submissions.exam_type_id`;
statements.push(
  `INSERT OR IGNORE INTO questions (department_id, course_id, semester_id, exam_type_id) SELECT DISTINCT department_id, course_id, semester_id, exam_type_id FROM submissions WHERE ${fullyExisting};`,
  `UPDATE submissions SET question_id = (SELECT q.id FROM questions q WHERE ${sameQuestion}), department_id = NULL, course_id = NULL, semester_id = NULL, exam_type_id = NULL WHERE ${fullyExisting};`,
);

const sqlFile = path.join(cacheDir, "import.sql");
writeFileSync(sqlFile, `${statements.join("\n")}\n`);
console.log(
  `Writing ${statements.length} statements to ${remote ? "remote" : "local"} D1 …`,
);
// Not printed: wrangler reports one result object per statement. Not parsed either: with
// --remote, upload progress comes before the JSON.
wrangler(
  ["d1", "execute", "DB", target, "--yes", "--json", "--file", sqlFile],
  {
    output: "quiet",
  },
);

// ---------------------------------------------------------------------------- report

// INSERT OR IGNORE skips rows silently (e.g. a lookup that found nothing), so check.
const present = new Set(
  d1Query(`SELECT file_key FROM submissions`).map((r) => r.file_key),
);
for (const p of imported) {
  if (!present.has(p.fileKey))
    warnings.push(
      `${p.ref}: row was not inserted (question or classification lookup failed)`,
    );
}
const [counts] = d1Query(
  `SELECT (SELECT count(*) FROM "user" WHERE id LIKE 'legacy-%') AS users,
          (SELECT count(*) FROM questions) AS questions,
          (SELECT count(*) FROM submissions WHERE status = 'published') AS published,
          (SELECT count(*) FROM submissions WHERE status = 'pending_review') AS pending,
          (SELECT count(*) FROM submissions WHERE status = 'rejected') AS rejected`,
);

if (warnings.length > 0) {
  console.warn(`\n${warnings.length} warnings:`);
  for (const w of warnings) console.warn(`  - ${w}`);
}
console.log(
  `\nDone (${remote ? "remote" : "local"}). Rows now present: ${counts.users} users, ` +
    `${counts.published} published, ${counts.pending} pending and ${counts.rejected} rejected submissions; ` +
    `${counts.questions} questions in total.`,
);
