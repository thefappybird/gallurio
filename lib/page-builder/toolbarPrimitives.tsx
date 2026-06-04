"use client";

/**
 * Shared Canva-style toolbar primitives used by the block-level
 * `StyleToolkitField` and the per-text `RichTextField`. Kept dependency-light
 * and presentational so both toolbars look and behave identically.
 *
 * Editor chrome → English-only (RELEASE-CHECKLIST §4f).
 */

import type { LucideIcon } from "lucide-react";
import { Popover, PopoverTrigger, PopoverContent } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { STYLE_COLOR_TOKENS, type StyleColorToken } from "./styleToolkit";
import { useBrandColors } from "./brandColors";

export const COLOR_LABEL: Record<StyleColorToken, string> = {
  primary: "Primary",
  secondary: "Secondary",
  accent: "Accent",
  background: "Background",
  foreground: "Text",
};

export const toolbarButtonBase =
  "inline-flex size-9 cursor-pointer items-center justify-center border border-border bg-background text-foreground transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50";

export function ToolbarToggle({
  active,
  title,
  onClick,
  Icon,
}: {
  active: boolean;
  title: string;
  onClick: () => void;
  Icon: LucideIcon;
}) {
  return (
    <button
      type="button"
      title={title}
      aria-label={title}
      aria-pressed={active}
      onClick={onClick}
      className={cn(toolbarButtonBase, active && "bg-foreground text-background hover:bg-foreground")}
    >
      <Icon className="size-4" aria-hidden />
    </button>
  );
}

export function ToolbarPopover({
  title,
  Icon,
  active,
  children,
}: {
  title: string;
  Icon: LucideIcon;
  active?: boolean;
  children: React.ReactNode;
}) {
  return (
    <Popover>
      <PopoverTrigger
        title={title}
        aria-label={title}
        className={cn(toolbarButtonBase, active && "ring-1 ring-ring")}
      >
        <Icon className="size-4" aria-hidden />
      </PopoverTrigger>
      <PopoverContent className="w-64">
        <div className="flex flex-col gap-3">
          <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{title}</span>
          {children}
        </div>
      </PopoverContent>
    </Popover>
  );
}

/** A row of the 5 brand-palette swatches (+ optional "None"). */
export function ColorSwatchRow({
  value,
  onChange,
  allowNone = true,
}: {
  value: StyleColorToken | undefined;
  onChange: (next: StyleColorToken | undefined) => void;
  allowNone?: boolean;
}) {
  // Resolved hex (via context) so swatches show the real color even when the
  // popover is portaled outside the `--pf-color-*` scope.
  const colors = useBrandColors();
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {STYLE_COLOR_TOKENS.map((token) => (
        <button
          key={token}
          type="button"
          title={COLOR_LABEL[token]}
          aria-label={COLOR_LABEL[token]}
          aria-pressed={value === token}
          onClick={() => onChange(token)}
          className={cn(
            "size-7 cursor-pointer border border-border focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring",
            value === token && "ring-2 ring-foreground ring-offset-1 ring-offset-background"
          )}
          style={{ background: colors[token] }}
        />
      ))}
      {allowNone && (
        <button
          type="button"
          onClick={() => onChange(undefined)}
          className="h-7 cursor-pointer border border-border px-2 text-xs text-muted-foreground hover:bg-accent focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
        >
          None
        </button>
      )}
    </div>
  );
}

/**
 * A labelled CSS-length input: number field + unit select (px / %).
 * Parses an incoming string like "320px" or "50%" into number + unit.
 * Composes back to "${n}${unit}" on change; `undefined` when the number is cleared.
 * Clamps to [min,max] on blur when those props are supplied.
 */
