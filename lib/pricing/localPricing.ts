import { headers } from "next/headers";
import { getProPricing, type ProPricing } from "@/lib/lemonsqueezy/pricing";
import { currencyForCountry } from "./countryCurrency";
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
  const pricing = await getProPricing();

  const country = (await headers()).get("cf-ipcountry");
  const target = currencyForCountry(country);
  if (target === pricing.currency) return pricing;

  const rate = await getFxRate(pricing.currency, target);
  if (!rate) return pricing;

  return {
    ...pricing,
    local: {
      currency: target,
      monthly: pricing.monthly * rate,
      yearly: pricing.yearly * rate,
    },
  };
}
