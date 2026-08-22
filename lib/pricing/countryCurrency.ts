// ISO 3166-1 alpha-2 country -> ISO 4217 currency, for the display-only local
// price estimate. Node ships no country->currency data, so this is a hand-kept
// table covering the markets we sell into plus the common ones. Anything not
// listed falls back to USD — an estimate in a currency the visitor recognises
// beats no estimate at all. Never used for billing: Lemon Squeezy always
// charges the store currency.
const COUNTRY_CURRENCY: Record<string, string> = {
  // Southeast Asia
  PH: "PHP",
  ID: "IDR",
  TH: "THB",
  MY: "MYR",
  SG: "SGD",
  VN: "VND",
  KH: "USD",
  BN: "BND",
  // South Asia
  IN: "INR",
  PK: "PKR",
  BD: "BDT",
  LK: "LKR",
  NP: "NPR",
  // Gulf / Middle East
  AE: "AED",
  SA: "SAR",
  QA: "QAR",
  KW: "KWD",
  BH: "BHD",
  OM: "OMR",
  JO: "JOD",
  LB: "USD",
  IL: "ILS",
  TR: "TRY",
  EG: "EGP",
  MA: "MAD",
  // East Asia / Oceania
  JP: "JPY",
  KR: "KRW",
  CN: "CNY",
  HK: "HKD",
  TW: "TWD",
  MO: "MOP",
  AU: "AUD",
  NZ: "NZD",
  // Americas
  US: "USD",
  CA: "CAD",
  MX: "MXN",
  BR: "BRL",
  AR: "ARS",
  CL: "CLP",
  CO: "COP",
  PE: "PEN",
  // Europe — euro area
  AT: "EUR",
  BE: "EUR",
  CY: "EUR",
  DE: "EUR",
  EE: "EUR",
  ES: "EUR",
  FI: "EUR",
  FR: "EUR",
  GR: "EUR",
  HR: "EUR",
  IE: "EUR",
  IT: "EUR",
  LT: "EUR",
  LU: "EUR",
  LV: "EUR",
  MT: "EUR",
  NL: "EUR",
  PT: "EUR",
  SI: "EUR",
  SK: "EUR",
  // Europe — non-euro
  GB: "GBP",
  CH: "CHF",
  SE: "SEK",
  NO: "NOK",
  DK: "DKK",
  PL: "PLN",
  CZ: "CZK",
  HU: "HUF",
  RO: "RON",
  BG: "BGN",
  UA: "UAH",
  // Africa
  ZA: "ZAR",
  NG: "NGN",
  KE: "KES",
  GH: "GHS",
  TZ: "TZS",
};

export const FALLBACK_CURRENCY = "USD";

export function currencyForCountry(country: string | null | undefined): string {
  if (!country) return FALLBACK_CURRENCY;
  return COUNTRY_CURRENCY[country.trim().toUpperCase()] ?? FALLBACK_CURRENCY;
}
