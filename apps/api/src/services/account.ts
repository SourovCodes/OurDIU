import type { Profile } from "@ourdiu/shared";
import { and, eq, ne } from "drizzle-orm";
import type { Database } from "../db/client";
import { user } from "../db/schema";
import { AppError } from "../lib/errors";

/** The signed-in user's profile. */
export async function getProfile(
  db: Database,
  userId: string,
): Promise<Profile> {
  const [row] = await db
    .select({
      id: user.id,
      name: user.name,
      email: user.email,
      username: user.username,
      image: user.image,
      role: user.role,
    })
    .from(user)
    .where(eq(user.id, userId));
  if (!row) throw new AppError(404, "NOT_FOUND", "User not found");
  // Every user gets one at sign-up; the column is only nullable for SQLite's sake.
  return { ...row, username: row.username ?? "" };
}

const usernameTaken = () =>
  new AppError(409, "USERNAME_TAKEN", "Someone already has that username");

/** Changes a user's username (already validated and lowercased). */
export async function updateUsername(
  db: Database,
  userId: string,
  username: string,
): Promise<string> {
  const [taken] = await db
    .select({ id: user.id })
    .from(user)
    .where(and(eq(user.username, username), ne(user.id, userId)));
  if (taken) throw usernameTaken();
  try {
    const updated = await db
      .update(user)
      .set({ username })
      .where(eq(user.id, userId))
      .returning({ id: user.id });
    if (updated.length === 0) {
      throw new AppError(404, "NOT_FOUND", "User not found");
    }
  } catch (err) {
    // Taken by someone else in the meantime: the unique index wins.
    if (String(err).includes("UNIQUE constraint failed")) throw usernameTaken();
    throw err;
  }
  return username;
}
