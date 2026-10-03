import { routineFileJsonSchema as fromZod } from "@ourdiu/shared";

/** The routine file's JSON schema, from the same Zod schema the upload is checked with. */
export function routineFileJsonSchema(): Record<string, unknown> {
  return {
    $id: "https://ourdiu.com/admin/routine/format/schema.json",
    title: "OurDIU class routine file",
    ...fromZod(),
  };
}
