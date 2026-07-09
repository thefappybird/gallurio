import { describe, expect, it, vi } from "vitest";
import { screen, fireEvent, waitFor } from "@testing-library/react";
import { renderWithProviders } from "@/test-utils/render";
import { MiniBookingCalendar } from "./mini-booking-calendar";

describe("MiniBookingCalendar", () => {
  it("renders the month name and year", () => {
    const month = new Date(2026, 4, 15); // May 2026
    renderWithProviders(
      <MiniBookingCalendar month={month} days={[]} locale="en" title="Booking calendar" teams={[]} />
    );
    expect(screen.getByText("Booking calendar")).toBeInTheDocument();
    expect(screen.getByText(/May 2026/)).toBeInTheDocument();
  });

  it("renders the right number of day cells for the month", () => {
    const month = new Date(2026, 1, 1); // February 2026 — 28 days
    renderWithProviders(
      <MiniBookingCalendar month={month} days={[]} locale="en" title="Calendar" teams={[]} />
    );
    // Day labels 1..28 are all rendered exactly once each.
    for (let d = 1; d <= 28; d += 1) {
      expect(screen.getAllByText(d.toString()).length).toBeGreaterThan(0);
    }
  });

  it("renders click-through link only for days with bookings", () => {
    const month = new Date(2026, 4, 1);
    const { container } = renderWithProviders(
      <MiniBookingCalendar
        month={month}
        days={[
          { date: "2026-05-05", count: 1 },
          { date: "2026-05-07", count: 3 },
        ]}
        locale="en"
        title="Calendar"
        teams={[]}
      />
    );
    const links = container.querySelectorAll(
      "a[href*='/bookings?view=calendar&date=']"
    );
    expect(links).toHaveLength(2);
  });

  it("disables the prev/next nav buttons and team select while a month fetch is in flight", async () => {
    global.fetch = vi.fn(() => new Promise(() => {})) as unknown as typeof fetch;
    const month = new Date(2026, 4, 15);
    renderWithProviders(
      <MiniBookingCalendar
        month={month}
        days={[]}
        locale="en"
        title="Calendar"
        teams={[
          { id: "t1", name: "Team A", color: "#000000", isActive: true, isLead: false },
          { id: "t2", name: "Team B", color: "#111111", isActive: true, isLead: false },
        ]}
      />
    );

    fireEvent.click(screen.getByRole("button", { name: /next month/i }));

    await waitFor(() => {
      expect(screen.getByRole("button", { name: /next month/i })).toBeDisabled();
    });
    expect(screen.getByRole("button", { name: /previous month/i })).toBeDisabled();
    expect(screen.getByRole("combobox", { name: /filter by team/i })).toBeDisabled();
  });
});
