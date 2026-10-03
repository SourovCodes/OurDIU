/** The legal pages, in the order the footer and each page's tabs list them. */
export const LEGAL_PAGES = [
  { path: "/privacy", label: "Privacy" },
  { path: "/terms", label: "Terms" },
  { path: "/copyright", label: "Copyright" },
  { path: "/cookies", label: "Cookies" },
] as const;

/** When the legal pages last changed. Update it with any change to their content. */
export const LEGAL_UPDATED = "4 October 2026";

/** A mailto: link with a subject, and optionally a body to fill in. */
export function mailto(email: string, subject: string, body?: string) {
  const params = [`subject=${encodeURIComponent(subject)}`];
  if (body) params.push(`body=${encodeURIComponent(body)}`);
  return `mailto:${email}?${params.join("&")}`;
}
