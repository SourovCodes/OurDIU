// Plain constants with no Zod import, so browser bundles can use them without shipping Zod.
// Import via `@ourdiu/shared/constants` in client code.

// ── Accounts (shared by every OurDIU product) ────────────────────────────────

/** `admin` can manage every product's content and the users. */
export const USER_ROLES = ["user", "admin"] as const;

/**
 * Only DIU addresses (staff and students) can create an account; existing accounts on
 * other addresses (admins listed in ADMIN_EMAILS, later imported users) can still sign in.
 */
export const ALLOWED_EMAIL_DOMAINS = ["diu.edu.bd", "s.diu.edu.bd"] as const;

/** Whether an address is on one of ALLOWED_EMAIL_DOMAINS (exactly, not a subdomain). */
export function isAllowedEmail(email: string): boolean {
  const [local, domain, ...rest] = email.trim().toLowerCase().split("@");
  return (
    !!local &&
    rest.length === 0 &&
    (ALLOWED_EMAIL_DOMAINS as readonly string[]).includes(domain ?? "")
  );
}

/** Usernames: 3–50 of a-z, 0-9, `_`, `.` and `-`. */
export const USERNAME_PATTERN = /^[a-z0-9_.-]{3,50}$/;
export const USERNAME_RULES =
  "3–50 lowercase letters, digits, dots, dashes or underscores";

/** The error Better Auth sends a refused sign-up back with (`?error=`). */
export const EMAIL_DOMAIN_NOT_ALLOWED = "EMAIL_DOMAIN_NOT_ALLOWED";
