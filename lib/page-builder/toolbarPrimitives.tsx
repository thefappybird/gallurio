"use client";

/**
 * Shared Canva-style toolbar primitives used by the block-level
 * `StyleToolkitField` and the per-text `RichTextField`. Kept dependency-light
 * and presentational so both toolbars look and behave identically.
 *
 * Editor chrome → English-only (RELEASE-CHECKLIST §4f).
 */

import { useState } from "react";
import type { LucideIcon } from "lucide-react";
import { RotateCcw } from "lucide-react";
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

/** Small reset icon button — shared by DimensionInput, NumberInputRow, and select rows. */
export function ResetButton({ onClick, label }: { onClick: () => void; label: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={`Reset ${label}`}
      title={`Reset ${label}`}
      className="inline-flex size-7 shrink-0 cursor-pointer items-center justify-center border border-border bg-background text-muted-foreground transition-colors hover:bg-accent hover:text-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
    >
      <RotateCcw className="size-3" aria-hidden />
    </button>
  );
}

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

/**
 * A row of the 5 brand-palette swatches (+ optional reset icon + custom hex picker).
 *
 * `effectiveValue` — when provided and value is unset, the matching swatch shows as
 * active (aria-pressed=true) to indicate the theme-coupled default. Display-only.
 */
export function ColorSwatchRow({
  value,
  onChange,
  allowNone = true,
  effectiveValue,
}: {
  value: StyleColorToken | string | undefined;
  onChange: (next: StyleColorToken | string | undefined) => void;
  allowNone?: boolean;
  /** Show this token as active when value is unset (theme-coupled). Display-only.
   *  A hex string is accepted (effectiveButtonTextToken may return one when
   *  buttonColorToken is a custom hex); a hex never matches a palette swatch so
   *  nothing lights up — correct behaviour. */
  effectiveValue?: StyleColorToken | string;
}) {
  // Resolved hex (via context) so swatches show the real color even when the
  // popover is portaled outside the `--pf-color-*` scope.
  const colors = useBrandColors();
  const isCustomHex =
    typeof value === "string" &&
    value.startsWith("#") &&
    !(STYLE_COLOR_TOKENS as readonly string[]).includes(value);
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {STYLE_COLOR_TOKENS.map((token) => {
        const isEffective = value === undefined && effectiveValue === token;
        return (
          <button
            key={token}
            type="button"
            title={COLOR_LABEL[token]}
            aria-label={COLOR_LABEL[token]}
            aria-pressed={value === token || isEffective}
            onClick={() => onChange(token)}
            className={cn(
              "size-7 cursor-pointer border border-border focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring",
              value === token && "ring-2 ring-foreground ring-offset-1 ring-offset-background",
              isEffective && "ring-1 ring-foreground ring-offset-1 ring-offset-background opacity-70"
            )}
            style={{ background: colors[token] }}
          />
        );
      })}
      {allowNone && (
        <button
          type="button"
          onClick={() => onChange(undefined)}
          title="Reset color"
          aria-label="Reset color"
          className="inline-flex size-7 cursor-pointer items-center justify-center border border-border bg-background text-muted-foreground transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
        >
          <RotateCcw className="size-3.5" aria-hidden />
        </button>
      )}
      {/* Custom color picker — rightmost option, not saved to theme */}
      <label
        title="Custom color"
        aria-label="Custom color"
        className={cn(
          "relative size-7 cursor-pointer overflow-hidden border border-border focus-within:ring-1 focus-within:ring-ring",
          isCustomHex && "ring-2 ring-foreground ring-offset-1 ring-offset-background"
        )}
        style={{
          background: isCustomHex ? value : undefined,
        }}
      >
        <input
          type="color"
          value={isCustomHex ? value : "#000000"}
          onChange={(e) => onChange(e.target.value)}
          className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
          aria-label="Pick custom color"
        />
        {/* Show a rainbow gradient when no custom color is active */}
        {!isCustomHex && (
          <span
            aria-hidden
            className="absolute inset-0"
            style={{
              background: "conic-gradient(red, yellow, lime, aqua, blue, magenta, red)",
              opacity: 0.85,
            }}
          />
        )}
      </label>
    </div>
  );
}

