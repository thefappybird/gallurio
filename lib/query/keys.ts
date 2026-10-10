import type { QueryKey } from "@tanstack/react-query";

/** Reference data (clients picker, team options) changes rarely. */
export const REFERENCE_STALE_TIME = 5 * 60_000;

/** For surfaces that seed local edit state from a query: never refetch under the user's edits. */
export const EDITABLE_QUERY_OPTIONS = { refetchOnWindowFocus: false } as const;

/**
 * Key factory. EVERY key starts `["ws", workspaceId, <domain>, ...]` so a
 * workspace switch can never serve another tenant's cache, and so invalidation
 * can target a domain by prefix. Id args are optional: omit for the domain prefix.
 */
export function queryKeys(workspaceId: string) {
  const root = ["ws", workspaceId] as const;
  const k = (...rest: unknown[]): QueryKey => [...root, ...rest];
  return {
    root: k(),
    booking: (id?: string) => (id === undefined ? k("booking") : k("booking", id)),
    bookingActivity: (id?: string, page?: number) =>
      id === undefined ? k("bookingActivity") : page === undefined ? k("bookingActivity", id) : k("bookingActivity", id, page),
    bookings: (...rest: unknown[]) => k("bookings", ...rest),
    calendar: (...rest: unknown[]) => k("calendar", ...rest),
    clients: (...rest: unknown[]) => k("clients", ...rest),
    client: (id?: string) => (id === undefined ? k("client") : k("client", id)),
    clientBookings: (id: string) => k("client", id, "bookings"),
    clientPayments: (id: string) => k("client", id, "payments"),
    inquiries: (...rest: unknown[]) => k("inquiries", ...rest),
    inquiry: (id?: string) => (id === undefined ? k("inquiry") : k("inquiry", id)),
    dashboard: (...rest: unknown[]) => k("dashboard", ...rest),
    dashboardMiniCalendar: (month: string, teams?: string[]) => k("dashboard", "miniCalendar", month, teams ?? []),
    teams: (...rest: unknown[]) => k("teams", ...rest),
    memberActivity: (userId?: string, filters?: unknown) =>
      userId === undefined ? k("memberActivity") : filters === undefined ? k("memberActivity", userId) : k("memberActivity", userId, filters),
    shifts: (dates?: string[]) => (dates === undefined ? k("shifts") : k("shifts", dates)),
  };
}
