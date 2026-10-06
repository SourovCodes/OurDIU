import type { toast as sonnerToast } from "sonner";

/**
 * sonner's `toast`, with sonner loaded only when the browser is idle or the
 * first toast is shown, so it isn't part of every page's first load (docs/PLAN.md,
 * decision 47). `LazyToaster` mounts the Toaster then; a toast waits for it, as
 * sonner drops toasts made before its Toaster is listening.
 */
type Toast = typeof sonnerToast;

/** Asks `LazyToaster` to mount the Toaster now. */
export const TOASTER_WANTED = "ourdiu:toaster";

let toasterReady: () => void = () => {};
const ready = new Promise<void>((resolve) => (toasterReady = resolve));

/** Called by the Toaster once it listens for toasts. */
export function toasterMounted() {
  toasterReady();
}

function show<K extends "message" | "success" | "error">(
  kind: K,
  ...args: Parameters<Toast>
) {
  window.dispatchEvent(new Event(TOASTER_WANTED));
  void Promise.all([import("sonner"), ready]).then(([{ toast }]) => {
    if (kind === "message") toast(...args);
    else toast[kind as "success" | "error"](...args);
  });
}

export const toast = Object.assign(
  (...args: Parameters<Toast>) => show("message", ...args),
  {
    success: (...args: Parameters<Toast["success"]>) =>
      show("success", ...args),
    error: (...args: Parameters<Toast["error"]>) => show("error", ...args),
  },
);
