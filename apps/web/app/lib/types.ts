import type { UserRole } from "@ourdiu/shared";

export type SessionUser = {
  id: string;
  name: string;
  email: string;
  /** Profile image URL, or null to show initials. */
  image?: string | null;
  role?: UserRole;
  username?: string | null;
};
