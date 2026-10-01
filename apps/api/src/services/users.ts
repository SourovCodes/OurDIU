import type {
  AdminUser,
  AdminUserList,
  ListAdminUsersQuery,
  UserRole,
} from "@ourdiu/shared";
import { and, count, desc, eq, isNotNull, or, sql } from "drizzle-orm";
import type { Database } from "../db/client";
import { usernameOf } from "../db/username";
import { submissions, user } from "../db/schema";
import { AppError } from "../lib/errors";
import { countWhereStatus } from "./common";

/** Users with their per-status submission counts (zero when they have none). */
function selectUsers(db: Database) {
  const counts = db
    .select({
      uploaderId: submissions.uploaderId,
      published: countWhereStatus("published").as("published_count"),
      pendingReview: countWhereStatus("pending_review").as(
        "pending_review_count",
      ),
      rejected: countWhereStatus("rejected").as("rejected_count"),
    })
    .from(submissions)
    .where(isNotNull(submissions.uploaderId))
    .groupBy(submissions.uploaderId)
    .as("uploader_counts");

  const orZero = (column: typeof counts.published) =>
    sql<number>`coalesce(${column}, 0)`.mapWith(Number);

  return db
    .select({
      id: user.id,
      username: usernameOf,
      name: user.name,
      email: user.email,
      image: user.image,
      role: user.role,
      createdAt: user.createdAt,
      submissionCounts: {
        published: orZero(counts.published),
        pendingReview: orZero(counts.pendingReview),
        rejected: orZero(counts.rejected),
      },
    })
    .from(user)
    .leftJoin(counts, eq(counts.uploaderId, user.id))
    .$dynamic();
}

type UserRow = Awaited<ReturnType<typeof selectUsers>>[number];

const toAdminUser = (row: UserRow): AdminUser => ({
  ...row,
  createdAt: row.createdAt.toISOString(),
});

/** Escapes LIKE wildcards so a search for "50%" matches literally. */
const likePattern = (text: string) =>
  `%${text.toLowerCase().replace(/[\\%_]/g, (c) => `\\${c}`)}%`;

/** Users, newest first, optionally filtered by name/email and role. */
export async function listAdminUsers(
  db: Database,
  query: ListAdminUsersQuery,
): Promise<AdminUserList> {
  const pattern = query.q ? likePattern(query.q) : null;
  const where = and(
    pattern
      ? or(
          sql`lower(${user.name}) like ${pattern} escape '\\'`,
          sql`${user.username} like ${pattern} escape '\\'`,
          sql`lower(${user.email}) like ${pattern} escape '\\'`,
        )
      : undefined,
    query.role ? eq(user.role, query.role) : undefined,
  );

  const [rows, [totals]] = await Promise.all([
    selectUsers(db)
      .where(where)
      .orderBy(desc(user.createdAt), desc(user.id))
      .limit(query.pageSize)
      .offset((query.page - 1) * query.pageSize),
    db.select({ total: count() }).from(user).where(where),
  ]);

  return {
    items: rows.map(toAdminUser),
    page: query.page,
    pageSize: query.pageSize,
    total: totals?.total ?? 0,
  };
}

/** Grants or removes admin rights. Admins can't change their own role. */
export async function updateUserRole(
  db: Database,
  actorId: string,
  id: string,
  role: UserRole,
): Promise<AdminUser> {
  if (actorId === id) {
    throw new AppError(409, "CONFLICT", "You can't change your own role");
  }
  const updated = await db
    .update(user)
    .set({ role })
    .where(eq(user.id, id))
    .returning({ id: user.id });
  if (updated.length === 0) {
    throw new AppError(404, "NOT_FOUND", "User not found");
  }
  const [row] = await selectUsers(db).where(eq(user.id, id)).limit(1);
  return toAdminUser(row!);
}
