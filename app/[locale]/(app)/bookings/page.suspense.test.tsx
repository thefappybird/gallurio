import { describe, expect, it, vi } from "vitest";
import { Suspense, isValidElement, type ReactElement } from "react";
import { CalendarSkeleton } from "@/components/app/calendar-skeleton";
import { TableSkeleton } from "@/components/app/table-skeleton";

let mockView = "calendar";
vi.mock("next-intl/server", () => ({ setRequestLocale: vi.fn(), getTranslations: vi.fn() }));
vi.mock("@/lib/view-preferences.server", () => ({
  resolveStoredCollectionView: async () => mockView,
}));
// Data modules are never reached by the page shell (they live in the streamed child).
vi.mock("@/lib/auth/requireOrg", () => ({ requireOrg: vi.fn() }));
vi.mock("@/lib/auth/bookingTeamScope", () => ({ resolveBookingTeamScope: vi.fn() }));
vi.mock("./_data/team-options", () => ({ getBookingTeamOptions: vi.fn() }));
vi.mock("@/lib/db/mongoose", () => ({ connectDB: vi.fn() }));
vi.mock("@/lib/db/models", () => ({ Client: {} }));
vi.mock("./_data/bookings-queries", () => ({ listBookings: vi.fn() }));
vi.mock("./_data/calendar-events", () => ({ loadBookingsCalendarEvents: vi.fn(), parseCalendarDate: vi.fn() }));
vi.mock("./_data/booking-rows", () => ({ bookingRowAmount: vi.fn() }));
vi.mock("@/lib/pricing/workspaceRates", () => ({ getWorkspaceRateMap: vi.fn(), NO_CONVERSION: {} }));
vi.mock("./_data/booking-filters", () => ({ parseBookingsToggleFilters: vi.fn() }));
vi.mock("./_components/bookings-pending-shell", () => ({ BookingsPendingShell: () => null }));
vi.mock("./_components/calendar-booking-manager", () => ({ CalendarBookingManager: () => null }));
vi.mock("./_components/table-booking-manager", () => ({ TableBookingManager: () => null }));
vi.mock("./_components/bookings-page-client", () => ({ BookingsPageClient: () => null }));
vi.mock("./_components/booking-url-modals", () => ({ BookingUrlModals: () => null }));
vi.mock("@/lib/invoices/theme", () => ({ INVOICE_THEME_PRESETS: {} }));

import BookingsPage from "./page";

async function render(view: string): Promise<ReactElement<{ fallback: ReactElement }>> {
  mockView = view;
  const el = await BookingsPage({
    params: Promise.resolve({ locale: "en" }),
    searchParams: Promise.resolve({}),
  });
  expect(isValidElement(el)).toBe(true);
  return el as ReactElement<{ fallback: ReactElement }>;
}

describe("BookingsPage Suspense structure", () => {
  it("calendar view: keyed Suspense whose fallback is the calendar skeleton", async () => {
    const el = await render("calendar");
    expect(el.type).toBe(Suspense);
    expect(el.key).toBe("calendar");
    const kids = (el.props.fallback.props as { children: unknown[] }).children.flat();
    expect(kids.some((k) => isValidElement(k) && k.type === CalendarSkeleton)).toBe(true);
    expect(kids.some((k) => isValidElement(k) && k.type === TableSkeleton)).toBe(false);
  });

  it("table view: keyed by view, fallback is the table skeleton with DEFAULT_PAGE_SIZE rows", async () => {
    const el = await render("table");
    expect(el.key).toBe("table");
    const kids = (el.props.fallback.props as { children: unknown[] }).children.flat();
    const table = kids.find((k) => isValidElement(k) && k.type === TableSkeleton) as ReactElement<{ rows: number }>;
    expect(table.props.rows).toBe(10);
  });
});
