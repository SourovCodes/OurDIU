// Fills in the Class Routine's teachers' designations ("Associate Professor", for
// cover pages: docs/PLAN.md, decision 39) from DIU's faculty directory,
// faculty.daffodilvarsity.edu.bd. The directory has no initials, so a teacher is
// matched by email, else by name (only when exactly one person in the directory has
// it). Also fills an email that's missing. Never overwrites what an admin typed.
// Personal cell numbers are left out.
// Usage: pnpm teacher-designations [--remote] [--apply]
//   Lists the matches; --apply saves them (local D1 unless --remote is given).
//   Pages are kept in a cache folder, so --apply doesn't read the site again.
import { ROUTINE_DEPARTMENT_SLUGS } from "@ourdiu/shared/constants";
import { execFileSync } from "node:child_process";
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

const args = process.argv.slice(2);
const remote = args.includes("--remote");
const apply = args.includes("--apply");

const SITE = "https://faculty.daffodilvarsity.edu.bd";
const CACHE = path.join(tmpdir(), "ourdiu-faculty-directory");
mkdirSync(CACHE, { recursive: true });

function d1(...command: string[]) {
  return execFileSync(
    "pnpm",
    [
      "exec",
      "wrangler",
      "d1",
      "execute",
      "DB",
      remote ? "--remote" : "--local",
      ...command,
    ],
    {
      // Where the Worker's config (and its local state) lives.
      cwd: path.join(import.meta.dirname, "../../web"),
      encoding: "utf8",
      stdio: ["ignore", "pipe", "inherit"],
    },
  );
}

/** A page of the directory, from the cache when it's there. */
async function page(url: string) {
  const file = path.join(CACHE, url.slice(SITE.length).replace(/\W/g, "_"));
  if (existsSync(file)) return readFileSync(file, "utf8");
  const res = await fetch(url, {
    headers: { "user-agent": "OurDIU (ourdiu.com) teacher designations" },
  });
  const html = res.ok ? await res.text() : "";
  writeFileSync(file, html);
  // Gently: one page at a time.
  await new Promise((r) => setTimeout(r, 150));
  return html;
}

const decode = (s: string) =>
  s
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&#0?39;|&rsquo;/g, "'")
    .replace(/\s+/g, " ")
    .trim();

type Person = {
  name: string;
  designation: string;
  profile: string;
  email?: string;
};

/** Everyone a department's pages list (20 a page), with their designation. */
async function department(slug: string): Promise<Person[]> {
  const people: Person[] = [];
  for (let offset = 0; ; offset += 20) {
    const html = await page(
      offset
        ? `${SITE}/teachers/${slug}/${offset}`
        : `${SITE}/teachers/${slug}.html`,
    );
    const found = [
      ...html.matchAll(
        /<a class="fox" href="([^"]+)">([\s\S]*?)<\/a><\/h3>[\s\S]*?<h4>([\s\S]*?)<\/h4>/g,
      ),
    ].map(([, profile, name, designation]) => ({
      profile: profile!,
      name: decode(name!),
      designation: decode(designation!),
    }));
    const fresh = found.filter(
      (p) => !people.some((q) => q.profile === p.profile),
    );
    if (fresh.length === 0) return people;
    people.push(...fresh);
  }
}

/** The department pages' slugs, from the directory's front page. */
async function departments() {
  const html = await page(`${SITE}/`);
  return [
    ...new Set(
      [...html.matchAll(/\/teachers\/([a-z0-9-]+)\.html/g)].map((m) => m[1]!),
    ),
  ];
}

/** "Professor Dr. Md. Fokhray Hossain" and "Md Fokhray Hossain, PhD" alike. */
const nameKey = (name: string) =>
  name
    .toLowerCase()
    .replace(/[.,()]/g, " ")
    .split(/\s+/)
    .filter(
      (w) =>
        w &&
        ![
          "prof",
          "professor",
          "dr",
          "mr",
          "mrs",
          "ms",
          "miss",
          "engr",
          "phd",
          "md",
          "mohammad",
          "mohammed",
          "muhammad",
        ].includes(w),
    )
    .join(" ");

