"use client";

import { useEffect, useId, useRef, useState } from "react";
import { CheckIcon, ChevronsUpDownIcon, SearchIcon } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

export type ComboboxGroup<T> = {
  /** Visual group-header text shown above this group's options (not localized — caller's call). */
  heading: string;
  items: T[];
};

export type ComboboxTrailingAction = {
  /** Label for a non-list action row appended after all groups (e.g. "Custom…"). */
  label: string;
  onSelect: () => void;
};

export type ComboboxProps<T> = {
  groups: ComboboxGroup<T>[];
  getValue: (item: T) => string;
  getLabel: (item: T) => string;
  /** Optional per-item inline style (e.g. font-family preview). */
  getItemStyle?: (item: T) => React.CSSProperties | undefined;
  filterItem?: (item: T, query: string) => boolean;
  value: string;
  onChange: (value: string) => void;
  /** Text shown on the closed trigger — caller resolves it (may differ from a plain lookup). */
  selectedLabel: string;
  triggerMuted?: boolean;
  searchPlaceholder: string;
  noMatchesLabel: string;
  /** Optional non-list action appended after all groups (e.g. "Custom Google Font…"). */
  trailingAction?: ComboboxTrailingAction;
  id?: string;
  name?: string;
  ariaLabel?: string;
  disabled?: boolean;
  invalid?: boolean;
  ariaDescribedby?: string;
};

/**
 * Generic searchable popover combobox: Popover + search Input + scrollable
 * grouped listbox + full keyboard nav. Replaces oversized native
 * `<select>`/`<optgroup>` popups that can escape the viewport (portal +
 * `max-h-64 overflow-y-auto` keep the list contained). See REUSABLE_CODE.md.
 */
