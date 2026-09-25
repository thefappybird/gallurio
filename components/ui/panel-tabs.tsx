"use client";

import { cn } from "@/lib/utils";

/**
 * Underlined tab strip used by the portfolio editor's panels.
 *
 * Extracted from StyleToolkitField's Content/Design/Layout header so the left
 * sidebar's Components/Outline tabs are the same control rather than a visual
 * copy that drifts.
 */
export function PanelTabs<T extends string>({
  tabs,
  value,
  onChange,
  className,
}: {
  tabs: readonly { id: T; label: string; tourId?: string }[];
  value: T;
  onChange: (id: T) => void;
  className?: string;
}) {
  return (
    <div className={cn("flex border-b border-border", className)}>
      {tabs.map(({ id, label, tourId }) => (
        <button
          key={id}
          type="button"
          // Deliberately a toggle button, not role="tab": a real tablist also
          // owes aria-controls, a matching tabpanel and arrow-key roving
          // focus, and half of that contract is worse than none.
          aria-pressed={value === id}
          data-tour-id={tourId}
          onClick={() => onChange(id)}
          className={cn(
            "flex-1 py-2 text-xs font-medium transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring",
            value === id
              ? "border-b-2 border-foreground text-foreground"
              : "text-muted-foreground"
          )}
        >
          {label}
        </button>
      ))}
    </div>
  );
}
