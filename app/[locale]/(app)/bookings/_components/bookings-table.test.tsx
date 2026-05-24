import { describe, expect, it } from "vitest";
import { screen } from "@testing-library/react";
import { renderWithProviders } from "@/test-utils/render";
import { BookingsTable, type BookingRow } from "./bookings-table";

const sampleRows: BookingRow[] = [
  {
    id: "1",
    title: "Carter Wedding",
    clientName: "Emma Carter",
    sessions: [
      { startAt: "2026-08-15T10:00:00Z", endAt: "2026-08-15T18:00:00Z" },
    ],
    status: "booked",
    total: 75_000,
    currency: "PHP",
  },
  {
    id: "2",
    title: "Old Cancelled Event",
    clientName: "Priya Shah",
    sessions: [
      { startAt: "2026-07-01T10:00:00Z", endAt: "2026-07-01T17:00:00Z" },
    ],
    status: "cancelled",
    total: 25_000,
    currency: "PHP",
  },
];

describe("BookingsTable", () => {
  it("renders rows with title, client, and money column", () => {
    renderWithProviders(
      <BookingsTable rows={sampleRows} locale="en" empty="No rows" />
    );
    expect(screen.getByText("Carter Wedding")).toBeInTheDocument();
    expect(screen.getByText("Emma Carter")).toBeInTheDocument();
    expect(screen.getByText(/75,000/)).toBeInTheDocument();
  });

  it("renders empty state when rows is empty", () => {
    renderWithProviders(<BookingsTable rows={[]} locale="en" empty="No rows" />);
    expect(screen.getByText("No rows")).toBeInTheDocument();
  });

  it("applies line-through styling to the title cell of cancelled rows", () => {
    const { container } = renderWithProviders(
      <BookingsTable rows={sampleRows} locale="en" empty="No rows" />
    );
    const cells = container.querySelectorAll("td");
    const cancelledTitleCell = Array.from(cells).find(
      (c) => c.textContent === "Old Cancelled Event"
    );
    expect(cancelledTitleCell?.className).toMatch(/line-through/);
  });
});
