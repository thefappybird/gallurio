import { getFxRate } from "./fxRates";

// Multiplier per source currency into one target currency.
export type RateMap = Record<string, number>;

// Resolves the multipliers needed to roll a set of currencies up into
// `target`. The target itself never costs a lookup. All-or-nothing: if any
// requested foreign currency can't be rated (timeout, rate-limited, etc.),
// returns `{ [to]: 1 }` so callers take the single-currency (unconverted)
// path rather than silently summing a mix of converted and raw amounts.
export async function buildRateMap(
  target: string,
  currencies: readonly string[]
): Promise<RateMap> {
  const to = target.toUpperCase();
  const foreign = [...new Set(currencies.map((c) => c.toUpperCase()))].filter((c) => c !== to);

  if (foreign.length === 0) return { [to]: 1 };

  const rates = await Promise.all(foreign.map((c) => getFxRate(c, to)));
  if (rates.some((r) => r === null)) return { [to]: 1 };

  const map: RateMap = { [to]: 1 };
  foreign.forEach((c, i) => {
    map[c] = rates[i] as number;
  });
  return map;
}

// True when the map holds at most the target currency itself — i.e. nothing
// needs converting and callers can take their cheap path.
export function isSingleCurrency(rates: RateMap): boolean {
  return Object.keys(rates).length <= 1;
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
      case: { $eq: [{ $toUpper: { $ifNull: [currencyField, ""] } }, currency] },
      then: { $multiply: [{ $ifNull: [amountField, 0] }, rate] },
    }));

  if (branches.length === 0) return { $ifNull: [amountField, 0] };

  return { $switch: { branches, default: { $ifNull: [amountField, 0] } } };
}
