export type BookingsToggleParams = {
  includeCancelled?: string;
  showPast?: string;
};

export type BookingsToggleFlags = {
  includeCancelled: boolean;
  includePast: boolean;
};

/**
 * Cancelled + past-booking filters are opt-OUT: absent (or any value other
 * than "0") means the filter is ON. Switching a filter off pushes "0";
 * switching it back on clears the param (`null`) so the default state stays
 * URL-clean.
 */
export function parseBookingsToggleFilters(sp: BookingsToggleParams): BookingsToggleFlags {
  return {
    includeCancelled: sp.includeCancelled !== "0",
    includePast: sp.showPast !== "0",
  };
}
