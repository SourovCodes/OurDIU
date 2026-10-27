import { integer, sqliteTable, text } from "drizzle-orm/sqlite-core";
import { timestamps } from "./columns";

/**
 * Purges of Cloudflare's shared copies still to make (services/cache.ts): one it
 * refused (its rate limit), or an old file to delete once no copy links to it. The
 * five-minute cron makes one purge for all of them, then deletes the files.
 */
export const pendingCachePurges = sqliteTable("pending_cache_purges", {
  id: integer().primaryKey({ autoIncrement: true }),
  tag: text().notNull(),
  /** An R2 key to delete after the purge (a watermarked copy made again). */
  fileKey: text(),
  createdAt: timestamps.createdAt,
});
