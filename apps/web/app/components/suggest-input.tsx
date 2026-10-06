import { useId, useMemo, useState } from "react";
import { Input } from "~/components/ui/input";
import { cn } from "~/lib/utils";

export type Suggestion = {
  /** What picking it puts in the box. */
  value: string;
  /** What the list shows, if not the value. */
  label?: string;
  /** A second, quieter line, e.g. a short name. */
  hint?: string;
};

const MAX_SHOWN = 8;

/**
 * A text box that suggests values as you type, but takes anything typed: a
 * combobox (ARIA's list-autocomplete pattern) without a fixed list. Arrow keys
 * move through the suggestions, Enter picks one, Escape closes them.
 */
export function SuggestInput({
  id,
  value,
  onChange,
  onPick,
  suggestions,
  className,
  ...props
}: Omit<React.ComponentProps<typeof Input>, "value" | "onChange"> & {
  value: string;
  onChange: (value: string) => void;
  /** Called when a suggestion is picked, besides `onChange`. */
  onPick?: (suggestion: Suggestion) => void;
  suggestions: Suggestion[];
}) {
  const ownId = useId();
  const inputId = id ?? ownId;
  const listId = `${inputId}-suggestions`;
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);

  const shown = useMemo(() => {
    const q = value.trim().toLowerCase();
    const hits = q
      ? suggestions.filter((s) =>
          [s.value, s.label, s.hint].some((t) => t?.toLowerCase().includes(q)),
        )
      : suggestions;
    return hits.slice(0, MAX_SHOWN);
  }, [suggestions, value]);
  // Nothing to suggest once the box holds exactly the one suggestion.
  const visible =
    open &&
    shown.length > 0 &&
    !(shown.length === 1 && shown[0]!.value === value);

  const pick = (s: Suggestion) => {
    onChange(s.value);
    onPick?.(s);
    setOpen(false);
    setActive(-1);
  };

  return (
    <div className="relative">
      <Input
        {...props}
        id={inputId}
        value={value}
        role="combobox"
        aria-autocomplete="list"
        aria-expanded={visible}
        aria-controls={listId}
        aria-activedescendant={
          visible && active >= 0 ? `${listId}-${active}` : undefined
        }
        autoComplete="off"
        className={className}
        onChange={(e) => {
          onChange(e.target.value);
          setOpen(true);
          setActive(-1);
        }}
        onFocus={() => setOpen(true)}
        onBlur={() => setOpen(false)}
        onKeyDown={(e) => {
          if (e.key === "Escape") {
            setOpen(false);
            return;
          }
          if (e.key === "ArrowDown" || e.key === "ArrowUp") {
            e.preventDefault();
            setOpen(true);
            if (!shown.length) return;
            const step = e.key === "ArrowDown" ? 1 : -1;
            setActive((i) => (i + step + shown.length) % shown.length);
            return;
          }
          if (e.key === "Enter" && visible && active >= 0) {
            e.preventDefault();
            pick(shown[active]!);
          }
        }}
      />
      {visible && (
        <ul
          id={listId}
          role="listbox"
          className="absolute inset-x-0 top-full z-30 mt-1 max-h-72 overflow-auto rounded-xl border bg-popover p-1 text-popover-foreground shadow-lg"
        >
          {shown.map((s, i) => (
            <li
              key={s.value}
              id={`${listId}-${i}`}
              role="option"
              aria-selected={i === active}
              // Keeps the focus in the box, so the blur doesn't close the list first.
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => pick(s)}
              className={cn(
                "cursor-pointer rounded-lg px-3 py-2 text-sm hover:state-layer",
                i === active &&
                  "bg-primary-container text-primary-container-foreground",
              )}
            >
              <span className="block">{s.label ?? s.value}</span>
              {s.hint && (
                <span className="block text-xs text-muted-foreground">
                  {s.hint}
                </span>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
