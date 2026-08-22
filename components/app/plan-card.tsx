"use client";

import type { ReactNode } from "react";
import { Check } from "lucide-react";
import { cn } from "@/lib/utils";

// The one plan card. Every surface that offers a plan renders this: the
// marketing landing teaser, /pricing, /subscribe, the onboarding plan step and
// Settings > Billing. Purely presentational — the caller supplies already
// translated strings and its own CTA through `action`, so the card never
// carries flow-specific wiring.
//
// `onSelect` turns the whole card into a radio-style button (the onboarding
// step picks between plans that way). Without it the card is a plain div and
// `action` is the only interactive thing inside it — a card that is itself a
// button must not contain one.
export function PlanCard({
  label,
  name,
  badge,
  comparePrice,
  price,
  priceSuffix,
  billed,
  tagline,
  features,
  note,
  action,
  featured = false,
  selected = false,
  disabled = false,
  onSelect,
  className,
}: {
  /** Small uppercase eyebrow above the name, e.g. "Beta tester". */
  label?: string;
  name: string;
  /** Top-right slot: the yearly saving pill, "Most popular", "Active". */
  badge?: ReactNode;
  /** Struck-through reference price, e.g. twelve months at the monthly rate. */
  comparePrice?: string | null;
  price: string;
  priceSuffix?: string;
  /** What the payment processor actually charges, when it differs. */
  billed?: ReactNode;
  tagline?: string;
  features?: string[];
  note?: string;
  action?: ReactNode;
  featured?: boolean;
  selected?: boolean;
  disabled?: boolean;
  onSelect?: () => void;
  className?: string;
}) {
  const selectable = typeof onSelect === "function";

  const body = (
    <>
      <div className="flex items-start justify-between gap-2">
        <div className="flex flex-col gap-1">
          {label ? (
            <span className="text-[10px] font-semibold uppercase tracking-wider text-brand">
              {label}
            </span>
          ) : null}
          <h3 className="font-heading text-lg font-semibold">{name}</h3>
        </div>
        {badge ? <div className="flex shrink-0 items-center gap-1.5">{badge}</div> : null}
      </div>

      {/* Price first, then the struck reference: the amount actually charged
          is what the reader is looking for, and leading with the crossed-out
          figure made the card read as if it cost the larger number. */}
      <div className="flex flex-wrap items-baseline gap-1">
        <span className="font-heading text-2xl font-semibold">{price}</span>
        {comparePrice ? (
          <span className="text-sm text-muted-foreground line-through">{comparePrice}</span>
        ) : null}
        {priceSuffix ? (
          <span className="text-xs text-muted-foreground">{priceSuffix}</span>
        ) : null}
      </div>
      {billed}

      {tagline ? <p className="text-xs text-muted-foreground">{tagline}</p> : null}

      {features?.length ? (
        <ul className="mt-1 flex flex-col gap-1.5 text-xs">
          {features.map((feature) => (
            <li key={feature} className="flex items-start gap-1.5">
              <Check className="mt-0.5 h-3 w-3 shrink-0 text-brand" aria-hidden />
              <span>{feature}</span>
            </li>
          ))}
        </ul>
      ) : null}

      {note ? <p className="text-xs text-muted-foreground">{note}</p> : null}
      {action}
    </>
  );

  const shell = cn(
    "flex flex-col gap-3 border bg-background p-4 text-start",
    featured || selected ? "border-brand" : "border-border",
    selectable && !disabled && !selected && "hover:border-brand/40 focus-visible:border-brand/40",
    disabled && "cursor-not-allowed opacity-50",
    className
  );

  if (!selectable) {
    return <div className={shell}>{body}</div>;
  }

  return (
    <button
      type="button"
      aria-pressed={selected}
      disabled={disabled}
      onClick={onSelect}
      className={cn(shell, "transition-colors")}
    >
      {body}
    </button>
  );
}
