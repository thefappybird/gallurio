"use client";

import { useLocale, useTranslations } from "next-intl";
import { formatMoney } from "@/lib/utils/format-currency";
import { cn } from "@/lib/utils";

// The amount Lemon Squeezy actually charges, named under a price headlined in
// the visitor's own currency. Rendered only when those two differ — a visitor
// already in the store currency sees the headline alone.
export function BilledAsNote({
  amount,
  currency,
  className,
}: {
  amount: number;
  currency: string;
  className?: string;
}) {
  const t = useTranslations("plans");
  const locale = useLocale();

  const price = formatMoney(amount, currency, locale, {
    maximumFractionDigits: amount < 100 ? 2 : 0,
  });

  return (
    <span className={cn("text-xs text-muted-foreground", className)}>
      {t("billedAs", { price, currency })}
    </span>
  );
}
