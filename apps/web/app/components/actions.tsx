import { useEffect, useRef, useState } from "react";
import { useFetcher, type FetcherWithComponents } from "react-router";
import { toast } from "sonner";
import { FormMessage } from "~/components/form";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "~/components/ui/alert-dialog";
import { Button } from "~/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "~/components/ui/dialog";
import type { ActionResult } from "~/lib/action-result";
import { cn } from "~/lib/utils";

function HiddenFields({ fields }: { fields: Record<string, string> }) {
  return Object.entries(fields).map(([name, value]) => (
    <input key={name} type="hidden" name={name} value={value} />
  ));
}

/**
 * Toasts the outcome of each fetcher submission: `success` when it worked, the API's
 * message when it didn't (unless the form shows errors itself).
 */
function useResultToast(
  fetcher: FetcherWithComponents<ActionResult>,
  success: string | undefined,
  { errors = true } = {},
) {
  const { data, state } = fetcher;
  // The result arrives while loaders revalidate; toast once that's done, and only
  // once per result.
  const shown = useRef<ActionResult | undefined>(undefined);
  useEffect(() => {
    if (state !== "idle" || !data || shown.current === data) return;
    shown.current = data;
    if (data.ok) {
      if (success) toast.success(success);
    } else if (errors) {
      toast.error(data.error);
    }
  }, [data, state, success, errors]);
}

/** Open state that the caller may control, e.g. from a dropdown menu item. */
function useOpenState(open?: boolean, onOpenChange?: (open: boolean) => void) {
  const [innerOpen, setInnerOpen] = useState(false);
  return [
    open ?? innerOpen,
    (next: boolean) => {
      setInnerOpen(next);
      onOpenChange?.(next);
    },
  ] as const;
}

type Controlled = {
  /** The button that opens the dialog. Omit and pass `open` to control it. */
  trigger?: React.ReactElement;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
};

type ActionDialogProps = Controlled & {
  title: string;
  description?: React.ReactNode;
  submitLabel: string;
  pendingLabel?: string;
  /** Toast shown once the action succeeds. */
  successMessage?: string;
  /** Hidden form fields, such as the `intent` and an entry's id. */
  fields: Record<string, string>;
  /** Route action to post to. Defaults to the current route. */
  action?: string;
  /** `multipart/form-data` for a form with a file. */
  encType?: "multipart/form-data";
  className?: string;
  /** Visible form fields, given the errors from the last attempt. */
  children?: (fieldErrors: Record<string, string>) => React.ReactNode;
};

/**
 * A dialog with a form that posts to a route action through a fetcher. It stays open
 * to show errors and closes once the action succeeds.
 */
export function ActionDialog({
  trigger,
  open: openProp,
  onOpenChange,
  title,
  description,
  submitLabel,
  pendingLabel,
  successMessage,
  fields,
  action,
  encType,
  className,
  children,
}: ActionDialogProps) {
  const fetcher = useFetcher<ActionResult>();
  const [open, setOpen] = useOpenState(openProp, onOpenChange);
  const [submitted, setSubmitted] = useState(false);
  const busy = fetcher.state !== "idle";
  const result = submitted && !busy ? fetcher.data : undefined;
  const failed = result?.ok === false ? result : undefined;
  // Captured on submit: the page revalidates before the toast, which can change it.
  const [message, setMessage] = useState(successMessage);
  useResultToast(fetcher, message, { errors: false });

  return (
    <Dialog
      open={open && result?.ok !== true}
      onOpenChange={(next) => {
        setOpen(next);
        setSubmitted(false);
      }}
    >
      {trigger && <DialogTrigger asChild>{trigger}</DialogTrigger>}
      <DialogContent className={cn("sm:max-w-md", className)}>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          {description && <DialogDescription>{description}</DialogDescription>}
        </DialogHeader>
        <fetcher.Form
          method="post"
          action={action}
          encType={encType}
          onSubmit={() => {
            setSubmitted(true);
            setMessage(successMessage);
          }}
          className="grid gap-4"
        >
          <HiddenFields fields={fields} />
          {children?.(failed?.fieldErrors ?? {})}
          <FormMessage message={failed?.error} />
          <DialogFooter>
            <DialogClose asChild>
              <Button type="button" variant="outline">
                Cancel
              </Button>
            </DialogClose>
            <Button type="submit" disabled={busy}>
              {busy ? (pendingLabel ?? `${submitLabel}…`) : submitLabel}
            </Button>
          </DialogFooter>
        </fetcher.Form>
      </DialogContent>
    </Dialog>
  );
}

type ConfirmActionProps = Controlled & {
  title: string;
  description?: React.ReactNode;
  confirmLabel: string;
  destructive?: boolean;
  successMessage?: string;
  fields: Record<string, string>;
  action?: string;
  /**
   * Posts through a runner from `useFormAction` instead of this dialog's own
   * fetcher. Pass it when the confirmed action removes the component (e.g. a
   * table row), which would otherwise take the result toast with it.
   */
  run?: ReturnType<typeof useFormAction>["run"];
};

/** An alert dialog asking to confirm one action; errors come back as a toast. */
export function ConfirmAction({
  trigger,
  open: openProp,
  onOpenChange,
  title,
  description,
  confirmLabel,
  destructive = false,
  successMessage,
  fields,
  action,
  run,
}: ConfirmActionProps) {
  const fetcher = useFetcher<ActionResult>();
  const [open, setOpen] = useOpenState(openProp, onOpenChange);
  useResultToast(fetcher, successMessage);
  const onSubmit = run
    ? (event: React.FormEvent) => {
        event.preventDefault();
        run(fields, successMessage, action);
        setOpen(false);
      }
    : undefined;

  return (
    <AlertDialog open={open} onOpenChange={setOpen}>
      {trigger && <AlertDialogTrigger asChild>{trigger}</AlertDialogTrigger>}
      <AlertDialogContent>
        <fetcher.Form
          method="post"
          action={action}
          onSubmit={onSubmit}
          className="grid gap-4"
        >
          <HiddenFields fields={fields} />
          <AlertDialogHeader>
            <AlertDialogTitle>{title}</AlertDialogTitle>
            {description && (
              <AlertDialogDescription>{description}</AlertDialogDescription>
            )}
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel type="button">Cancel</AlertDialogCancel>
            <AlertDialogAction
              type="submit"
              variant={destructive ? "destructive" : "default"}
            >
              {confirmLabel}
            </AlertDialogAction>
          </AlertDialogFooter>
        </fetcher.Form>
      </AlertDialogContent>
    </AlertDialog>
  );
}

/**
 * Posts one-click actions (publish, resolve, …) through a fetcher and toasts the
 * outcome. Call it in a component that stays mounted after the action: the button
 * itself often disappears once the action succeeds.
 */
export function useFormAction(action?: string) {
  const fetcher = useFetcher<ActionResult>();
  const [message, setMessage] = useState<string>();
  useResultToast(fetcher, message);
  return {
    busy: fetcher.state !== "idle",
    /** The values submitted by the action in flight. */
    pending: fetcher.state !== "idle" ? fetcher.formData : undefined,
    /** Posts `fields` to `to` (default: the hook's action, else this route). */
    run(fields: Record<string, string>, success?: string, to = action) {
      setMessage(success);
      fetcher.submit(fields, { method: "post", action: to });
    },
  };
}
