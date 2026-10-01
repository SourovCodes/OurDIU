import { sql } from "drizzle-orm";
import { user } from "./schema";

/**
 * A user's username for URLs. Every user has one (set at sign-up or by migration
 * 0003); the id stands in for a row inserted without one, and contributor lookups
 * accept either.
 */
export const usernameOf = sql<string>`coalesce(${user.username}, ${user.id})`;