/**
 * A labelled CSS-length input: number field + unit select (px / %).
 * Two-column layout: label left, input+unit+reset right.
 * Unit persists independently — clearing the number doesn't reset px/%.
 * Clamps to [min,max] on blur when those props are supplied.
 */
export function DimensionInput({
  label,
  value,
  onChange,
  min,
  max,
  effectiveValue,
}: {
  label: string;
  value: string | undefined;
  onChange: (v: string | undefined) => void;
  min?: number;
  max?: number;
  /**
   * Show this CSS-length string as a placeholder when value is unset —
   * indicates the block is following the theme default. Display-only;
   * typing writes the real value, clearing reverts to this display.
   */
  effectiveValue?: string;
}) {
  function parse(raw: string | undefined): { n: string; unit: "px" | "%" | "rem" } {
    if (!raw) return { n: "", unit: "px" };
    if (raw.endsWith("%")) return { n: raw.slice(0, -1), unit: "%" };
    if (raw.endsWith("rem")) return { n: raw.slice(0, -3), unit: "rem" };
    if (raw.endsWith("px")) return { n: raw.slice(0, -2), unit: "px" };
    return { n: raw, unit: "px" };
  }

  // Persist the unit independently — clearing the number value must not reset the unit.
  const [localUnit, setLocalUnit] = useState<"px" | "%">(() => {
    const u = parse(value).unit;
    return u === "rem" ? "px" : u;
  });
  // When value is defined, reflect its actual unit; when undefined, keep the last known unit.
  const parsedUnit = value ? parse(value).unit : localUnit;
  const activeUnit: "px" | "%" = parsedUnit === "rem" ? "px" : parsedUnit;
  const n = value ? parse(value).n : "";

  // Derive placeholder text from effectiveValue when value is unset.
  const placeholder = value === undefined && effectiveValue !== undefined
    ? parse(effectiveValue).n
    : undefined;

  function compose(numStr: string, u: "px" | "%"): string | undefined {
    if (numStr === "") return undefined;
    const num = Number(numStr);
    if (!Number.isFinite(num)) return undefined;
    return `${num}${u}`;
  }

  function handleNumberChange(e: React.ChangeEvent<HTMLInputElement>) {
    onChange(compose(e.target.value, activeUnit));
  }

  function handleUnitChange(e: React.ChangeEvent<HTMLSelectElement>) {
    const u = e.target.value as "px" | "%";
    setLocalUnit(u);
    onChange(compose(n, u));
  }

  function handleBlur(e: React.FocusEvent<HTMLInputElement>) {
    const raw = e.target.value;
    if (raw === "") { onChange(undefined); return; }
    let num = Number(raw);
    if (!Number.isFinite(num)) { onChange(undefined); return; }
    if (min !== undefined && num < min) num = min;
    if (max !== undefined && num > max) num = max;
    onChange(`${num}${activeUnit}`);
  }

  const isEffective = value === undefined && effectiveValue !== undefined;

  return (
    <div className="flex items-center justify-between gap-2">
      <span className={cn("shrink-0 text-xs", isEffective ? "text-muted-foreground/60" : "text-muted-foreground")}>{label}</span>
      <div className="flex items-center gap-1">
        <span className="flex">
          <input
            type="number"
            inputMode="numeric"
            value={n}
            placeholder={placeholder}
            onChange={handleNumberChange}
            onBlur={handleBlur}
            className={cn(
              "h-7 w-14 min-w-0 border bg-background pl-2 pr-1 text-xs focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring",
              isEffective
                ? "border-border/60 text-muted-foreground placeholder:text-muted-foreground/60"
                : "border-border text-foreground",
            )}
          />
          <select
            value={activeUnit}
            onChange={handleUnitChange}
            aria-label={`${label} unit`}
            className={cn(
              "h-7 cursor-pointer border border-l-0 bg-background px-1 text-xs focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring",
              isEffective ? "border-border/60 text-muted-foreground/60" : "border-border text-muted-foreground",
            )}
          >
            <option value="px">px</option>
            <option value="%">%</option>
          </select>
        </span>
        <ResetButton onClick={() => onChange(undefined)} label={label} />
      </div>
    </div>
  );
}

