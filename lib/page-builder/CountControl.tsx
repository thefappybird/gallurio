"use client";

import { cn } from "@/lib/utils";

interface CountControlProps {
  value: number | undefined;
  onChange: (v: number | undefined) => void;
  quickValues?: number[];
  min?: number;
  max?: number;
  allowAuto?: boolean;
  /** When true the trailing number input is hidden; only the quick-value buttons are shown. */
  hideInput?: boolean;
}

const BTN_BASE =
  "inline-flex h-7 flex-1 cursor-pointer items-center justify-center border border-border bg-background text-xs font-medium text-foreground transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50";
const BTN_ACTIVE = "bg-foreground text-background hover:bg-foreground";

export function CountControl({
  value,
  onChange,
  quickValues = [1, 2, 3],
  min = 1,
  max = 6,
  allowAuto = false,
  hideInput = false,
}: CountControlProps) {
  const isCustom = value !== undefined && !quickValues.includes(value);

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
    <div className="flex items-center gap-1.5">
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
      {quickValues.map((v) => (
        <button
          key={v}
          type="button"
          aria-pressed={value === v}
          onClick={() => onChange(v)}
          className={cn(BTN_BASE, value === v && BTN_ACTIVE)}
        >
          {v}
        </button>
      ))}
      {!hideInput && (
        <input
          type="number"
          min={min}
          max={max}
          step={1}
          aria-label="Custom count"
          defaultValue={isCustom ? String(value) : ""}
          key={isCustom ? String(value) : "idle"}
          onChange={handleInputChange}
          onBlur={handleInputBlur}
          onKeyDown={handleInputKeyDown}
          placeholder="…"
          className={cn(
            BTN_BASE,
            "flex-1 px-1 text-center tabular-nums",
            "[appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none",
            isCustom && BTN_ACTIVE
          )}
        />
      )}
    </div>
  );
}
