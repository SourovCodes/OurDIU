import type { UserRole } from "@ourdiu/shared";

export type SessionUser = {
  id: string;
  name: string;
  email: string;
  /** Profile image URL, or null to show initials. */
  image?: string | null;
  role?: UserRole;
  /** In their contributor page's URL; null only for rows made without one. */
  username?: string | null;
  /** Optional, like 241-15-047. */
  studentId?: string | null;
  /** Whether their contributor page shows the student ID. */
  showStudentId?: boolean;
};
