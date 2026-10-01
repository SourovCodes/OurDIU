/**
 * Up to two initials for an avatar, e.g. "Ayesha Rahman" → "AR". Words that don't
 * start with a letter, like "(CSE-232)" or a student id, are skipped.
 */
export function initials(name: string) {
  const letters = name
    .trim()
    .split(/\s+/)
    .filter((part) => /^\p{L}/u.test(part))
    .slice(0, 2)
    .map((part) => part[0]!.toUpperCase())
    .join("");
  return letters || name.match(/\p{L}/u)?.[0]?.toUpperCase() || "?";
}
