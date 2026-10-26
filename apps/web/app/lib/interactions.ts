import type { QuestionInteractions } from "@ourdiu/shared";
import { useEffect, useSyncExternalStore } from "react";

// The signed-in visitor's votes, reports and save on a question, asked for by the
// browser: the question's page data is cached and shared, the same for everyone
// (docs/PLAN.md, decision 62).
const store = new Map<number, QuestionInteractions | null>();
const listeners = new Set<() => void>();

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/** Reads the visitor's interactions with a question again, e.g. after a vote. */
export async function refreshInteractions(questionId: number) {
  const res = await fetch(
    `/api/v1/me/questions/${questionId}/interactions`,
  ).catch(() => null);
  const value = res?.ok ? ((await res.json()) as QuestionInteractions) : null;
  store.set(questionId, value);
  for (const listener of listeners) listener();
}

/**
 * The signed-in visitor's interactions with a question: `undefined` while they
 * load (the last ones read meanwhile, on a page visited before), `null` signed
 * out or when they can't be read.
 */
export function useInteractions(questionId: number, signedIn: boolean) {
  const value = useSyncExternalStore(
    subscribe,
    () => store.get(questionId),
    () => undefined,
  );
  useEffect(() => {
    if (signedIn) void refreshInteractions(questionId);
  }, [questionId, signedIn]);
  return signedIn ? value : null;
}
