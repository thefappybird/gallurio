import { getFxRate } from "./fxRates";

// Multiplier per source currency into one target currency.
export type RateMap = Record<string, number>;

// Resolves the multipliers needed to roll a set of currencies up into
// `target`. The target itself never costs a lookup.
export async function buildRateMap(
  target: string,
  currencies: readonly string[]
): Promise<RateMap> {
  const to = target.toUpperCase();
  const map: RateMap = {};

  for (const raw of new Set(currencies.map((c) => c.toUpperCase()))) {
    if (raw === to) {
      map[raw] = 1;
      continue;
    }
    const rate = await getFxRate(raw, to);
    if (rate !== null) map[raw] = rate;
  }

  return map;
}

// In-JS counterpart of convertedAmountExpr, for totals summed in application
// code rather than in an aggregation pipeline. Same pass-through rule.
export function convertAmount(
  amount: number,
  currency: string | null | undefined,
  rates: RateMap
): number {
  if (!currency) return amount;
  const rate = rates[currency.toUpperCase()];
  return rate ? amount * rate : amount;
}

// Mongo aggregation expression converting one document's amount into the
// target currency before it is summed. A document whose currency has no entry
// in `rates` — including legacy rows with no currency field at all — passes
// through unconverted, which is right for the overwhelmingly common
// single-currency workspace and never drops money from a total.
export function convertedAmountExpr(
  amountField: string,
  currencyField: string,
  rates: RateMap
): Record<string, unknown> {
  const branches = Object.entries(rates)
    .filter(([, rate]) => rate !== 1)
    .map(([currency, rate]) => ({
      case: { $eq: [currencyField, currency] },
      then: { $multiply: [{ $ifNull: [amountField, 0] }, rate] },
    }));

  if (branches.length === 0) return { $ifNull: [amountField, 0] };

  return { $switch: { branches, default: { $ifNull: [amountField, 0] } } };
}
