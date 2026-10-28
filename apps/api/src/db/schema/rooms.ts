// Course rooms (live voice and chat, docs/PLAN.md decision 66). Chat is never
// stored: only usage totals, reports, bans and the admin's pause live here.
import {
  ROOM_REPORT_REASONS,
  ROOM_REPORT_STATUSES,
} from "@ourdiu/shared/rooms";
import { sql } from "drizzle-orm";
import {
  check,
  index,
  integer,
  sqliteTable,
  text,
} from "drizzle-orm/sqlite-core";
import { user } from "./auth";
import { timestamps } from "./columns";
import { courses } from "./taxonomy";

/**
 * Estimated use of the free allowances per usage cycle (`cycle`: its first day,
 * YYYY-MM-DD), added to about once a minute by each active room
 * (services/rooms/usage.ts). Rooms pause when a cycle reaches its cap.
 */
export const roomUsage = sqliteTable("room_usage", {
  cycle: text().primaryKey(),
  /** SFU egress, estimated from who was unmuted and how many listened. */
  voiceBytes: integer().notNull().default(0),
  /** Person-seconds in voice calls. */
  voiceSeconds: integer().notNull().default(0),
  /** WebSocket messages the rooms received (each a fraction of a DO request). */
  messages: integer().notNull().default(0),
  ...timestamps,
});

/** One row (id 1): whether an admin paused every room. */
export const roomSettings = sqliteTable(
  "room_settings",
  {
    id: integer().primaryKey(),
    paused: integer({ mode: "boolean" }).notNull().default(false),
    ...timestamps,
  },
  (t) => [check("room_settings_single_row", sql`${t.id} = 1`)],
);

/** People an admin keeps out of every room. */
export const roomBans = sqliteTable("room_bans", {
  userId: text()
    .primaryKey()
    .references(() => user.id, { onDelete: "cascade" }),
  bannedBy: text().references(() => user.id, { onDelete: "set null" }),
  ...timestamps,
});

/** A report about someone in a room, for admins. */
export const roomReports = sqliteTable(
  "room_reports",
  {
    id: integer().primaryKey({ autoIncrement: true }),
    courseId: integer()
      .notNull()
      .references(() => courses.id, { onDelete: "cascade" }),
    reporterId: text()
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    reportedUserId: text()
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    reason: text({ enum: ROOM_REPORT_REASONS }).notNull(),
    /** The one message reported, as the reporter saw it; chat is otherwise not kept. */
    message: text(),
    status: text({ enum: ROOM_REPORT_STATUSES }).notNull().default("pending"),
    ...timestamps,
  },
  (t) => [
    index("room_reports_status_idx").on(t.status, t.createdAt),
    index("room_reports_reported_user_id_idx").on(t.reportedUserId),
    index("room_reports_reporter_id_idx").on(t.reporterId),
    index("room_reports_course_id_idx").on(t.courseId),
  ],
);