export function Combobox<T>({
  groups,
  getValue,
  getLabel,
  getItemStyle,
  filterItem,
  value,
  onChange,
  selectedLabel,
  triggerMuted,
  searchPlaceholder,
  noMatchesLabel,
  trailingAction,
  id,
  ariaLabel,
  disabled,
  invalid,
  ariaDescribedby,
}: ComboboxProps<T>) {
  const generatedId = useId();
  const triggerId = id ?? generatedId;
  const listboxId = `${triggerId}-listbox`;
  const optionId = (index: number) => `${listboxId}-opt-${index}`;

  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [activeIndex, setActiveIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  const q = query.trim().toLowerCase();
  const defaultFilter = (item: T, qq: string) => getLabel(item).toLowerCase().includes(qq);
  const test = filterItem ?? defaultFilter;
  const filteredFlat = groups.flatMap((group) => group.items.filter((item) => !q || test(item, q)));

  function handleOpenChange(next: boolean) {
    setOpen(next);
    if (next) {
      setQuery("");
      setActiveIndex(0);
    }
  }

  function select(item: T) {
    onChange(getValue(item));
    setOpen(false);
  }

  function selectTrailingAction() {
    trailingAction?.onSelect();
    setOpen(false);
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    const totalCount = filteredFlat.length + (trailingAction ? 1 : 0);
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActiveIndex((i) => Math.min(i + 1, totalCount - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveIndex((i) => Math.max(i - 1, 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (activeIndex === filteredFlat.length && trailingAction) {
        selectTrailingAction();
        return;
      }
      const item = filteredFlat[activeIndex];
      if (item) select(item);
    } else if (e.key === "Escape") {
      setOpen(false);
    }
  }

  // Focus the search input once the popover is open.
  useEffect(() => {
    if (!open) return;
    const handle = requestAnimationFrame(() => inputRef.current?.focus());
    return () => cancelAnimationFrame(handle);
  }, [open]);

  // Keep the active option scrolled into view during keyboard navigation.
  useEffect(() => {
    if (!open) return;
    document.getElementById(optionId(activeIndex))?.scrollIntoView({ block: "nearest" });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, activeIndex]);

  const activeDescendant = open ? optionId(activeIndex) : undefined;

  return (
    <Popover open={open} onOpenChange={handleOpenChange}>
      <PopoverTrigger
        render={
          <button
            type="button"
            id={triggerId}
            aria-label={ariaLabel}
            aria-invalid={invalid || undefined}
            aria-describedby={ariaDescribedby}
            disabled={disabled}
            className={cn(
              "flex h-9 w-full items-center justify-between gap-2 border border-input bg-background px-2 text-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50",
              "aria-invalid:border-destructive aria-invalid:ring-3 aria-invalid:ring-destructive/20 dark:aria-invalid:border-destructive/50 dark:aria-invalid:ring-destructive/40"
            )}
          >
            <span className={cn("truncate text-start", triggerMuted && "text-muted-foreground")}>
              {selectedLabel}
            </span>
            <ChevronsUpDownIcon className="size-4 shrink-0 opacity-50" aria-hidden />
          </button>
        }
      />
      <PopoverContent align="start" sideOffset={4} className="w-(--anchor-width) min-w-[14rem] p-0">
        <div className="relative border-b border-border">
          <SearchIcon
            className="pointer-events-none absolute start-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
            aria-hidden
          />
          <Input
            ref={inputRef}
            type="text"
            role="combobox"
            autoComplete="off"
            aria-expanded={open}
            aria-controls={listboxId}
            aria-autocomplete="list"
            aria-activedescendant={activeDescendant}
            aria-label={ariaLabel}
            value={query}
            disabled={disabled}
            placeholder={searchPlaceholder}
            className="h-9 rounded-none border-0 bg-transparent ps-8 focus-visible:ring-0"
            onChange={(e) => {
              setQuery(e.target.value);
              setActiveIndex(0);
            }}
            onKeyDown={handleKeyDown}
          />
        </div>
        <ul id={listboxId} role="listbox" className="max-h-64 overflow-y-auto p-1">
          {filteredFlat.length === 0 && (
            <li className="px-3 py-2 text-sm text-muted-foreground">{noMatchesLabel}</li>
          )}
          {(() => {
            const nodes: React.ReactNode[] = [];
            for (const group of groups) {
              const items = group.items.filter((item) => !q || test(item, q));
              if (items.length === 0) continue;
              nodes.push(
                <li
                  key={`group-${group.heading}`}
                  role="presentation"
                  className="px-3 pb-1 pt-2 text-xs font-medium text-muted-foreground"
                >
                  {group.heading}
                </li>
              );
              for (const item of items) {
                const optIndex = filteredFlat.indexOf(item);
                const isSelected = getValue(item) === value;
                const isActive = optIndex === activeIndex;
                nodes.push(
                  <li
                    key={getValue(item)}
                    id={optionId(optIndex)}
                    role="option"
                    aria-label={getLabel(item)}
                    aria-selected={isSelected}
                    style={getItemStyle?.(item)}
                    onMouseEnter={() => setActiveIndex(optIndex)}
                    // onMouseDown (not onClick) so selection fires before the
                    // input blur tears the popover down.
                    onMouseDown={(e) => {
                      e.preventDefault();
                      select(item);
                    }}
                    className={cn(
                      "flex cursor-pointer items-center justify-between gap-2 px-3 py-2 text-sm transition-colors",
                      isActive && "bg-accent text-accent-foreground"
                    )}
                  >
                    <span className="truncate">{getLabel(item)}</span>
                    {isSelected ? <CheckIcon className="size-4 shrink-0" aria-hidden /> : null}
                  </li>
                );
              }
            }
            return nodes;
          })()}
          {trailingAction && (
            <li
              id={optionId(filteredFlat.length)}
              role="option"
              aria-label={trailingAction.label}
              aria-selected={false}
              onMouseEnter={() => setActiveIndex(filteredFlat.length)}
              onMouseDown={(e) => {
                e.preventDefault();
                selectTrailingAction();
              }}
              className={cn(
                "flex cursor-pointer items-center gap-2 border-t border-border px-3 py-2 text-sm text-muted-foreground transition-colors",
                activeIndex === filteredFlat.length && "bg-accent text-accent-foreground"
              )}
            >
              {trailingAction.label}
            </li>
          )}
        </ul>
      </PopoverContent>
    </Popover>
  );
}
