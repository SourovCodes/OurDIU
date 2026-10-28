import type { AdminRooms, CreateRoomReportInput } from "@ourdiu/shared";
import { and, desc, eq, sql } from "drizzle-orm";
import { alias } from "drizzle-orm/sqlite-core";
import type { Database } from "../../db/client";
import { courses, roomBans, roomReports, user } from "../../db/schema";
import { AppError } from "../../lib/errors";
import { readUsage, roomLimits, roomsPausedByAdmin, usageCycle } from "./usage";

export async function isRoomBanned(db: Database, userId: string) {
  const [row] = await db
    .select({ userId: roomBans.userId })
    .from(roomBans)
    .where(eq(roomBans.userId, userId));
  return !!row;
}

export async function courseExists(db: Database, courseId: number) {
  const [row] = await db
    .select({ id: courses.id })
    .from(courses)
    .where(eq(courses.id, courseId));
  return !!row;
}

export async function createRoomReport(
  db: Database,
  courseId: number,
  reporterId: string,
  input: CreateRoomReportInput,
) {
  if (input.userId === reporterId) {
    throw new AppError(422, "VALIDATION_ERROR", "You can't report yourself");
  }
  if (!(await courseExists(db, courseId))) {
    throw new AppError(404, "NOT_FOUND", "Course not found");
  }
  const [reported] = await db
    .select({ id: user.id })
    .from(user)
    .where(eq(user.id, input.userId));
  if (!reported) throw new AppError(404, "NOT_FOUND", "User not found");
  const [row] = await db
    .insert(roomReports)
    .values({
      courseId,
      reporterId,
      reportedUserId: input.userId,
      reason: input.reason,
      message: input.message ?? null,
    })
    .returning({ id: roomReports.id });
  return { id: row!.id };
}

const MAX_LISTED = 100;

const reporter = alias(user, "reporter");
const reported = alias(user, "reported");

function userRef(t: typeof user | typeof reporter | typeof reported) {
  return {
    id: t.id,
    username: sql<string>`coalesce(${t.username}, ${t.id})`,
    name: t.name,
    email: t.email,
    image: t.image,
  };
}

/** The admin's Course rooms page: this cycle's usage, open reports and bans. */
export async function listAdminRooms(
  db: Database,
  env: Env,
): Promise<AdminRooms> {
  const limits = roomLimits(env);
  const { start, next } = usageCycle(new Date(), limits.cycleDay);
  const [usage, paused, reports, bans] = await Promise.all([
    readUsage(db, start),
    roomsPausedByAdmin(db),
    db
      .select({
        id: roomReports.id,
        course: { id: courses.id, name: courses.name },
        reporter: userRef(reporter),
        reported: userRef(reported),
        reason: roomReports.reason,
        message: roomReports.message,
        status: roomReports.status,
        banned: sql<number>`exists (select 1 from ${roomBans} where ${roomBans.userId} = ${roomReports.reportedUserId})`,
        createdAt: roomReports.createdAt,
      })
      .from(roomReports)
      .innerJoin(courses, eq(courses.id, roomReports.courseId))
      .innerJoin(reporter, eq(reporter.id, roomReports.reporterId))
      .innerJoin(reported, eq(reported.id, roomReports.reportedUserId))
      .where(eq(roomReports.status, "pending"))
      .orderBy(desc(roomReports.createdAt))
      .limit(MAX_LISTED),
    db
      .select({ user: userRef(user), createdAt: roomBans.createdAt })
      .from(roomBans)
      .innerJoin(user, eq(user.id, roomBans.userId))
      .orderBy(desc(roomBans.createdAt))
      .limit(MAX_LISTED),
  ]);
  return {
    usage: {
      cycle: start,
      resetsOn: next,
      ...usage,
      voiceBytesCap: limits.voiceBytesCap,
      messagesCap: limits.messagesCap,
      paused,
      enabled: limits.enabled,
      voiceAvailable: limits.voiceAvailable,
    },
    reports: reports.map((r) => ({
      ...r,
      banned: !!r.banned,
      createdAt: r.createdAt.toISOString(),
    })),
    bans: bans.map((b) => ({ ...b, createdAt: b.createdAt.toISOString() })),
  };
}

export async function updateRoomReport(
  db: Database,
  id: number,
  status: "resolved" | "dismissed",
) {
  const [row] = await db
    .update(roomReports)
    .set({ status })
    .where(and(eq(roomReports.id, id), eq(roomReports.status, "pending")))
    .returning({ id: roomReports.id });
  if (!row) throw new AppError(404, "NOT_FOUND", "No open report with that id");
}

export async function banFromRooms(db: Database, userId: string, by: string) {
  const [target] = await db
    .select({ id: user.id })
    .from(user)
    .where(eq(user.id, userId));
  if (!target) throw new AppError(404, "NOT_FOUND", "User not found");
  await db
    .insert(roomBans)
    .values({ userId, bannedBy: by })
    .onConflictDoNothing();
}

export async function unbanFromRooms(db: Database, userId: string) {
  await db.delete(roomBans).where(eq(roomBans.userId, userId));
}
