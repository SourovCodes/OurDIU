import { FormField } from "~/components/form";

type PaperDetailsFieldsProps = {
  fieldErrors: Record<string, string>;
  defaults?: { section: string | null; batch: string | null };
};

/**
 * Optional section and batch, which tell papers of the same question apart. Renders
 * the two fields as siblings, for a grid. Blank fields are sent and read as not given.
 */
export function PaperDetailsFields({
  fieldErrors,
  defaults,
}: PaperDetailsFieldsProps) {
  return (
    <>
      <FormField
        label="Section (optional)"
        name="section"
        placeholder="e.g. A or A, B"
        maxLength={10}
        defaultValue={defaults?.section ?? ""}
        error={fieldErrors.section}
      />
      <FormField
        label="Batch (optional)"
        name="batch"
        placeholder="e.g. 61"
        maxLength={10}
        defaultValue={defaults?.batch ?? ""}
        error={fieldErrors.batch}
      />
    </>
  );
}
