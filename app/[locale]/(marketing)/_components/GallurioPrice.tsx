import { getDisplayPricing } from "@/lib/pricing/localPricing";
import { formatMoney } from "@/lib/utils/format-currency";

type Period = "monthly" | "yearly";

/**
 * Gallurio's live price, for use inside MDX article bodies as `<GallurioPrice />`.
 *
 * Copy here is hardcoded English rather than going through next-intl, because
 * it renders mid-sentence inside English-only articles — localizing just this
 * fragment would produce a mixed-language sentence.
 *
 * The figure always comes from getDisplayPricing() so an article can never
 * quote a stale number. `local` is a display-only conversion; the billed
 * currency is named alongside it so the estimate cannot be mistaken for what
 * is charged.
 */
export async function GallurioPrice({ period }: { period?: Period }) {
  const pricing = await getDisplayPricing();

  const monthly = `${formatMoney(pricing.monthly, pricing.currency, "en")}/mo`;
  const yearly = `${formatMoney(pricing.yearly, pricing.currency, "en")}/yr`;

  if (period === "monthly") return <>{monthly}</>;
  if (period === "yearly") return <>{yearly}</>;

  if (!pricing.local) return <>{`${monthly} — ${yearly}`}</>;

  // Small converted amounts need their minor units to stay meaningful:
  // PHP 250 is about $4.30, not $4.
  const local = formatMoney(pricing.local.monthly, pricing.local.currency, "en", {
    maximumFractionDigits: pricing.local.monthly < 100 ? 2 : 0,
  });

  return <>{`${monthly} (about ${local}, billed in ${pricing.currency}) — ${yearly}`}</>;
}
