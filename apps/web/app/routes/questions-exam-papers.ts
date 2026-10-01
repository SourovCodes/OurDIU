import type { QuestionList } from "@ourdiu/shared";
import { apiFetch, readJson } from "~/lib/api.server";
import type { Route } from "./+types/questions-exam-papers";

/**
 * How many papers an exam (course, semester and exam type) already has, for the
 * contribute form: "This exam already has 2 papers". Null when it has none yet.
 */
export async function loader({ request }: Route.LoaderArgs) {
  const url = new URL(request.url);
  const query = new URLSearchParams({ pageSize: "1" });
  for (const key of ["courseId", "semesterId", "examTypeId"]) {
    const value = url.searchParams.get(key);
    if (!value) return Response.json(null);
    query.set(key, value);
  }
  const res = await apiFetch(request, `/api/v1/questions?${query}`);
  if (!res.ok) return Response.json(null);
  const [question] = (await readJson<QuestionList>(res)).items;
  return Response.json(
    question
      ? { id: question.id, published: question.submissionCounts.published }
      : null,
  );
}
