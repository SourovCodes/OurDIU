import { useEffect, useEffectEvent } from "react";

/** True when a key would type into the focused field rather than run a shortcut. */
export function typingIn(target: EventTarget | null) {
  return (
    target instanceof HTMLElement &&
    (target.isContentEditable ||
      ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName))
  );
}

/**
 * A bare letter/symbol key (no modifiers, not a repeat, not while composing or
 * typing), for YouTube-style single-key shortcuts.
 */
export function isPlainKey(event: KeyboardEvent, key: string) {
  return (
    event.key.toLowerCase() === key.toLowerCase() &&
    !event.metaKey &&
    !event.ctrlKey &&
    !event.altKey &&
    !event.repeat &&
    !event.isComposing &&
    !typingIn(event.target)
  );
}

/**
 * Runs `onKey` when a bare letter/symbol is pressed (YouTube-style). Ignored
 * while typing. Return `true` from `onKey` when the shortcut ran so the key is
 * swallowed; returning nothing leaves the event alone. Pass `{ enabled: false }`
 * to disarm without unmounting.
 */
export function useHotkey(
  key: string,
  onKey: () => boolean | void,
  { enabled = true }: { enabled?: boolean } = {},
) {
  const handle = useEffectEvent(onKey);
  useEffect(() => {
    if (!enabled) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (!isPlainKey(event, key)) return;
      if (handle() !== true) return;
      event.preventDefault();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [key, enabled]);
}
