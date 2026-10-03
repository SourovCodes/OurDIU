import type { MergedId, MergedKind } from "@ourdiu/shared";
import { redirect } from "react-router";
import { apiFetch, readJson } from "./api.server";

/**
 * For a page whose entry wasn't found: when an admin merged it into another (a
 * duplicate course, department or the exam it was combined with), throws a permanent
 * redirect to that one's page, keeping the query. Returns when it was never merged.
 */
export async function redirectIfMerged(
  request: Request,
  kind: MergedKind,
  id: string,
  pathOf: (id: number) => string,
) {
  if (!/^\d+$/.test(id)) return;
  const res = await apiFetch(request, `/api/v1/merged/${kind}/${id}`);
  if (!res.ok) return;
  const { mergedInto } = await readJson<MergedId>(res);
  throw redirect(`${pathOf(mergedInto)}${new URL(request.url).search}`, 301);
}
