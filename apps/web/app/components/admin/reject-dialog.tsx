import {
  CHANGE_REQUEST_PRESETS,
  MAX_REJECTION_REASON_LENGTH,
  MAX_REVIEW_MESSAGE_LENGTH,
  REJECTION_REASON_PRESETS,
} from "@ourdiu/shared/constants";
import { useId, useState } from "react";
import { ActionDialog } from "~/components/actions";
import { Button } from "~/components/ui/button";
import { Label } from "~/components/ui/label";
import { Textarea } from "~/components/ui/textarea";

type DecisionDialogProps = {
  trigger?: React.ReactElement;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  /** The review page's route, when opened from elsewhere (the list). */
  action?: string;
};

/**
 * A decision that comes with a message for the uploader. The presets fill in common
 * messages, which can then be edited.
 */
function ReasonDialog({
  defaultReason,
  status,
  presets,
  label,
  maxLength,
  ...props
}: DecisionDialogProps &
  Pick<
    React.ComponentProps<typeof ActionDialog>,
    "title" | "description" | "submitLabel" | "pendingLabel" | "successMessage"
  > & {
    defaultReason?: string | null;
    status: "rejected" | "changes_requested";
    presets: readonly { label: string; text: string }[];
    label: string;
    maxLength: number;
  }) {
  const id = useId();
  const [reason, setReason] = useState(defaultReason ?? "");

  return (
    <ActionDialog
      {...props}
      onOpenChange={(open) => {
        if (open) setReason(defaultReason ?? "");
        props.onOpenChange?.(open);
      }}
      fields={{ intent: "status", status }}
      className="sm:max-w-lg"
    >
      {(fieldErrors) => (
        <div className="grid gap-3">
          <div
            className="flex flex-wrap gap-1.5"
            role="group"
            aria-label="Common messages"
          >
            {presets.map((preset) => (
              <Button
                key={preset.label}
                type="button"
                variant={reason === preset.text ? "secondary" : "outline"}
                size="sm"
                onClick={() => setReason(preset.text)}
              >
                {preset.label}
              </Button>
            ))}
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor={id}>{label}</Label>
            <Textarea
              id={id}
              name="reason"
              rows={4}
              required
              maxLength={maxLength}
              value={reason}
              onChange={(event) => setReason(event.target.value)}
              placeholder="Pick a common one above, or write your own"
              aria-invalid={fieldErrors.reason ? true : undefined}
            />
            {fieldErrors.reason && (
              <p className="text-sm text-destructive">{fieldErrors.reason}</p>
            )}
          </div>
        </div>
      )}
    </ActionDialog>
  );
}

/** Rejects a paper for good, with a reason for the uploader. */
export function RejectDialog({
  defaultReason,
  ...props
}: DecisionDialogProps & {
  /** The current reason, when rewording it. */
  defaultReason?: string | null;
}) {
  return (
    <ReasonDialog
      {...props}
      defaultReason={defaultReason}
      status="rejected"
      presets={REJECTION_REASON_PRESETS}
      label="Reason"
      maxLength={MAX_REJECTION_REASON_LENGTH}
      title={defaultReason ? "Change the reason" : "Reject this paper?"}
      description="The uploader sees this reason on their submission. To let them fix the paper instead, ask for changes."
      submitLabel={defaultReason ? "Save" : "Reject"}
      pendingLabel={defaultReason ? "Saving…" : "Rejecting…"}
      successMessage={defaultReason ? "Reason saved" : "Paper rejected"}
    />
  );
}

/**
 * Sends a paper back to its uploader with what to change. They can edit the details,
 * replace the file and reply, then resubmit it.
 */
export function RequestChangesDialog(props: DecisionDialogProps) {
  return (
    <ReasonDialog
      {...props}
      status="changes_requested"
      presets={CHANGE_REQUEST_PRESETS}
      label="What should they change?"
      maxLength={MAX_REVIEW_MESSAGE_LENGTH}
      title="Ask the uploader for changes"
      description="The paper goes back to its uploader with your message. They can fix the details or replace the file, reply, and send it back for review."
      submitLabel="Send to uploader"
      pendingLabel="Sending…"
      successMessage="Changes requested"
    />
  );
}
