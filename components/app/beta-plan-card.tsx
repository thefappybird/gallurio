"use client";

import type { ReactNode } from "react";
import { useTranslations } from "next-intl";
import { getPlanCatalog } from "@/lib/lemonsqueezy/plans";
import { PlanCard } from "./plan-card";

// The Beta plan, filled in from the `plans.beta.*` catalog and rendered by the
// shared PlanCard so it sits identically beside Monthly/Annual on every
// surface. It never owns the CTA: callers pass their own activate button/state
// through `action` so the card stays free of any flow-specific wiring.
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
    <PlanCard
      label={tPlans("beta.label")}
      name={tPlans("beta.name")}
      price={tPlans("beta.price")}
      priceSuffix={tPlans("beta.priceSuffix")}
      tagline={tPlans("beta.tagline")}
      features={featureKeys.map((key) => tPlans(key.replace(/^plans\./, "")))}
      note={tPlans("beta.note")}
      action={action}
      featured
      className={className}
    />
  );
}