/**
 * A labelled NUMBER input with steppers.
 * Two-column layout: label left, input+suffix+reset right.
 * Clamps to [min,max] on blur. Empty input → `undefined` (block falls back to default).
 *
 * `effectiveValue` — when provided and the block's own value is unset, the input
 * shows this number as a placeholder so the user can see what the theme applies.
 * Typing any number writes the REAL prop; this is display-only.
 */
export function NumberInputRow({
  label,
  value,
  min,
  max,
  step = 1,
  suffix = "px",
  onChange,
  effectiveValue,
}: {
  label: string;
  value: number | undefined;
  min: number;
  max: number;
  step?: number;
  suffix?: string;
  onChange: (next: number | undefined) => void;
  /** Show this number as the placeholder when value is unset (theme-coupled). */
  effectiveValue?: number;
}) {
  return (
    <div className="flex items-center justify-between gap-2">
      <span className="shrink-0 text-xs text-muted-foreground">{label}</span>
      <div className="flex items-center gap-1">
        <span className="relative block">
          <input
            type="number"
            inputMode="numeric"
            min={min}
            max={max}
            step={step}
            value={value ?? ""}
            placeholder={value === undefined && effectiveValue !== undefined ? String(effectiveValue) : undefined}
            onChange={(e) => {
              const raw = e.target.value;
              if (raw === "") { onChange(undefined); return; }
              const n = Number(raw);
              if (Number.isFinite(n)) onChange(n);
            }}
            onBlur={(e) => {
              const raw = e.target.value;
              if (raw === "") return;
              const n = Number(raw);
              if (!Number.isFinite(n)) { onChange(undefined); return; }
              onChange(Math.min(max, Math.max(min, n)));
            }}
            className={cn(
              "h-7 w-16 border border-border bg-background pl-2 text-xs text-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring",
              suffix ? "pr-8" : "pr-2"
            )}
          />
          {suffix && (
            <span className="pointer-events-none absolute inset-y-0 right-0 flex items-center border-l border-border px-1.5 text-xs text-muted-foreground">
              {suffix}
            </span>
          )}
        </span>
        <ResetButton onClick={() => onChange(undefined)} label={label} />
      </div>
    </div>
  );
}

/**
 * A labelled row of icon toggle-buttons for single-select options (e.g. align,
 * justify, shadow size). Clicking an already-active option deselects it
 * (returns `undefined`). Uses `ToolbarToggle` so all focus/hover/active states
 * are consistent with the rest of the toolbar.
 *
 * `effectiveValue` — when provided and the block's own value is unset, the
 * matching icon shows as active (aria-pressed=true, following-theme). Display-only.
 */
export function IconRow<T extends string>({
  label,
  value,
  options,
  onChange,
  effectiveValue,
}: {
  label: string;
  value: T | undefined;
  options: { value: T; label: string; Icon: LucideIcon }[];
  onChange: (v: T | undefined) => void;
  /** Show this option as active when value is unset (theme-coupled). Display-only. */
  effectiveValue?: T;
}) {
  return (
    <div className="flex items-center justify-between gap-2">
      <span className="text-xs text-muted-foreground">{label}</span>
      <div className="flex items-center gap-1.5">
        {options.map(({ value: v, label: l, Icon }) => (
          <ToolbarToggle
            key={v}
            active={value === v || (value === undefined && effectiveValue === v)}
            title={l}
            Icon={Icon}
            onClick={() => onChange(value === v ? undefined : v)}
          />
        ))}
      </div>
    </div>
  );
}
