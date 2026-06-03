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
import { STYLE_COLOR_TOKENS, colorTokenToVar, type StyleColorToken } from "./styleToolkit";

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
          style={{ background: colorTokenToVar(token) }}
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
      <span className="flex items-center justify-between">
        <span>{label}</span>
        {suffix && <span className="text-xs text-muted-foreground">{suffix}</span>}
      </span>
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
        className="h-9 w-full border border-border bg-background px-2 text-sm text-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
      />
    </label>
  );
}
