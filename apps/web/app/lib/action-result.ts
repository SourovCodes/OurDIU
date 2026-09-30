/**
 * What a form action returns to the fetcher that posted it. The dialogs and toasts
 * in `components/actions.tsx` read it.
 */
export type ActionResult =
  | { ok: true; intent: string }
  | {
      ok: false;
      intent: string;
      error: string;
      fieldErrors: Record<string, string>;
    };
