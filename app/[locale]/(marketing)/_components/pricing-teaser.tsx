"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { CheckIcon } from "lucide-react";
import { Link } from "@/lib/i18n/navigation";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

// Landing-page pricing summary — deliberately separate from the full /pricing
// page's `marketing.pricing` namespace (Starter/Studio/Business, still under
// review for the LemonSqueezy migration). This teaser reflects the current
// model: Free, Pro (monthly/yearly), and a free-during-beta Pro tier for
// early testers. Provider-neutral copy — no payment processor named here.
export function PricingTeaser() {
  const t = useTranslations("marketing.pricingTeaser");
  const [cadence, setCadence] = useState<"monthly" | "yearly">("monthly");

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

        <div className="mt-8 grid gap-5 sm:grid-cols-3">
          <PlanCard
            name={t("free.name")}
            price={t("free.price")}
            description={t("free.description")}
            features={[t("free.feature1"), t("free.feature2"), t("free.feature3")]}
            cta={t("free.cta")}
          />
          <PlanCard
            name={t("pro.name")}
            price={cadence === "monthly" ? t("pro.priceMonthly") : t("pro.priceYearly")}
            description={t("pro.description")}
            features={[t("pro.feature1"), t("pro.feature2"), t("pro.feature3")]}
            cta={t("pro.cta")}
            badge={t("pro.badge")}
            featured
          />
          <PlanCard
            name={t("beta.name")}
            price={t("beta.price")}
            priceNote={t("beta.priceNote")}
            description={t("beta.description")}
            features={[t("beta.feature1"), t("beta.feature2"), t("beta.feature3")]}
            cta={t("beta.cta")}
            badge={t("beta.badge")}
          />
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
  featured = false,
}: {
  name: string;
  price: string;
  priceNote?: string;
  description: string;
  features: string[];
  cta: string;
  badge?: string;
  featured?: boolean;
}) {
  return (
    <div
      className={cn(
        "flex flex-col gap-4 rounded-[var(--radius-surface)] border border-border bg-card p-6 text-start",
        featured && "border-brand ring-1 ring-brand"
      )}
    >
      {badge ? (
        <span className="w-fit rounded-[var(--radius)] bg-brand px-2 py-0.5 text-xs font-bold text-brand-foreground">
          {badge}
        </span>
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
