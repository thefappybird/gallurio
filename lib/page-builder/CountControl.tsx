"use client";

import { cn } from "@/lib/utils";

interface CountControlProps {
  value: number | undefined;
  /** Display-only fallback. Selecting a value still writes through onChange. */
  effectiveValue?: number;
  onChange: (v: number | undefined) => void;
  quickValues?: number[];
  min?: number;
  max?: number;
  allowAuto?: boolean;
  /** When true the trailing number input is hidden; only the quick-value buttons are shown. */
  hideInput?: boolean;
  ariaLabel?: string;
  inputAriaLabel?: string;
}

const BTN_BASE =
  "inline-flex h-7 flex-1 cursor-pointer items-center justify-center border border-border bg-background text-xs font-medium text-foreground transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50";
const BTN_ACTIVE = "bg-foreground text-background hover:bg-foreground";

export function CountControl({
  value,
  effectiveValue,
  onChange,
  quickValues = [1, 2, 3],
  min = 1,
  max = 6,
  allowAuto = false,
  hideInput = false,
  ariaLabel,
  inputAriaLabel = "Custom count",
}: CountControlProps) {
  const displayedValue = value ?? effectiveValue;
  const isCustom = displayedValue !== undefined && !quickValues.includes(displayedValue);

  function clamp(n: number) {
    return Math.min(max, Math.max(min, Math.floor(n)));
  }

  function handleInputChange(e: React.ChangeEvent<HTMLInputElement>) {
    const n = parseInt(e.target.value, 10);
    if (!Number.isNaN(n)) onChange(clamp(n));
  }

  function handleInputBlur(e: React.FocusEvent<HTMLInputElement>) {
    const n = parseInt(e.target.value, 10);
    if (!Number.isNaN(n)) onChange(clamp(n));
  }

  function handleInputKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter") {
      const n = parseInt((e.target as HTMLInputElement).value, 10);
      if (!Number.isNaN(n)) onChange(clamp(n));
    }
  }

  return (
    <div className="flex items-center gap-1.5" role={ariaLabel ? "group" : undefined} aria-label={ariaLabel}>
      {allowAuto && (
        <button
          type="button"
          aria-pressed={value === undefined}
          onClick={() => onChange(undefined)}
          className={cn(BTN_BASE, value === undefined && BTN_ACTIVE)}
        >
          Auto
        </button>
      )}
      {quickValues.map((v) => {
        const isExplicit = value === v;
        const isEffective = value === undefined && effectiveValue === v;
        return (
          <button
            key={v}
            type="button"
            aria-pressed={isExplicit || isEffective}
            onClick={() => onChange(v)}
            className={cn(
              BTN_BASE,
              isExplicit && BTN_ACTIVE,
              isEffective && "border-foreground opacity-70",
            )}
          >
            {v}
          </button>
        );
      })}
      {!hideInput && (
        <input
          type="number"
          min={min}
          max={max}
          step={1}
          aria-label={inputAriaLabel}
          defaultValue={isCustom ? String(displayedValue) : ""}
          key={isCustom ? String(displayedValue) : "idle"}
          onChange={handleInputChange}
          onBlur={handleInputBlur}
          onKeyDown={handleInputKeyDown}
          placeholder="…"
          className={cn(
            BTN_BASE,
            "flex-1 px-1 text-center tabular-nums",
            "[appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none",
            value !== undefined && isCustom && BTN_ACTIVE,
            value === undefined && isCustom && "border-foreground opacity-70",
          )}
        />
      )}
    </div>
  );
}
