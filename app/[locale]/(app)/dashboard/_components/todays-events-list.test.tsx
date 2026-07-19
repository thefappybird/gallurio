import { describe, expect, it } from "vitest";
import { Types } from "mongoose";
import { screen } from "@testing-library/react";
import { renderWithProviders } from "@/test-utils/render";
import { TodaysEventsList } from "./todays-events-list";
import type { BookingDoc } from "@/lib/db/models";

function makeBooking(overrides: Partial<BookingDoc> = {}): BookingDoc {
  const now = new Date();
  const later = new Date(now.getTime() + 2 * 60 * 60 * 1000); // +2 h
  return {
    _id: new Types.ObjectId(),
    workspaceId: new Types.ObjectId(),
    clientId: new Types.ObjectId(),
    clientName: "Emma Carter",
    title: "Carter Wedding",
    eventType: "wedding",
    status: "booked",
    sessions: [{ startAt: now, endAt: later }],
    firstSessionStart: now,
    lastSessionEnd: later,
    location: { address: "", lat: null, lng: null },
    amount: { total: 50000, deposit: 10000, currency: "PHP" },
    staffIds: [],
    notes: "",
    customFields: {},
    ...overrides,
  } as unknown as BookingDoc;
}

describe("TodaysEventsList", () => {
  it("renders empty state when no bookings", () => {
    renderWithProviders(
      <TodaysEventsList bookings={[]} locale="en" title="Today" empty="Nothing here." timeMode="12h" />
    );
    expect(screen.getByText("Nothing here.")).toBeInTheDocument();
  });

  it("renders each booking title and client name", () => {
    renderWithProviders(
      <TodaysEventsList
        bookings={[
          makeBooking({ title: "Carter Wedding", clientName: "Emma Carter" }),
          makeBooking({ title: "Shah Engagement", clientName: "Priya Shah" }),
        ]}
        locale="en"
        title="Today"
        empty="Nothing here."
        timeMode="12h"
      />
    );
    expect(screen.getByText("Carter Wedding")).toBeInTheDocument();
    expect(screen.getByText("Shah Engagement")).toBeInTheDocument();
    expect(screen.getByText(/Emma Carter/)).toBeInTheDocument();
  });

  it("shows status as a badge", () => {
    renderWithProviders(
      <TodaysEventsList
        bookings={[makeBooking({ status: "booked" })]}
        locale="en"
        title="Today"
        empty="Nothing here."
        timeMode="12h"
      />
    );
    // StatusChip renders the capitalized i18n label, not the raw status.
    expect(screen.getByText("Booked")).toBeInTheDocument();
  });
});
