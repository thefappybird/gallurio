import { describe, expect, it, vi } from "vitest";
import { Suspense, isValidElement, type ReactElement } from "react";
import { CalendarSkeleton } from "@/components/app/calendar-skeleton";
import { TableSkeleton } from "@/components/app/table-skeleton";

let mockView = "calendar";
let mockFit: string | undefined;
vi.mock("next/headers", () => ({
  cookies: async () => ({
    get: (name: string) =>
      name === "gw_table_fit_inquiries" && mockFit ? { value: mockFit } : undefined,
  }),
}));
vi.mock("next-intl/server", () => ({ setRequestLocale: vi.fn(), getTranslations: vi.fn() }));
vi.mock("@/lib/i18n/navigation", () => ({ redirect: vi.fn() }));
vi.mock("@/lib/view-preferences.server", () => ({
  resolveStoredCollectionView: async () => mockView,
}));
vi.mock("@/lib/auth/requireOrg", () => ({ requireOrg: vi.fn() }));
vi.mock("@/lib/auth/bookingTeamScope", () => ({ resolveBookingTeamScope: vi.fn() }));
vi.mock("@/lib/db/queries/inquiries", () => ({
  listInquiries: vi.fn(), getInquiryStatusCounts: vi.fn(), getInquiryWithDraft: vi.fn(),
}));
vi.mock("@/lib/db/queries/inquiry-conflicts", () => ({ computeInquiryConflicts: vi.fn() }));
vi.mock("../bookings/_data/calendar-events", () => ({ parseCalendarDate: vi.fn() }));
vi.mock("../bookings/_data/team-options", () => ({ getBookingTeamOptions: vi.fn() }));
vi.mock("./_data/calendar-data", () => ({ loadInquiriesCalendarData: vi.fn() }));
vi.mock("./_components/inquiries-page-client", () => ({ InquiriesPageClient: () => null }));
vi.mock("../bookings/_components/booking-url-modals", () => ({ BookingUrlModals: () => null }));

import InquiriesPage from "./page";

async function render(view: string, searchParams: Record<string, string> = {}) {
  mockView = view;
  const el = await InquiriesPage({
    params: Promise.resolve({ locale: "en" }),
    searchParams: Promise.resolve(searchParams),
  });
  const fallback = (el as ReactElement<{ fallback: ReactElement }>).props.fallback;
  const kids = (fallback.props as { children: unknown[] }).children.flat();
  return { el: el as ReactElement, kids };
}

describe("InquiriesPage Suspense structure", () => {
  it("calendar view: keyed Suspense with the calendar skeleton fallback", async () => {
    const { el, kids } = await render("calendar");
    expect(el.type).toBe(Suspense);
    expect(el.key).toBe("calendar");
    expect(kids.some((k) => isValidElement(k) && k.type === CalendarSkeleton)).toBe(true);
  });

  it("table view: fallback is the table skeleton with DEFAULT_PAGE_SIZE rows", async () => {
    const { el, kids } = await render("table");
    expect(el.key).toBe("table");
    const table = kids.find((k) => isValidElement(k) && k.type === TableSkeleton) as ReactElement<{ rows: number }>;
    expect(table.props.rows).toBe(10);
  });

  it("table view: skeleton rows come from the fit cookie, and ?limit when a valid option", async () => {
    mockFit = "14";
    try {
      const rowsFor = async (sp: Record<string, string>) => {
        const { kids } = await render("table", sp);
        return (kids.find((k) => isValidElement(k) && k.type === TableSkeleton) as ReactElement<{ rows: number }>)
          .props.rows;
      };
      expect(await rowsFor({})).toBe(14);
      expect(await rowsFor({ limit: "30" })).toBe(30);
    } finally {
      mockFit = undefined;
    }
  });
});
