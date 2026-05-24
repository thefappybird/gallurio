import { describe, expect, it } from "vitest";
import { Types } from "mongoose";
import { screen } from "@testing-library/react";
import { renderWithProviders } from "@/test-utils/render";
import { UpcomingWeekList } from "./upcoming-week-list";
import type { BookingDoc } from "@/lib/db/models";

function makeBooking(overrides: Partial<BookingDoc> = {}): BookingDoc {
  return {
    _id: new Types.ObjectId(),
    workspaceId: new Types.ObjectId(),
    clientId: new Types.ObjectId(),
    clientName: "Emma Carter",
    title: "Carter Wedding",
    eventType: "wedding",
    status: "booked",
    startAt: new Date(),
    endAt: null,
    location: { address: "", lat: null, lng: null },
    amount: { total: 50000, deposit: 10000, currency: "PHP" },
    staffIds: [],
    notes: "",
    customFields: {},
    ...overrides,
  } as unknown as BookingDoc;
}

describe("UpcomingWeekList", () => {
  it("renders empty state when no bookings", () => {
    renderWithProviders(
      <UpcomingWeekList
        bookings={[]}
        locale="en"
        title="Upcoming"
        empty="Nothing upcoming."
        viewAll="View all"
      />
    );
    expect(screen.getByText("Nothing upcoming.")).toBeInTheDocument();
  });

  it("renders each booking and the view-all link", () => {
    renderWithProviders(
      <UpcomingWeekList
        bookings={[makeBooking({ title: "Future Event" })]}
        locale="en"
        title="Upcoming"
        empty="Nothing upcoming."
        viewAll="View all"
      />
    );
    expect(screen.getByText("Future Event")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /view all/i })).toBeInTheDocument();
  });
});
