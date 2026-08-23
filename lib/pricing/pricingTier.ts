// Which Pro price a visitor sees/pays, resolved from CF-IPCountry. Two tiers
// of the same Pro plan: "base" is the default (including the launch market,
// PH), "global" is a higher price for a fixed set of high-income countries.
// Unlike countryCurrency.ts (display-only, wrong guess just shows an odd
// number), a tier miss changes what Lemon Squeezy actually charges — so this
// table is short and explicit rather than trying to cover every country.
export type PricingTier = "base" | "global";

const GLOBAL_COUNTRIES = new Set([
  "US", "CA", "GB", "IE", "FR", "DE", "NL", "BE", "LU", "AT", "CH", "DK",
  "SE", "NO", "FI", "IS", "IT", "ES", "PT", "AU", "NZ", "JP", "SG", "HK",
  "KR", "TW", "IL", "AE",
]);

// In production Cloudflare always sets CF-IPCountry, so a missing value means
// the origin was reached directly (proxy bypassed) rather than a real unknown
// visitor. Defaulting that — and Cloudflare's own "XX" unknown code, and "T1"
// Tor traffic — to the cheap tier leaks less than overcharging a launch-market
// buyer whose header didn't arrive.
export function tierForCountry(country: string | null | undefined): PricingTier {
  if (!country) return "base";
  return GLOBAL_COUNTRIES.has(country.trim().toUpperCase()) ? "global" : "base";
}
