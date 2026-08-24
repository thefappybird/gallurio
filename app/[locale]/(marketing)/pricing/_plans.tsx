"use client";

import { useState } from "react";
import { useTranslations, useLocale } from "next-intl";
import { Link } from "@/lib/i18n/navigation";
import { buttonVariants } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { BilledAsNote } from "@/components/app/billed-as-note";
import { BetaPlanCard } from "@/components/app/beta-plan-card";
import { PlanCard } from "@/components/app/plan-card";
import { SavePill } from "@/components/app/save-pill";
import { headlinePrice } from "@/lib/pricing/displayPrice";
import type { ProPricing } from "@/lib/lemonsqueezy/pricing";
import { formatMoney } from "@/lib/utils/format-currency";
import { cn } from "@/lib/utils";

// Client half of the pricing page's plan block — the tab state (Beta /
// Monthly / Annual) needs interactivity the server page can't provide.
export function PricingPlans({
  proPricing,
  betaEnabled,
}: {
  proPricing: ProPricing;
  betaEnabled: boolean;
}) {
  const t = useTranslations("marketing.pricing");
  const tPlans = useTranslations("plans");
  const locale = useLocale();
  const [selection, setSelection] = useState<"beta" | "monthly" | "yearly">(
    betaEnabled ? "beta" : "monthly"
  );
  const cadence = selection === "yearly" ? "yearly" : "monthly";

  const proFeatures = [
    t("pro.feature1"),
    t("pro.feature2"),
    t("pro.feature3"),
    t("pro.feature4"),
    t("pro.feature5"),
    t("pro.feature6"),
  ];

  const headline = headlinePrice(proPricing, cadence);
  const headlineAmount = formatMoney(headline.amount, headline.currency, locale, {
    maximumFractionDigits: headline.amount < 100 ? 2 : 0,
  });
  // Twelve months at the monthly rate — what the annual plan is measured
  // against, shown struck through beside the annual price.
  const monthlyHeadline = headlinePrice(proPricing, "monthly");
  const priceSuffix = cadence === "monthly" ? t("pro.priceSuffixMonthly") : t("pro.priceSuffixYearly");

  return (
    <>
      <div className="flex flex-wrap items-center justify-center gap-2">
        <div className="inline-flex flex-wrap justify-center gap-1 rounded-[var(--radius)] border border-border p-1">
          {betaEnabled ? (
            <button
              type="button"
              data-testid="plan-tab-beta"
              onClick={() => setSelection("beta")}
              aria-pressed={selection === "beta"}
              className={cn(
                "rounded-[calc(var(--radius)-0.05rem)] px-2.5 py-1.5 text-sm font-semibold transition-colors sm:px-3",
                selection === "beta" ? "bg-brand text-brand-foreground" : "text-muted-foreground hover:text-foreground"
              )}
            >
              {tPlans("beta.tabLabel")}
            </button>
          ) : null}
          <button
            type="button"
            data-testid="plan-tab-monthly"
            onClick={() => setSelection("monthly")}
            aria-pressed={selection === "monthly"}
            className={cn(
              "rounded-[calc(var(--radius)-0.05rem)] px-2.5 py-1.5 text-sm font-semibold transition-colors sm:px-3",
              selection === "monthly" ? "bg-brand text-brand-foreground" : "text-muted-foreground hover:text-foreground"
            )}
          >
            {t("cadence.monthly")}
          </button>
          <button
            type="button"
            data-testid="plan-tab-yearly"
            onClick={() => setSelection("yearly")}
            aria-pressed={selection === "yearly"}
            className={cn(
              "rounded-[calc(var(--radius)-0.05rem)] px-2.5 py-1.5 text-sm font-semibold transition-colors sm:px-3",
              selection === "yearly" ? "bg-brand text-brand-foreground" : "text-muted-foreground hover:text-foreground"
            )}
          >
            {t("cadence.yearly")}
          </button>
        </div>
      </div>

      <div className="mt-8">
        {selection === "beta" ? (
          <BetaPlanCard
            className="rounded-[var(--radius-surface)]"
            action={
              <Link href="/sign-up" className={buttonVariants({ variant: "brand", size: "lg", className: "mt-6" })}>
                {tPlans("beta.cta")}
              </Link>
            }
          />
        ) : (
          <PlanCard
            className="rounded-[var(--radius-surface)] p-6"
            name={t("pro.name")}
            badge={
              <>
                {selection === "yearly" ? <SavePill label={t("cadence.savePill")} /> : null}
                <Badge variant="default" className="bg-brand text-brand-foreground">
                  {t("pro.badge")}
                </Badge>
              </>
            }
            price={headlineAmount}
            comparePrice={
              cadence === "yearly"
                ? formatMoney(monthlyHeadline.amount * 12, monthlyHeadline.currency, locale)
                : null
            }
            priceSuffix={priceSuffix}
            billed={
              headline.billed ? (
                <BilledAsNote amount={headline.billed.amount} currency={headline.billed.currency} />
              ) : null
            }
            tagline={t("pro.description")}
            features={proFeatures}
            note={t("pro.freeMonth")}
            featured
            action={
              <Link
                href="/sign-up"
                className={buttonVariants({ variant: "brand", size: "lg", className: "mt-3 w-full" })}
              >
                {t("pro.cta")}
              </Link>
            }
          />
        )}
      </div>
    </>
  );
}