const slugs = await departments();
const directory: Person[] = [];
for (const slug of slugs) {
  // A faculty's dean is listed on each of its departments' pages: count them once.
  for (const person of await department(slug)) {
    if (!directory.some((p) => p.profile === person.profile))
      directory.push(person);
  }
}
// Emails are only on profile pages: read those of the routines' departments.
for (const person of directory) {
  if (
    !ROUTINE_DEPARTMENT_SLUGS.some((d) =>
      person.profile.includes(`/profile/${d}/`),
    )
  )
    continue;
  const html = await page(person.profile);
  const email = html.match(
    /E-mail<\/div>\s*<div class="profile-row-right">\s*([^<\s]+@[^<\s]+)/,
  )?.[1];
  if (email) person.email = email.toLowerCase();
  const designation = html.match(
    /Designation\s*<\/div>\s*<div class="profile-row-right">([\s\S]*?)<\/div>/,
  )?.[1];
  if (designation && decode(designation))
    person.designation = decode(designation);
}
console.log(
  `Directory: ${directory.length} teachers in ${slugs.length} departments.\n`,
);

const byEmail = new Map(
  directory.flatMap((p) => (p.email ? [[p.email, p] as const] : [])),
);
const byName = new Map<string, Person[]>();
for (const p of directory) {
  const key = nameKey(p.name);
  byName.set(key, [...(byName.get(key) ?? []), p]);
}

const teachers = (
  JSON.parse(
    d1(
      "--json",
      "--command",
      "SELECT department, initials, name, email FROM routine_teachers WHERE designation IS NULL ORDER BY department, initials",
    ),
  ) as {
    results: {
      department: string;
      initials: string;
      name: string;
      email: string | null;
    }[];
  }[]
)[0]!.results;

const quote = (value: string) => `'${value.replaceAll("'", "''")}'`;
/** How many letters differ, for names spelt slightly differently. */
function distance(a: string, b: string) {
  let row = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    const next = [i];
    for (let j = 1; j <= b.length; j++)
      next[j] = Math.min(
        row[j]! + 1,
        next[j - 1]! + 1,
        row[j - 1]! + (a[i - 1] === b[j - 1] ? 0 : 1),
      );
    row = next;
  }
  return row[b.length]!;
}

/**
 * One person from several listings: their own department's, else one when they're
 * all the same (a faculty's dean has a profile on each of its departments' pages).
 */
function one(people: Person[], department: string) {
  const slug = department.toLowerCase();
  const own = people.filter((p) => p.profile.includes(`/profile/${slug}/`));
  if (own.length === 1) return own[0];
  return new Set(people.map((p) => p.designation)).size === 1
    ? people[0]
    : undefined;
}

const unmatched: string[] = [];
const updates = teachers.flatMap((t) => {
  const email = t.email?.trim().toLowerCase();
  const key = nameKey(t.name);
  const named = byName.get(key) ?? [];
  // A letter off ("Talulder", "Talukder"): longer names, in their own department.
  const own = `/profile/${t.department.toLowerCase()}/`;
  const close =
    named.length || key.length < 15
      ? []
      : [...byName].flatMap(([k, people]) =>
          distance(k, key) === 1
            ? people.filter((p) => p.profile.includes(own))
            : [],
        );
  const byMail = email ? byEmail.get(email) : undefined;
  const match =
    byMail ??
    (named.length ? one(named, t.department) : one(close, t.department));
  if (!match || !match.designation) {
    const others = named.length || close.length;
    unmatched.push(
      `${t.department} ${t.initials}  ${t.name}${others > 1 ? `  (${others} different people of that name)` : ""}`,
    );
    return [];
  }
  const how = byMail ? "email" : named.length ? "name" : "close name";
  const addEmail = !t.email && match.email;
  console.log(
    `${t.department} ${t.initials.padEnd(5)} ${t.name}  →  ${match.designation}` +
      `${addEmail ? `, ${match.email}` : ""}  (by ${how}${byMail ? "" : `: ${match.name}`})`,
  );
  // Guarded, in case an admin filled it in the meantime.
  return [
    `UPDATE routine_teachers SET designation = ${quote(match.designation)}` +
      `${addEmail ? `, email = COALESCE(email, ${quote(match.email!)})` : ""}` +
      ` WHERE department = ${quote(t.department)} AND initials = ${quote(t.initials)} AND designation IS NULL;`,
  ];
});

if (unmatched.length) {
  console.log(`\nNot found in the directory (${unmatched.length}):`);
  for (const line of unmatched) console.log(`  ${line}`);
}

const where = remote ? "remote" : "local";
if (updates.length === 0) {
  console.log(`\nNo designations to fill in (${where} D1).`);
} else if (!apply) {
  console.log(
    `\n${updates.length} of ${teachers.length} teachers without a designation matched (${where} D1). Run again with --apply to save them.`,
  );
} else {
  const file = path.join(
    mkdtempSync(path.join(tmpdir(), "teacher-designations-")),
    "update.sql",
  );
  writeFileSync(file, updates.join("\n"));
  d1("--yes", "--file", file);
  console.log(`\nFilled in ${updates.length} designations (${where} D1).`);
}
