import { sql } from "drizzle-orm";
import { integer } from "drizzle-orm/sqlite-core";

const nowMs = sql`(cast(unixepoch('subsecond') * 1000 as integer))`;

export const timestamps = {
  createdAt: integer({ mode: "timestamp_ms" }).notNull().default(nowMs),
  updatedAt: integer({ mode: "timestamp_ms" })
    .notNull()
    .default(nowMs)
    .$onUpdate(() => new Date()),
};
