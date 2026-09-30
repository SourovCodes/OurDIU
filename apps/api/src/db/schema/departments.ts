import { integer, sqliteTable, text } from "drizzle-orm/sqlite-core";
import { timestamps } from "./columns";

/** University departments, shared by every product (routine, question bank, …). */
export const departments = sqliteTable("departments", {
  id: integer().primaryKey({ autoIncrement: true }),
  name: text().notNull(),
  /** Uppercase, e.g. "CSE"; what URLs use. */
  shortName: text().notNull().unique(),
  ...timestamps,
});

export type DepartmentRow = typeof departments.$inferSelect;
