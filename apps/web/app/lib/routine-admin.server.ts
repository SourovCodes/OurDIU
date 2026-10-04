import type {
  AdminRoutineVersionDetail,
  ApiError,
  RoutineFileProblem,
} from "@ourdiu/shared";
import { data, redirect } from "react-router";
import {
  isPdfFile,
  versionUrl,
  type UploadResult,
} from "~/components/admin/routine";
import { adminRequest } from "./admin.server";
import { apiFetch, readJson } from "./api.server";

function uploadFailed(error: string, problems: RoutineFileProblem[] = []) {
  return data<UploadResult>(
    { ok: false, intent: "upload", error, problems },
    { status: 422 },
  );
}

/** Sends DIU's routine PDF to the API, to be read there. */
function sendPdf(request: Request, file: File) {
  const body = new FormData();
  body.set("file", file);
  return apiFetch(request, "/api/v1/admin/routine/versions/pdf", {
    method: "POST",
    body,
  });
}

/**
 * Sends an uploaded routine PDF or file to the API and opens the draft's review, or
 * answers with the problems found.
 */
async function uploadVersion(request: Request, form: FormData) {
  const file = form.get("file");
  if (!(file instanceof File) || file.size === 0) {
    return uploadFailed("Choose the routine’s PDF or file.");
  }
  let res: Response;
  if (isPdfFile(file)) {
    res = await sendPdf(request, file);
  } else {
    const text = await file.text();
    try {
      JSON.parse(text);
    } catch (err) {
      return uploadFailed(
        `This file isn't valid JSON: ${err instanceof Error ? err.message : String(err)}`,
      );
    }
    res = await apiFetch(request, "/api/v1/admin/routine/versions", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: text,
    });
  }
  if (res.status === 201) {
    const version = await readJson<AdminRoutineVersionDetail>(res);
    return redirect(versionUrl(version.id));
  }
  const body = await readJson<ApiError>(res).catch(() => null);
  const problems =
    body?.error.code === "INVALID_ROUTINE_FILE"
      ? (body.error.details as RoutineFileProblem[])
      : [];
  return uploadFailed(
    body?.error.message ?? "Something went wrong. Please try again.",
    problems,
  );
}

/** The routine admin pages' actions: upload, make live, delete a version. */
export async function routineAdminAction(request: Request) {
  const form = await request.formData();
  const intent = String(form.get("intent"));
  const id = Number(form.get("id"));
  switch (intent) {
    case "upload":
      return uploadVersion(request, form);
    case "live":
      return adminRequest(
        request,
        intent,
        "POST",
        `/routine/versions/${id}/live`,
      );
    case "delete": {
      const result = await adminRequest(
        request,
        intent,
        "DELETE",
        `/routine/versions/${id}`,
      );
      // From its own review page, a deleted version leads back to the list.
      return result.data.ok && form.get("from") === "review"
        ? redirect("/admin/routine/versions")
        : result;
    }
    default:
      throw data("Unknown intent", { status: 400 });
  }
}
