"use client";

import { useState } from "react";
import { useTranslations, useLocale } from "next-intl";
import { Link } from "@/lib/i18n/navigation";
import { buttonVariants } from "@/components/ui/button";
import { BilledAsNote } from "@/components/app/billed-as-note";
import { BetaPlanCard } from "@/components/app/beta-plan-card";
import { PlanCard } from "@/components/app/plan-card";
import { SavePill } from "@/components/app/save-pill";
import { headlinePrice } from "@/lib/pricing/displayPrice";
import type { ProPricing } from "@/lib/lemonsqueezy/pricing";
import { formatMoney } from "@/lib/utils/format-currency";
import { cn } from "@/lib/utils";

// Landing-page pricing summary — mirrors the live /pricing page's story:
// while the beta is open, a free Beta tab leads; otherwise a paid Pro
// subscription (monthly/yearly) priced live from Lemon Squeezy. No free
// tier, no Studio/Business — those aren't sold.
export function PricingTeaser({
  proPricing,
  betaEnabled,
}: {
  proPricing: ProPricing;
  betaEnabled: boolean;
}) {
  const t = useTranslations("marketing.pricingTeaser");
  const tPlans = useTranslations("plans");
  const locale = useLocale();
  const [selection, setSelection] = useState<"beta" | "monthly" | "yearly">(
    betaEnabled ? "beta" : "monthly"
  );
  const cadence = selection === "yearly" ? "yearly" : "monthly";

  const headline = headlinePrice(proPricing, cadence);
  const headlineAmount = formatMoney(headline.amount, headline.currency, locale, {
    maximumFractionDigits: headline.amount < 100 ? 2 : 0,
  });
  const price = `${headlineAmount}${
    cadence === "monthly" ? t("pro.priceSuffixMonthly") : t("pro.priceSuffixYearly")
  }`;

  return (
    <section id="pricing" className="border-t border-border px-4 py-16 sm:px-6 sm:py-24">
      <div className="mx-auto max-w-5xl">
        <div className="text-center">
          <h2 className="font-heading text-2xl font-semibold tracking-tight sm:text-3xl">{t("title")}</h2>
          <p className="mx-auto mt-3 max-w-md text-base leading-7 text-muted-foreground">{t("subtitle")}</p>
        </div>

        <div className="mt-8 flex flex-wrap items-center justify-center gap-2">
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

        <div className="mt-8 flex justify-center">
          <div className="w-full max-w-sm">
            {selection === "beta" ? (
              <BetaPlanCard
                action={
                  <Link
                    href="/sign-up"
                    className={buttonVariants({ variant: "brand", size: "sm", className: "mt-auto" })}
                  >
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
                    <span className="w-fit rounded-[var(--radius)] bg-brand px-2 py-0.5 text-xs font-bold text-brand-foreground">
                      {t("pro.badge")}
                    </span>
                  </>
                }
                price={price}
                priceSuffix={t("pro.priceNote")}
                billed={
                  headline.billed ? (
                    <BilledAsNote
                      amount={headline.billed.amount}
                      currency={headline.billed.currency}
                    />
                  ) : null
                }
                tagline={t("pro.description")}
                features={[t("pro.feature1"), t("pro.feature2"), t("pro.feature3")]}
                featured
                action={
                  <Link
                    href="/sign-up"
                    className={buttonVariants({ variant: "brand", size: "sm", className: "mt-3 w-full" })}
                  >
                    {t("pro.cta")}
                  </Link>
                }
              />
            )}
          </div>
        </div>

        <p className="mt-8 text-center">
          <Link href="/pricing" className="text-sm font-medium text-muted-foreground underline-offset-4 hover:text-foreground hover:underline">
            {t("viewFullPricing")}
          </Link>
        </p>
        <p className="mt-3 text-center text-xs text-muted-foreground">{t("disclaimer")}</p>
      </div>
    </section>
  );
}
