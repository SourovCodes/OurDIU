import type {
  AdminUser,
  AdminUserList,
  ListAdminUsersQuery,
  UserRole,
} from "@ourdiu/shared";
import { and, count, desc, eq, or, sql } from "drizzle-orm";
import type { Database } from "../db/client";
import { user } from "../db/schema";
import { AppError } from "../lib/errors";

const userColumns = {
  id: user.id,
  username: sql<string>`coalesce(${user.username}, '')`,
  name: user.name,
  email: user.email,
  image: user.image,
  role: user.role,
  createdAt: user.createdAt,
};

type UserRow = Omit<AdminUser, "createdAt"> & { createdAt: Date };

const toAdminUser = (row: UserRow): AdminUser => ({
  ...row,
  createdAt: row.createdAt.toISOString(),
});

/** Escapes LIKE wildcards so a search for "50%" matches literally. */
export const likePattern = (text: string) =>
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
    db
      .select(userColumns)
      .from(user)
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
  const [row] = await db
    .update(user)
    .set({ role })
    .where(eq(user.id, id))
    .returning(userColumns);
  if (!row) throw new AppError(404, "NOT_FOUND", "User not found");
  return toAdminUser(row);
}
