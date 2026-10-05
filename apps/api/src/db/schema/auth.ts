// Tables required by Better Auth. Keep in sync with its core schema when upgrading
// (compare against `npx auth@latest generate` output).
import { USER_ROLES } from "@ourdiu/shared";
import { sql } from "drizzle-orm";
import { index, integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

const timestamps = {
  createdAt: integer({ mode: "timestamp_ms" })
    .notNull()
    .default(sql`(cast(unixepoch('subsecond') * 1000 as integer))`),
  updatedAt: integer({ mode: "timestamp_ms" })
    .notNull()
    .default(sql`(cast(unixepoch('subsecond') * 1000 as integer))`)
    .$onUpdate(() => new Date()),
};

export const user = sqliteTable(
  "user",
  {
    id: text().primaryKey(),
    name: text().notNull(),
    email: text().notNull().unique(),
    emailVerified: integer({ mode: "boolean" }).notNull().default(false),
    image: text(),
    /** Declared as an additional field in `lib/auth.ts`; users can't set it themselves. */
    role: text({ enum: USER_ROLES }).notNull().default("user"),
    /**
     * Public handle in contributor URLs (`/questions/contributors/<username>`), lowercase, see
     * USERNAME_PATTERN. Set for every user (at sign-up, or by migration 0003); nullable
     * only because SQLite can't add a NOT NULL column without rebuilding the table.
     */
    username: text().unique(),
    /**
     * Optional, kept private (STUDENT_ID_PATTERN). Set through /api/v1/me/student-id, or
     * taken from the Google name at sign-up (`splitStudentId`).
     */
    studentId: text(),
    // Published papers and their views, kept in sync from submissions by triggers
    // (migration 0006) for the contributor pages; never write them from application code.
    publishedSubmissionCount: integer().notNull().default(0),
    publishedViewCount: integer().notNull().default(0),
    ...timestamps,
  },
  (t) => [
    // Contributors, the most published first.
    index("user_published_submission_count_name_idx").on(
      t.publishedSubmissionCount,
      t.name,
    ),
  ],
);

export const session = sqliteTable(
  "session",
  {
    id: text().primaryKey(),
    expiresAt: integer({ mode: "timestamp_ms" }).notNull(),
    token: text().notNull().unique(),
    ipAddress: text(),
    userAgent: text(),
    userId: text()
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    ...timestamps,
  },
  (t) => [index("session_user_id_idx").on(t.userId)],
);

export const account = sqliteTable(
  "account",
  {
    id: text().primaryKey(),
    accountId: text().notNull(),
    providerId: text().notNull(),
    userId: text()
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    accessToken: text(),
    refreshToken: text(),
    idToken: text(),
    accessTokenExpiresAt: integer({ mode: "timestamp_ms" }),
    refreshTokenExpiresAt: integer({ mode: "timestamp_ms" }),
    scope: text(),
    password: text(),
    ...timestamps,
  },
  (t) => [index("account_user_id_idx").on(t.userId)],
);

export const verification = sqliteTable(
  "verification",
  {
    id: text().primaryKey(),
    identifier: text().notNull(),
    value: text().notNull(),
    expiresAt: integer({ mode: "timestamp_ms" }).notNull(),
    ...timestamps,
  },
  (t) => [index("verification_identifier_idx").on(t.identifier)],
);
