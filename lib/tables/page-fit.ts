// Cookie-persisted "rows that fit the viewport" for table pages. Pure so both
// the server pages and the client fit hook share one definition.

export const TABLE_FIT_COOKIE = {
  bookings: "gw_table_fit_bookings",
  inquiries: "gw_table_fit_inquiries",
  clients: "gw_table_fit_clients",
} as const;

export type FitTable = keyof typeof TABLE_FIT_COOKIE;

const MIN_FIT = 10;
const MAX_FIT = 50;
const STANDARD_SIZES = [20, 30, 50];

export function parseFitCookie(v?: string): number | undefined {
  if (!v || !/^\d+$/.test(v)) return undefined;
  const n = Number(v);
  return Number.isSafeInteger(n) && n > 0 ? n : undefined;
}

export function resolvePageSize(fit?: number): { base: number; options: number[] } {
  const base = Math.min(MAX_FIT, Math.max(MIN_FIT, fit ?? MIN_FIT));
  return { base, options: [base, ...STANDARD_SIZES.filter((o) => o > base)] };
}

export function resolveLimit(rawLimit: string | undefined, fit?: number): number {
  const { base, options } = resolvePageSize(fit);
  const parsed = Number.parseInt(rawLimit ?? "", 10);
  return options.includes(parsed) ? parsed : base;
}
