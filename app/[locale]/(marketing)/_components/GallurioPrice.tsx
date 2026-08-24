import { getDisplayPricing } from "@/lib/pricing/localPricing";
import { headlinePrice } from "@/lib/pricing/displayPrice";
import { formatMoney } from "@/lib/utils/format-currency";

type Period = "monthly" | "yearly";

/**
 * Gallurio's live price, for use inside MDX article bodies as `<GallurioPrice />`.
 *
 * Copy here is hardcoded English rather than going through next-intl, because
 * it renders mid-sentence inside English-only articles — localizing just this
 * fragment would produce a mixed-language sentence.
 *
 * The figure always comes from getDisplayPricing() so it follows the visitor's
 * regional tier and cannot quote a stale number. Like every other price
 * surface, a local-currency estimate leads when available and the billed USD
 * amount is named alongside it.
 */
export async function GallurioPrice({ period }: { period?: Period }) {
  const pricing = await getDisplayPricing();

  const formatPeriod = (cadence: Period) => {
    const headline = headlinePrice(pricing, cadence);
    const suffix = cadence === "monthly" ? "/mo" : "/yr";
    const amount = formatMoney(headline.amount, headline.currency, "en", {
      maximumFractionDigits: headline.amount < 100 ? 2 : 0,
    });

    if (!headline.billed) return `${amount}${suffix}`;

    const billed = formatMoney(headline.billed.amount, headline.billed.currency, "en");
    return `${amount}${suffix} (billed as ${billed}${suffix})`;
  };

  if (period) return <>{formatPeriod(period)}</>;

  return <>{`${formatPeriod("monthly")} — ${formatPeriod("yearly")}`}</>;
}
