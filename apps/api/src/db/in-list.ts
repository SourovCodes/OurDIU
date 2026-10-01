import { type Column, sql } from "drizzle-orm";

/**
 * `column IN (...values)` with the list sent as one JSON parameter. D1 allows at most
 * 100 bound parameters per query, which drizzle's `inArray` reaches with a long list
 * (one parameter per value), and local D1 doesn't enforce the limit, so tests pass.
 */
export function inList(column: Column, values: readonly (string | number)[]) {
  return sql`${column} in (select value from json_each(${JSON.stringify(values)}))`;
}
