import type { ReportStatus } from "@ourdiu/shared";

export const REPORT_STATUS_LABELS: Record<ReportStatus, string> = {
  pending: "Open",
  resolved: "Resolved",
  dismissed: "Dismissed",
};

/** Any submission's PDF, for admins. */
export function adminSubmissionFileUrl(id: number) {
  return `/api/v1/admin/submissions/${id}/file`;
}

export function adminSubmissionUrl(id: number) {
  return `/admin/questions/submissions/${id}`;
}

export { classificationLine, proposesNewEntries } from "./submissions";
