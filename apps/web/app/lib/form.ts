/** Form fields as a plain object, leaving out empty values. */
export function formObject(form: FormData, ...skip: string[]) {
  const entries = [...form.entries()].filter(
    ([key, value]) =>
      !skip.includes(key) && typeof value === "string" && value.trim() !== "",
  );
  return Object.fromEntries(entries) as Record<string, string>;
}
