"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";
import { CheckIcon, ChevronsUpDownIcon, SearchIcon } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { TIMEZONE_GROUPS, formatUtcOffset } from "@/lib/utils/timezones";

type FlatTimezone = {
  value: string;
  label: string;
  region: string;
  haystack: string;
};

// Normalize for search: lowercase, treat "/" and "_" as spaces, collapse
// whitespace. "+"/"-" are preserved so offset queries like "+8" still match.
function normalize(input: string): string {
  return input
    .toLowerCase()
    .replace(/[/_]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

// Flatten the grouped zones once. Each option's haystack matches IANA name,
// city, and UTC offset — including bare "+8" / "8" variants so an offset query
// hits even without the "UTC" prefix.
const FLAT_TIMEZONES: FlatTimezone[] = Object.entries(TIMEZONE_GROUPS).flatMap(
  ([region, zones]) =>
    zones.map((tz) => {
      const abs = Math.abs(tz.offsetMinutes);
      const hours = Math.floor(abs / 60);
      const sign = tz.offsetMinutes < 0 ? "-" : "+";
      const haystack = normalize(
        `${tz.value} ${tz.label} ${formatUtcOffset(tz.offsetMinutes)} ${sign}${hours} ${hours}`,
      );
      return { value: tz.value, label: tz.label, region, haystack };
    }),
);

const LABEL_BY_VALUE = new Map(FLAT_TIMEZONES.map((tz) => [tz.value, tz.label]));

export type TimezoneComboboxProps = {
  /** Controlled IANA timezone value (e.g. "Asia/Manila"). */
  value: string;
  /** Called with the selected IANA timezone value. */
  onChange: (value: string) => void;
  /** Placeholder for the inner search input (localized copy). */
  searchPlaceholder: string;
  /** Empty-state text shown when nothing matches (localized copy). */
  noMatchesLabel: string;
  /** id for the trigger — pair with a <Label htmlFor>. */
  id?: string;
  /** Name for an optional hidden input mirroring the value. */
  name?: string;
  /** Placeholder shown on the trigger when no value is set. */
  placeholder?: string;
  disabled?: boolean;
  invalid?: boolean;
  ariaDescribedby?: string;
};

export function TimezoneCombobox({
  value,
  onChange,
  searchPlaceholder,
  noMatchesLabel,
  id,
  name,
  placeholder,
  disabled,
  invalid,
  ariaDescribedby,
}: TimezoneComboboxProps) {
  const generatedId = useId();
  const triggerId = id ?? generatedId;
  const listboxId = `${triggerId}-listbox`;
  const optionId = (index: number) => `${listboxId}-opt-${index}`;

  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [activeIndex, setActiveIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  const filtered = useMemo(() => {
    const q = normalize(query);
    if (!q) return FLAT_TIMEZONES;
    return FLAT_TIMEZONES.filter((tz) => tz.haystack.includes(q));
  }, [query]);

  const selectedLabel = LABEL_BY_VALUE.get(value) ?? value;

  function handleOpenChange(next: boolean) {
    setOpen(next);
    if (next) {
      setQuery("");
      const idx = FLAT_TIMEZONES.findIndex((tz) => tz.value === value);
      setActiveIndex(idx >= 0 ? idx : 0);
    }
  }

  function select(next: string) {
    onChange(next);
    setOpen(false);
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActiveIndex((i) => Math.min(i + 1, filtered.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveIndex((i) => Math.max(i - 1, 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      const opt = filtered[activeIndex];
      if (opt) select(opt.value);
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
    document
      .getElementById(`${listboxId}-opt-${activeIndex}`)
      ?.scrollIntoView({ block: "nearest" });
  }, [open, activeIndex, listboxId]);

  const activeDescendant =
    open && filtered[activeIndex] ? optionId(activeIndex) : undefined;

  return (
    <>
      <Popover open={open} onOpenChange={handleOpenChange}>
        <PopoverTrigger
          render={
            <button
              type="button"
              id={triggerId}
              disabled={disabled}
              aria-invalid={invalid || undefined}
              aria-describedby={ariaDescribedby}
              className={cn(
                "flex h-9 w-full items-center justify-between gap-2 border border-input bg-background px-3 py-1 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50",
                "aria-invalid:border-destructive aria-invalid:ring-3 aria-invalid:ring-destructive/20 dark:aria-invalid:border-destructive/50 dark:aria-invalid:ring-destructive/40"
              )}
            >
              <span className={cn("truncate text-start", !value && "text-muted-foreground")}>
                {value ? selectedLabel : (placeholder ?? searchPlaceholder)}
              </span>
              <ChevronsUpDownIcon className="size-4 shrink-0 opacity-50" aria-hidden />
            </button>
          }
        />
        <PopoverContent
          align="start"
          sideOffset={4}
          className="w-(--anchor-width) min-w-[16rem] p-0"
        >
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
            {filtered.length === 0 ? (
              <li className="px-3 py-2 text-sm text-muted-foreground">{noMatchesLabel}</li>
            ) : (
              (() => {
                const nodes: React.ReactNode[] = [];
                let lastRegion: string | null = null;
                filtered.forEach((tz, index) => {
                  if (tz.region !== lastRegion) {
                    lastRegion = tz.region;
                    nodes.push(
                      <li
                        key={`region-${tz.region}`}
                        role="presentation"
                        className="px-3 pb-1 pt-2 text-xs font-medium text-muted-foreground"
                      >
                        {tz.region}
                      </li>,
                    );
                  }
                  const isSelected = tz.value === value;
                  const isActive = index === activeIndex;
                  nodes.push(
                    <li
                      key={tz.value}
                      id={optionId(index)}
                      role="option"
                      aria-selected={isSelected}
                      onMouseEnter={() => setActiveIndex(index)}
                      // onMouseDown (not onClick) so selection fires before the
                      // input blur tears the popover down.
                      onMouseDown={(e) => {
                        e.preventDefault();
                        select(tz.value);
                      }}
                      className={cn(
                        "flex cursor-pointer items-center justify-between gap-2 px-3 py-2 text-sm transition-colors",
                        isActive && "bg-accent text-accent-foreground",
                      )}
                    >
                      <span className="truncate">{tz.label}</span>
                      {isSelected ? <CheckIcon className="size-4 shrink-0" aria-hidden /> : null}
                    </li>,
                  );
                });
                return nodes;
              })()
            )}
          </ul>
        </PopoverContent>
      </Popover>
      {name ? <input type="hidden" name={name} value={value} readOnly /> : null}
    </>
  );
}
