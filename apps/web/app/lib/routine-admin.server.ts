import type {
  AdminRoutineVersionDetail,
  ApiError,
  RoutineFileProblem,
} from "@ourdiu/shared";
import { data, redirect } from "react-router";
import { versionUrl, type UploadResult } from "~/components/admin/routine";
import { adminRequest, formObject } from "./admin.server";
import { apiFetch, readJson } from "./api.server";
import { invalidateRoutineLive } from "./routine.server";

function uploadFailed(error: string, problems: RoutineFileProblem[] = []) {
  return data<UploadResult>(
    { ok: false, intent: "upload", error, problems },
    { status: 422 },
  );
}

/**
 * Sends DIU's routine file (a PDF, or SWE's Excel sheet) to the API, to be read there, and opens the draft's
 * review, or answers with why it can't be used.
 */
async function uploadVersion(request: Request, form: FormData) {
  const file = form.get("file");
  if (!(file instanceof File) || file.size === 0) {
    return uploadFailed("Choose the routine file.");
  }
  const body = new FormData();
  body.set("file", file);
  const version = String(form.get("version") ?? "").trim();
  if (version) body.set("version", version);
  const res = await apiFetch(request, "/api/v1/admin/routine/versions", {
    method: "POST",
    body,
  });
  if (res.status === 201) {
    const version = await readJson<AdminRoutineVersionDetail>(res);
    return redirect(versionUrl(version.id));
  }
  const failed = await readJson<ApiError>(res).catch(() => null);
  const problems =
    failed?.error.code === "INVALID_ROUTINE_FILE"
      ? (failed.error.details as RoutineFileProblem[])
      : [];
  return uploadFailed(
    failed?.error.message ?? "Something went wrong. Please try again.",
    problems,
  );
}

/** The routine admin pages' actions: upload, renumber, make live, delete a version. */
export async function routineAdminAction(request: Request) {
  const form = await request.formData();
  const intent = String(form.get("intent"));
  const id = Number(form.get("id"));
  switch (intent) {
    case "upload":
      return uploadVersion(request, form);
    case "live":
      invalidateRoutineLive();
      return adminRequest(
        request,
        intent,
        "POST",
        `/routine/versions/${id}/live`,
      );
    case "renumber":
      return adminRequest(request, intent, "PATCH", `/routine/versions/${id}`, {
        version: String(form.get("version") ?? "").trim(),
      });
    case "delete": {
      invalidateRoutineLive();
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

/**
 * The course titles' and teachers' pages' actions: give a course its title (or take
 * it away), set a teacher's details (or forget them), one or several at once.
 */
export async function routineCatalogAction(request: Request) {
  const form = await request.formData();
  const intent = String(form.get("intent"));
  const department = encodeURIComponent(String(form.get("department")));
  switch (intent) {
    case "title":
    case "remove-title": {
      const code = encodeURIComponent(String(form.get("code")));
      return intent === "title"
        ? adminRequest(
            request,
            intent,
            "PUT",
            `/routine/courses/${department}/${code}`,
            { title: String(form.get("title") ?? "") },
          )
        : adminRequest(
            request,
            intent,
            "DELETE",
            `/routine/courses/${department}/${code}`,
          );
    }
    case "teacher":
    case "forget-teacher": {
      const initials = encodeURIComponent(String(form.get("initials")));
      const path = `/routine/teachers/${department}/${initials}`;
      return intent === "teacher"
        ? adminRequest(
            request,
            intent,
            "PUT",
            path,
            formObject(form, "intent", "department", "initials"),
          )
        : adminRequest(request, intent, "DELETE", path);
    }
    case "remove-titles":
    case "forget-teachers": {
      // Several at once: one per line.
      const list = String(form.get("list") ?? "")
        .split("\n")
        .filter(Boolean);
      return intent === "remove-titles"
        ? adminRequest(request, intent, "POST", "/routine/courses/remove", {
            department: form.get("department"),
            codes: list,
          })
        : adminRequest(request, intent, "POST", "/routine/teachers/remove", {
            department: form.get("department"),
            initials: list,
          });
    }
    default:
      throw data("Unknown intent", { status: 400 });
  }
}
