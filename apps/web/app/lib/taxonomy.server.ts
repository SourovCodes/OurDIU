import type { Taxonomy } from "@ourdiu/shared";
import { apiGetJson } from "./api.server";

/**
 * How long public pages reuse the lists. They only change when an admin edits the
 * catalog, or (department counts) when a paper is published or hidden.
 */
const TTL_MS = 60_000;

// Per Worker isolate, so an edit reaches every isolate within TTL_MS. Holds plain data
// only: never bindings, and never a pending promise, which a request can't await on
// behalf of another one.
let cached: { value: Taxonomy; expires: number } | null = null;

/**
 * Departments, courses, semesters and exam types, for filters and forms: one API call
 * (one D1 round trip), reused for a minute. `fresh` skips the cache, for admins.
 */
export async function loadTaxonomy(
  request: Request,
  { fresh = false }: { fresh?: boolean } = {},
): Promise<Taxonomy> {
  if (!fresh && cached && cached.expires > Date.now()) return cached.value;
  const value = await apiGetJson<Taxonomy>(request, "/api/v1/taxonomy");
  cached = { value, expires: Date.now() + TTL_MS };
  return value;
}

/** After a catalog change, so this isolate's next page shows it straight away. */
export function invalidateTaxonomy() {
  cached = null;
}