export function DimensionInput({
  label,
  value,
  onChange,
  min,
  max,
}: {
  label: string;
  value: string | undefined;
  onChange: (v: string | undefined) => void;
  min?: number;
  max?: number;
}) {
  // Parse "320px" → {n:320, unit:"px"}, "50%" → {n:50, unit:"%"}.
  function parse(raw: string | undefined): { n: string; unit: "px" | "%" } {
    if (!raw) return { n: "", unit: "px" };
    if (raw.endsWith("%")) {
      const num = raw.slice(0, -1);
      return { n: num, unit: "%" };
    }
    if (raw.endsWith("px")) {
      const num = raw.slice(0, -2);
      return { n: num, unit: "px" };
    }
    return { n: raw, unit: "px" };
  }

  const { n, unit } = parse(value);

  function compose(numStr: string, u: "px" | "%"): string | undefined {
    if (numStr === "") return undefined;
    const num = Number(numStr);
    if (!Number.isFinite(num)) return undefined;
    return `${num}${u}`;
  }

  function handleNumberChange(e: React.ChangeEvent<HTMLInputElement>) {
    const raw = e.target.value;
    onChange(compose(raw, unit));
  }

  function handleUnitChange(e: React.ChangeEvent<HTMLSelectElement>) {
    const u = e.target.value as "px" | "%";
    onChange(compose(n, u));
  }

  function handleBlur(e: React.FocusEvent<HTMLInputElement>) {
    const raw = e.target.value;
    if (raw === "") {
      onChange(undefined);
      return;
    }
    let num = Number(raw);
    if (!Number.isFinite(num)) {
      onChange(undefined);
      return;
    }
    if (min !== undefined && num < min) num = min;
    if (max !== undefined && num > max) num = max;
    onChange(`${num}${unit}`);
  }

  return (
    <label className="flex flex-col gap-1 text-sm">
      <span>{label}</span>
      <span className="flex">
        <input
          type="number"
          inputMode="numeric"
          value={n}
          onChange={handleNumberChange}
          onBlur={handleBlur}
          className="h-9 min-w-0 flex-1 border border-border bg-background pl-2 pr-2 text-sm text-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
        />
        <select
          value={unit}
          onChange={handleUnitChange}
          aria-label={`${label} unit`}
          className="h-9 cursor-pointer border border-l-0 border-border bg-background px-1 text-xs text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
        >
          <option value="px">px</option>
          <option value="%">%</option>
        </select>
      </span>
    </label>
  );
}

/**
 * A labelled NUMBER input with steppers (replaces the old range sliders).
 * Clamps to [min,max] on blur so a hostile/empty value can't produce an absurd
 * layout. Empty input → `undefined` (so the block falls back to its default).
 */
export function NumberInputRow({
  label,
  value,
  min,
  max,
  step = 1,
  suffix = "px",
  onChange,
}: {
  label: string;
  value: number | undefined;
  min: number;
  max: number;
  step?: number;
  suffix?: string;
  onChange: (next: number | undefined) => void;
}) {
  return (
    <label className="flex flex-col gap-1 text-sm">
      <span>{label}</span>
      {/* The unit (e.g. "px") sits in a dedicated cell on the input's right edge. */}
      <span className="relative block">
        <input
          type="number"
          inputMode="numeric"
          min={min}
          max={max}
          step={step}
          value={value ?? ""}
          onChange={(e) => {
            const raw = e.target.value;
            if (raw === "") {
              onChange(undefined);
              return;
            }
            const n = Number(raw);
            if (Number.isFinite(n)) onChange(n);
          }}
          onBlur={(e) => {
            const raw = e.target.value;
            if (raw === "") return;
            const n = Number(raw);
            if (!Number.isFinite(n)) {
              onChange(undefined);
              return;
            }
            onChange(Math.min(max, Math.max(min, n)));
          }}
          className={cn(
            "h-9 w-full border border-border bg-background pl-2 text-sm text-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring",
            suffix ? "pr-10" : "pr-2"
          )}
        />
        {suffix && (
          <span className="pointer-events-none absolute inset-y-0 right-0 flex items-center border-l border-border px-2 text-xs text-muted-foreground">
            {suffix}
          </span>
        )}
      </span>
    </label>
  );
}

/**
 * A labelled row of icon toggle-buttons for single-select options (e.g. align,
 * justify, shadow size). Clicking an already-active option deselects it
 * (returns `undefined`). Uses `ToolbarToggle` so all focus/hover/active states
 * are consistent with the rest of the toolbar.
 */
export function IconRow<T extends string>({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: T | undefined;
  options: { value: T; label: string; Icon: LucideIcon }[];
  onChange: (v: T | undefined) => void;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <span className="text-xs text-muted-foreground">{label}</span>
      <div className="flex items-center gap-1.5">
        {options.map(({ value: v, label: l, Icon }) => (
          <ToolbarToggle
            key={v}
            active={value === v}
            title={l}
            Icon={Icon}
            onClick={() => onChange(value === v ? undefined : v)}
          />
        ))}
      </div>
    </div>
  );
}
