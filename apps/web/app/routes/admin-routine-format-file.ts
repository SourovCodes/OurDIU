import { data } from "react-router";
import { ROUTINE_EXAMPLE } from "~/lib/routine-format";
import { routineFileJsonSchema } from "~/lib/routine-format.server";
import { requireAdmin } from "~/lib/session.server";
import type { Route } from "./+types/admin-routine-format-file";

/** /admin/routine/format/schema.json and example.json, as downloads. */
export async function loader({ request, params }: Route.LoaderArgs) {
  await requireAdmin(request);
  const body =
    params.file === "schema.json"
      ? routineFileJsonSchema()
      : params.file === "example.json"
        ? ROUTINE_EXAMPLE
        : null;
  if (!body) throw data("Not found", { status: 404 });
  return new Response(JSON.stringify(body, null, 2), {
    headers: {
      "content-type": "application/json; charset=utf-8",
      "content-disposition": `attachment; filename="routine-${params.file}"`,
      "cache-control": "private, no-store",
    },
  });
}
