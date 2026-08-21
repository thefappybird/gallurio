import { frozenOrLiveAmount, type RateMap } from "@/lib/pricing/currencyConverter";

type BookingAmount = {
  total?: number | null;
  currency?: string | null;
  fxRate?: number | null;
  fxTarget?: string | null;
};

/**
 * The figure a booking list row shows: always the workspace currency, never
 * the booking's own. List rows have no space for a second line, and a column
 * of mixed currencies cannot be scanned or compared — the booking's own
 * currency is on the detail modal, where the frozen rate is shown with it.
 *
 * Prefers the rate frozen on the booking (what the money was actually worth
 * when it was collected) and falls back to the live rate map.
 */
export function bookingRowAmount(
  amount: BookingAmount | null | undefined,
  rates: RateMap,
  workspaceCurrency: string
): { total: number; currency: string } {
  const total = frozenOrLiveAmount(
    amount?.total ?? 0,
    amount?.currency,
    rates,
    workspaceCurrency,
    amount?.fxRate,
    amount?.fxTarget
  );
  return { total, currency: workspaceCurrency };
}
