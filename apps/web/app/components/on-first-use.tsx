import {
  cloneElement,
  lazy,
  Suspense,
  useEffect,
  useState,
  type ComponentType,
  type ReactElement,
} from "react";
import { whenIdle } from "~/lib/idle";

type TriggerProps = {
  onClick?: React.MouseEventHandler;
  onPointerDown?: React.PointerEventHandler;
  onKeyDown?: React.KeyboardEventHandler;
  "aria-haspopup"?: "menu" | "dialog";
  "aria-expanded"?: boolean;
};

/** What a menu loaded by `onFirstUse` receives besides its own props. */
export type FirstUseProps = {
  /** Its trigger, to wrap in its Radix `…Trigger asChild`. */
  trigger: ReactElement;
  /** True when the visitor's tap loaded it: it opens at once. */
  defaultOpen?: boolean;
};

/**
 * A menu or sheet whose code (Radix, positioning, focus traps) isn't part of the
 * page's first load (docs/PLAN.md, decision 47): its trigger is a plain button
 * until the first tap, which loads the real component and opens it. The code is
 * also fetched when the browser is idle, so it's usually there by then.
 */
export function onFirstUse<P extends object>(
  load: () => Promise<{ default: ComponentType<P & FirstUseProps> }>,
  popup: "menu" | "dialog",
) {
  const Real = lazy(load);
  return function OnFirstUse({
    trigger,
    ...props
  }: P & { trigger: ReactElement<TriggerProps> }) {
    const [used, setUsed] = useState(false);
    useEffect(() => whenIdle(() => void load()), []);
    if (used) {
      return (
        <Suspense fallback={trigger}>
          <Real {...(props as P)} trigger={trigger} defaultOpen />
        </Suspense>
      );
    }
    const open = () => setUsed(true);
    return cloneElement(trigger, {
      "aria-haspopup": popup,
      "aria-expanded": false,
      // Opened the way Radix opens them: a menu as the pointer goes down (left
      // button, no Ctrl) or with Enter, Space or ↓; a dialog on click.
      ...(popup === "menu"
        ? {
            onPointerDown: (event: React.PointerEvent) => {
              if (event.button !== 0 || event.ctrlKey) return;
              event.preventDefault();
              open();
            },
            onKeyDown: (event: React.KeyboardEvent) => {
              if (!["Enter", " ", "ArrowDown"].includes(event.key)) return;
              event.preventDefault();
              open();
            },
          }
        : { onClick: open }),
    });
  };
}
