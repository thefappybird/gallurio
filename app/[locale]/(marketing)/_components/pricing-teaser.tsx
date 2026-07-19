"use client";

import { useState } from "react";
import { useTranslations, useLocale } from "next-intl";
import { CheckIcon } from "lucide-react";
import { Link } from "@/lib/i18n/navigation";
import { buttonVariants } from "@/components/ui/button";
import type { ProPricing } from "@/lib/lemonsqueezy/pricing";
import { formatMoney } from "@/lib/utils/format-currency";
import { cn } from "@/lib/utils";

// Landing-page pricing summary — mirrors the live /pricing page's single-Pro
// story: 1 month free, then a paid Pro subscription (monthly/yearly) priced
// live from Lemon Squeezy. No free tier, no Studio/Business — those aren't
// sold. Provider-neutral copy — no payment processor named in the teaser
// itself.
export function PricingTeaser({ proPricing }: { proPricing: ProPricing }) {
  const t = useTranslations("marketing.pricingTeaser");
  const locale = useLocale();
  const [cadence, setCadence] = useState<"monthly" | "yearly">("monthly");

  const price =
    cadence === "monthly"
      ? `${formatMoney(proPricing.monthly, proPricing.currency, locale)}${t("pro.priceSuffixMonthly")}`
      : `${formatMoney(proPricing.yearly, proPricing.currency, locale)}${t("pro.priceSuffixYearly")}`;

  return (
    <section id="pricing" data-anim="slide-up" className="border-t border-border px-4 py-16 sm:px-6 sm:py-24">
      <div className="mx-auto max-w-5xl">
        <div className="text-center">
          <h2 className="font-heading text-2xl font-semibold tracking-tight sm:text-3xl">{t("title")}</h2>
          <p className="mx-auto mt-3 max-w-md text-base leading-7 text-muted-foreground">{t("subtitle")}</p>
        </div>

        <div className="mt-8 flex justify-center">
          <div className="inline-flex gap-1 rounded-[var(--radius)] border border-border p-1">
            <button
              type="button"
              onClick={() => setCadence("monthly")}
              aria-pressed={cadence === "monthly"}
              className={cn(
                "rounded-[calc(var(--radius)-0.05rem)] px-3 py-1.5 text-sm font-semibold transition-colors",
                cadence === "monthly" ? "bg-brand text-brand-foreground" : "text-muted-foreground hover:text-foreground"
              )}
            >
              {t("cadence.monthly")}
            </button>
            <button
              type="button"
              onClick={() => setCadence("yearly")}
              aria-pressed={cadence === "yearly"}
              className={cn(
                "rounded-[calc(var(--radius)-0.05rem)] px-3 py-1.5 text-sm font-semibold transition-colors",
                cadence === "yearly" ? "bg-brand text-brand-foreground" : "text-muted-foreground hover:text-foreground"
              )}
            >
              {t("cadence.yearly")}
            </button>
          </div>
        </div>

        <div className="mt-8 flex justify-center">
          <div className="w-full max-w-sm">
            <PlanCard
              name={t("pro.name")}
              price={price}
              priceNote={t("pro.priceNote")}
              description={t("pro.description")}
              features={[t("pro.feature1"), t("pro.feature2"), t("pro.feature3")]}
              cta={t("pro.cta")}
              badge={t("pro.badge")}
              comingSoon={t("pro.comingSoon")}
              featured
            />
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

function PlanCard({
  name,
  price,
  priceNote,
  description,
  features,
  cta,
  badge,
  comingSoon,
  featured = false,
}: {
  name: string;
  price: string;
  priceNote?: string;
  description: string;
  features: string[];
  cta: string;
  badge?: string;
  comingSoon?: string;
  featured?: boolean;
}) {
  return (
    <div
      className={cn(
        "flex flex-col gap-4 rounded-[var(--radius-surface)] border border-border bg-card p-6 text-start",
        featured && "border-brand ring-1 ring-brand"
      )}
    >
      {badge || comingSoon ? (
        <div className="flex flex-wrap items-center gap-2">
          {badge ? (
            <span className="w-fit rounded-[var(--radius)] bg-brand px-2 py-0.5 text-xs font-bold text-brand-foreground">
              {badge}
            </span>
          ) : null}
          {/* Coming soon: Lemon Squeezy checkout paused pending MoR verification, see docs/RELEASE-CHECKLIST.md */}
          {comingSoon ? (
            <span className="w-fit rounded-[var(--radius)] border border-border px-2 py-0.5 text-xs font-bold text-foreground">
              {comingSoon}
            </span>
          ) : null}
        </div>
      ) : null}
      <div>
        <p className="text-sm font-bold">{name}</p>
        <p className="mt-1 text-3xl font-bold tracking-tight">
          {price}
          {priceNote ? <span className="ms-1 text-sm font-medium text-muted-foreground">{priceNote}</span> : null}
        </p>
      </div>
      <p className="text-sm leading-6 text-muted-foreground">{description}</p>
      <ul className="flex flex-col gap-2 text-sm">
        {features.map((feature) => (
          <li key={feature} className="flex items-start gap-2">
            <CheckIcon className="mt-0.5 size-3.5 shrink-0 text-brand" aria-hidden />
            {feature}
          </li>
        ))}
      </ul>
      <Link
        href="/sign-up"
        className={buttonVariants({ variant: featured ? "brand" : "outline", size: "sm", className: "mt-auto" })}
      >
        {cta}
      </Link>
    </div>
  );
}
