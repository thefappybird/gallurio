"use client";

import { useLocale, useTranslations } from "next-intl";
import { formatMoney } from "@/lib/utils/format-currency";
import { cn } from "@/lib/utils";

// Approximate local-currency equivalent shown beside a price. The billed
// currency is named in the same line so the figure can never be mistaken for
// what the card is charged — Lemon Squeezy always bills the store currency.
export function LocalPriceNote({
  amount,
  currency,
  billedIn,
  className,
}: {
  amount: number;
  currency: string;
  billedIn: string;
  className?: string;
}) {
  const t = useTranslations("plans");
  const locale = useLocale();

  // Small converted amounts need the minor units to stay meaningful (₱250 is
  // about $4.30, not $4); larger ones read better whole.
  const price = formatMoney(amount, currency, locale, {
    maximumFractionDigits: amount < 100 ? 2 : 0,
  });

  return (
    <span className={cn("text-xs text-muted-foreground", className)}>
      {t("localEstimate", { price, currency: billedIn })}
    </span>
  );
}
