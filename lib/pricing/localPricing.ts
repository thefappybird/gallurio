import { headers } from "next/headers";
import { getProPricing, type ProPricing } from "@/lib/lemonsqueezy/pricing";
import { currencyForCountry } from "./countryCurrency";
import { tierForCountry } from "./pricingTier";
import { getFxRate } from "./fxRates";

// Live Lemon Squeezy pricing plus a display-only equivalent in the visitor's
// local currency.
//
// Country comes from Cloudflare's CF-IPCountry header (production sits behind
// proxied Cloudflare DNS). It is spoofable when the origin is reached directly,
// which is harmless here: the value only chooses which approximate figure to
// render next to the real price. Lemon Squeezy charges the store currency by
// variant id regardless. Unknown/absent country falls back to USD.
export async function getDisplayPricing(): Promise<ProPricing> {
  const country = (await headers()).get("cf-ipcountry");
  const pricing = await getProPricing(tierForCountry(country));

  const target = currencyForCountry(country);
  if (target === pricing.currency) return pricing;

  // The visitor's own currency is the headline price, so a currency the rate
  // table doesn't carry falls back to USD rather than dropping them back to
  // the store currency — USD reads as a price anywhere, PHP does not.
  let display = target;
  let rate = await getFxRate(pricing.currency, target);
  if (!rate && target !== "USD" && pricing.currency !== "USD") {
    display = "USD";
    rate = await getFxRate(pricing.currency, "USD");
  }
  if (!rate) return pricing;

  return {
    ...pricing,
    local: {
      currency: display,
      monthly: pricing.monthly * rate,
      yearly: pricing.yearly * rate,
    },
  };
}
