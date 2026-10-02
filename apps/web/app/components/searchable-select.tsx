import { Check, ChevronsUpDown, Plus } from "lucide-react";
import { useId, useState } from "react";
import { Button } from "~/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "~/components/ui/command";
import { Label } from "~/components/ui/label";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "~/components/ui/popover";
import type { SelectOption } from "~/lib/filters";
import { cn } from "~/lib/utils";

type SearchableSelectProps = {
  label: string;
  /** Shown when nothing is selected, and as the "clear" option. */
  placeholder: string;
  searchPlaceholder: string;
  emptyText: string;
  options: SelectOption[];
  value: string | null;
  onChange: (value: string | null) => void;
  /** Offer the placeholder as an item that clears the selection. Defaults to true. */
  clearable?: boolean;
  /** Overrides the trigger text, e.g. for a new value that isn't one of the options. */
  displayLabel?: string;
  /** When set, typing a name that matches no option offers to add it. */
  onCreate?: (name: string) => void;
  createLabel?: (name: string) => string;
  invalid?: boolean;
};

const CLEAR_VALUE = "__all__";
const CREATE_VALUE = "__create__";

export function SearchableSelect({
  label,
  placeholder,
  searchPlaceholder,
  emptyText,
  options,
  value,
  onChange,
  clearable = true,
  displayLabel,
  onCreate,
  createLabel,
  invalid,
}: SearchableSelectProps) {
  const id = useId();
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const selected = options.find((option) => option.value === value);
  const triggerLabel = displayLabel ?? selected?.label;

  const name = search.trim();
  const query = name.toLowerCase();
  // Filtered here rather than by cmdk, which doesn't re-filter items that mount
  // while typing (like the "Add" item) and would hide them.
  const visibleOptions = query
    ? options.filter((o) => o.label.toLowerCase().includes(query))
    : options;
  const canCreate =
    onCreate !== undefined &&
    name.length >= 2 &&
    !options.some((o) => o.label.toLowerCase() === query);

  const changeOpen = (next: boolean) => {
    setOpen(next);
    if (!next) setSearch("");
  };

  const select = (next: string | null) => {
    onChange(next);
    changeOpen(false);
  };

  return (
    <div className="grid min-w-0 gap-1.5">
      <Label htmlFor={id}>{label}</Label>
      <Popover open={open} onOpenChange={changeOpen}>
        <PopoverTrigger asChild>
          <Button
            id={id}
            variant="outline"
            role="combobox"
            aria-expanded={open}
            aria-invalid={invalid || undefined}
            className="h-11 w-full min-w-0 justify-between rounded-xl bg-card px-4 font-normal text-foreground hover:bg-card hover:state-layer"
          >
            <span
              className={cn(
                "min-w-0 truncate",
                !triggerLabel && "text-muted-foreground",
              )}
            >
              {triggerLabel ?? placeholder}
            </span>
            <ChevronsUpDown className="opacity-50" aria-hidden />
          </Button>
        </PopoverTrigger>
        <PopoverContent
          align="start"
          className="w-(--radix-popover-trigger-width) min-w-64 p-0"
          // Inside a dialog or sheet (classifying a paper in the admin panel, the
          // phone filters), their scroll lock listens on the document and blocks
          // wheel and touch scrolling outside them, and this list is portalled
          // outside them. Stopping the events here lets the list scroll.
          onWheel={(event) => event.stopPropagation()}
          onTouchMove={(event) => event.stopPropagation()}
          onCloseAutoFocus={(event) => {
            // Radix moves focus back to this trigger once the closing animation
            // ends. If another picker opened meanwhile (quick hands, a slow phone),
            // leave focus there: taking it back would close that picker again.
            const active = document.activeElement;
            const content = event.currentTarget as Node | null;
            if (
              active &&
              active !== document.body &&
              !content?.contains(active)
            ) {
              event.preventDefault();
            }
          }}
        >
          <Command shouldFilter={false}>
            <CommandInput
              placeholder={searchPlaceholder}
              value={search}
              onValueChange={setSearch}
            />
            <CommandList>
              <CommandEmpty>{emptyText}</CommandEmpty>
              <CommandGroup>
                {clearable && !query && (
                  <CommandItem
                    value={CLEAR_VALUE}
                    onSelect={() => select(null)}
                  >
                    <Check
                      className={cn(triggerLabel ? "opacity-0" : "opacity-100")}
                      aria-hidden
                    />
                    {placeholder}
                  </CommandItem>
                )}
                {visibleOptions.map((option) => (
                  <CommandItem
                    key={option.value}
                    value={option.value}
                    onSelect={() => select(option.value)}
                  >
                    <Check
                      className={cn(
                        option.value === value ? "opacity-100" : "opacity-0",
                      )}
                      aria-hidden
                    />
                    {option.label}
                  </CommandItem>
                ))}
                {canCreate && (
                  <CommandItem
                    value={CREATE_VALUE}
                    onSelect={() => {
                      onCreate(name);
                      changeOpen(false);
                    }}
                  >
                    <Plus aria-hidden />
                    {createLabel ? createLabel(name) : `Add “${name}”`}
                  </CommandItem>
                )}
              </CommandGroup>
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
    </div>
  );
}
