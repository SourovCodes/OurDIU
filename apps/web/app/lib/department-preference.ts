// Remembers the department a visitor last filtered questions by, so /questions opens
// on it next time. A cookie rather than localStorage, so the server can apply it
// before rendering (no flash of every department).

const COOKIE = "qb_department";
const ONE_YEAR = 60 * 60 * 24 * 365;

/** The remembered department id from a Cookie header, if any. */
export function rememberedDepartment(cookieHeader: string | null) {
  const match = cookieHeader?.match(new RegExp(`(?:^|;\\s*)${COOKIE}=(\\d+)`));
  return match?.[1] ?? null;
}

/** Set-Cookie value that remembers a department. */
export function rememberDepartmentCookie(departmentId: string) {
  return `${COOKIE}=${departmentId}; Path=/; Max-Age=${ONE_YEAR}; SameSite=Lax`;
}

/** Set-Cookie value that forgets the department. */
export const forgetDepartmentCookie = `${COOKIE}=; Path=/; Max-Age=0; SameSite=Lax`;

/** Forgets the department in the browser, before navigating to all departments. */
export function forgetDepartment() {
  document.cookie = `${COOKIE}=; Path=/; Max-Age=0; SameSite=Lax`;
}
