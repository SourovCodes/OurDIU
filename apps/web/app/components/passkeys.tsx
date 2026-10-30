import { KeyRound, Loader2, Plus, Trash2 } from "lucide-react";
import { useState } from "react";
import { useRevalidator } from "react-router";
import { ConfirmAction, useFormAction } from "~/components/actions";
import { Button } from "~/components/ui/button";
import { formatDate } from "~/lib/dates";
import { addPasskey, PasskeyError } from "~/lib/passkey";
import { toast } from "~/lib/toast";

export type PasskeyItem = {
  id: string;
  /** The password manager or device it's kept in, when known, else "Passkey". */
  label: string;
  createdAt: string | null;
};

/**
 * The Account page's passkeys: add one on this device, see and remove the ones
 * added. Removing posts `intent=delete-passkey` to the account route's action.
 */
export function Passkeys({ passkeys }: { passkeys: PasskeyItem[] }) {
  const [adding, setAdding] = useState(false);
  const revalidator = useRevalidator();
  const remove = useFormAction();

  async function add() {
    setAdding(true);
    try {
      await addPasskey();
      toast.success("Passkey added. Use it next time you log in.");
      await revalidator.revalidate();
    } catch (error) {
      toast.error(
        error instanceof PasskeyError
          ? error.message
          : "Something went wrong. Please try again.",
      );
    } finally {
      setAdding(false);
    }
  }

  return (
    <section
      aria-labelledby="passkeys-heading"
      className="space-y-4 rounded-3xl bg-surface p-5"
    >
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="min-w-0">
          <h2 id="passkeys-heading" className="font-semibold">
            Passkeys
          </h2>
          <p className="text-sm text-pretty text-muted-foreground">
            Log in with your fingerprint, face or screen lock instead of Google.
          </p>
        </div>
        <Button type="button" variant="outline" onClick={add} disabled={adding}>
          {adding ? (
            <Loader2 className="animate-spin" aria-hidden />
          ) : (
            <Plus aria-hidden />
          )}
          Add a passkey
        </Button>
      </div>
      {passkeys.length > 0 && (
        <ul className="divide-y rounded-2xl bg-surface-low">
          {passkeys.map((passkey) => (
            <li key={passkey.id} className="flex items-center gap-3 px-4 py-3">
              <KeyRound
                className="size-5 shrink-0 text-muted-foreground"
                aria-hidden
              />
              <span className="min-w-0 flex-1">
                <span className="block truncate font-medium">
                  {passkey.label}
                </span>
                {passkey.createdAt && (
                  <span className="block text-sm text-muted-foreground">
                    Added {formatDate(passkey.createdAt)}
                  </span>
                )}
              </span>
              <ConfirmAction
                trigger={
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    aria-label={`Remove ${passkey.label}`}
                    disabled={remove.pending?.get("id") === passkey.id}
                  >
                    <Trash2 aria-hidden />
                  </Button>
                }
                title="Remove this passkey?"
                description="You won’t be able to log in with it any more. Also delete it from your device or password manager."
                confirmLabel="Remove"
                destructive
                successMessage="Passkey removed."
                fields={{ intent: "delete-passkey", id: passkey.id }}
                run={remove.run}
              />
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
