"use client";

import type { ReactNode } from "react";
import { useTranslations } from "next-intl";
import { Check } from "lucide-react";
import { getPlanCatalog } from "@/lib/lemonsqueezy/plans";
import { cn } from "@/lib/utils";

// Presentational Beta plan card shared by onboarding, settings billing, and
// subscribe (recovery) — and by the marketing pages in a later wave. It never
// owns the CTA: callers pass their own activate button/state through
// `action` so the card stays free of any flow-specific wiring.
export function BetaPlanCard({
  action,
  className,
}: {
  action?: ReactNode;
  className?: string;
}) {
  const tPlans = useTranslations("plans");
  const featureKeys = getPlanCatalog("pro").featureKeys;

  return (
    <div
      className={cn(
        "flex flex-col gap-3 border border-brand bg-background p-4",
        className
      )}
    >
      <span className="text-[10px] font-semibold uppercase tracking-wider text-brand">
        {tPlans("beta.label")}
      </span>
      <h3 className="font-heading text-lg font-semibold">{tPlans("beta.name")}</h3>
      <div className="flex items-baseline gap-1">
        <span className="font-heading text-2xl font-semibold">{tPlans("beta.price")}</span>
        <span className="text-xs text-muted-foreground">{tPlans("beta.priceSuffix")}</span>
      </div>
      <p className="text-xs text-muted-foreground">{tPlans("beta.tagline")}</p>
      <ul className="mt-1 flex flex-col gap-1.5 text-xs">
        {featureKeys.map((key) => (
          <li key={key} className="flex items-start gap-1.5">
            <Check className="mt-0.5 h-3 w-3 shrink-0 text-brand" />
            <span>{tPlans(key.replace(/^plans\./, ""))}</span>
          </li>
        ))}
      </ul>
      <p className="text-xs text-muted-foreground">{tPlans("beta.note")}</p>
      {action}
    </div>
  );
}
