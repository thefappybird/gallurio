"use client";

import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import type { LucideIcon } from "lucide-react";

export type SegmentedToggleOption<K extends string = string> = {
  key: K;
  label: ReactNode;
  /** Optional stable accessible name when the visual label is responsive. */
  ariaLabel?: string;
  /** Optional Lucide icon rendered before the label. */
  icon?: LucideIcon;
};

type SegmentedToggleProps<K extends string = string> = {
  /** The currently selected key. */
  value: K;
  /** Called when the user selects a different option. */
  onChange: (key: K) => void;
  options: SegmentedToggleOption<K>[];
  /** Accessible label for the tablist container. */
  ariaLabel: string;
  className?: string;
};

/**
 * Single-select segmented control rendered as one pill:
 * - Outer container provides the border + corner radius (`--radius` via `rounded-lg`).
 * - `overflow-hidden` clips inner button corners so only the outer edges are rounded.
 * - `divide-x divide-border` places a single shared divider between adjacent options
 *   (no doubled borders).
 * - Active option: `bg-brand text-brand-foreground`.
 * - ARIA: `role="tablist"` / `role="tab"` / `aria-selected`.
 *
 * Mobile: full-width with min-h-11 touch target.
 * sm+: inline auto-width, h-9.
 */
export function SegmentedToggle<K extends string = string>({
  value,
  onChange,
  options,
  ariaLabel,
  className,
}: SegmentedToggleProps<K>) {
  return (
    <div
      role="tablist"
      aria-label={ariaLabel}
      className={cn(
        // Pill shell: outer rounded corners + single shared border + overflow clip
        "flex w-full min-h-11 items-stretch rounded-lg border border-border bg-background overflow-hidden divide-x divide-border",
        // Compact inline at sm breakpoint
        "sm:inline-flex sm:w-auto sm:h-9 sm:min-h-0",
        className
      )}
    >
      {options.map(({ key, label, ariaLabel, icon: Icon }) => (
        <button
          key={key}
          type="button"
          role="tab"
          aria-selected={value === key}
          aria-label={ariaLabel}
          onClick={() => onChange(key)}
          className={cn(
            "flex flex-1 items-center justify-center gap-1.5 px-3 text-sm font-medium transition-colors",
            // No per-button border radius — the container clips the outer corners
            "rounded-none outline-none focus-visible:ring-3 focus-visible:ring-ring/50",
            value === key
              ? "bg-brand text-brand-foreground"
              : "bg-transparent text-muted-foreground hover:bg-accent/40 hover:text-foreground"
          )}
        >
          {Icon && <Icon className="size-4" />}
          <span aria-hidden={ariaLabel ? true : undefined}>{label}</span>
        </button>
      ))}
    </div>
  );
}
