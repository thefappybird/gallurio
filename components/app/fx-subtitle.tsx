"use client";

import { useTranslations } from "next-intl";
import { formatMoney } from "@/lib/utils/format-currency";
import { cn } from "@/lib/utils";

/**
 * What a figure in a foreign currency is worth in the workspace currency,
 * shown under the figure itself. Rendered only for records whose currency
 * differs from the workspace's — a record already in the workspace currency
 * has nothing to disclose.
 *
 * With `rate`, the amount was frozen when the money was collected and the
 * rate and date are named with it, so the number can be reconciled against a
 * bank statement. Without one, it is a live conversion at today's rate and
 * only the converted figure is shown — never a guessed rate.
 *
 * `align` keeps the converted figure adjacent to the amount it restates: the
 * whole point is reading the two as a pair. Under a start-aligned amount the
 * figure leads the line; under an end-aligned one it trails, so it still
 * lands directly beneath.
 */
export function FxSubtitle({
  amount,
  target,
  rate,
  at,
  locale,
  align = "start",
  className,
}: {
  amount: number;
  target: string;
  rate?: number | null;
  at?: string | null;
  locale: string;
  align?: "start" | "end";
  className?: string;
}) {
  const t = useTranslations("app.bookings.payments");

  const frozen = typeof rate === "number" && rate > 0;
  const converted = frozen ? amount * rate : amount;
  const price = formatMoney(converted, target, locale, { maximumFractionDigits: 2 });

  if (!frozen) {
    return (
      <span
        className={cn(
          "text-xs text-muted-foreground",
          align === "end" && "text-end",
          className
        )}
      >
        {t("approx", { price })}
      </span>
    );
  }

  const rateLabel = rate.toLocaleString(locale, { maximumFractionDigits: 5 });
  const dateLabel = at
    ? new Date(at).toLocaleDateString(locale, {
        day: "numeric",
        month: "short",
        year: "numeric",
      })
    : "";

  return (
    <span
      className={cn(
        "text-xs text-muted-foreground",
        align === "end" && "text-end",
        className
      )}
    >
      {t(align === "end" ? "frozenRateTrailing" : "frozenRate", {
        price,
        rate: rateLabel,
        date: dateLabel,
      })}
    </span>
  );
}
