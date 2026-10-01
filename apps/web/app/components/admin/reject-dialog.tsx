import {
  MAX_REJECTION_REASON_LENGTH,
  REJECTION_REASON_PRESETS,
} from "@ourdiu/shared/constants";
import { useId, useState } from "react";
import { ActionDialog } from "~/components/actions";
import { Button } from "~/components/ui/button";
import { Label } from "~/components/ui/label";
import { Textarea } from "~/components/ui/textarea";

type RejectDialogProps = {
  trigger?: React.ReactElement;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  /** The review page's route, when opened from elsewhere (the list). */
  action?: string;
  /** The current reason, when rewording it. */
  defaultReason?: string | null;
};

/**
 * Rejects a paper with a reason for the uploader. The presets fill in the common
 * reasons, which can then be edited.
 */
export function RejectDialog({ defaultReason, ...props }: RejectDialogProps) {
  const id = useId();
  const [reason, setReason] = useState(defaultReason ?? "");

  return (
    <ActionDialog
      {...props}
      onOpenChange={(open) => {
        if (open) setReason(defaultReason ?? "");
        props.onOpenChange?.(open);
      }}
      title={defaultReason ? "Change the reason" : "Reject this paper?"}
      description="The uploader sees this reason on their submission."
      submitLabel={defaultReason ? "Save" : "Reject"}
      pendingLabel={defaultReason ? "Saving…" : "Rejecting…"}
      successMessage={defaultReason ? "Reason saved" : "Paper rejected"}
      fields={{ intent: "status", status: "rejected" }}
      className="sm:max-w-lg"
    >
      {(fieldErrors) => (
        <div className="grid gap-3">
          <div
            className="flex flex-wrap gap-1.5"
            role="group"
            aria-label="Common reasons"
          >
            {REJECTION_REASON_PRESETS.map((preset) => (
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
            <Label htmlFor={id}>Reason</Label>
            <Textarea
              id={id}
              name="reason"
              rows={4}
              required
              maxLength={MAX_REJECTION_REASON_LENGTH}
              value={reason}
              onChange={(event) => setReason(event.target.value)}
              placeholder="Pick a common reason above, or write your own"
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
