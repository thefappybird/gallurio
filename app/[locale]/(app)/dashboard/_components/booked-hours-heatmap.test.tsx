import { describe, expect, it, vi } from "vitest";
import { screen } from "@testing-library/react";
import { renderWithProviders, enMessages } from "@/test-utils/render";
import { BookedHoursHeatmap } from "./booked-hours-heatmap";

const pushMock = vi.fn();
vi.mock("@/lib/i18n/navigation", () => ({
  useRouter: () => ({ push: pushMock }),
  usePathname: () => "/dashboard",
}));
vi.mock("next/navigation", async (importOriginal) => ({
  ...(await importOriginal()),
  useSearchParams: () => new URLSearchParams(),
}));

// The "bookingsCount" ICU-plural key is new and not yet in messages/en.json
// (locale files are updated separately). Override just that key here so
// tests exercise the real plural-formatting path instead of the
// missing-message fallback.
const messagesWithBookingsCount = {
  ...enMessages,
  app: {
    ...enMessages.app,
    dashboard: {
      ...enMessages.app.dashboard,
      booking: {
        ...enMessages.app.dashboard.booking,
        heatmap: {
          ...enMessages.app.dashboard.booking.heatmap,
          bookingsCount: "{count, plural, one {# booking} other {# bookings}}",
        },
      },
    },
  },
};

const labels = {
  title: "Booked hours",
  bookedHours: "Booked hours heatmap",
  weekdays: ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"],
  legend: ["0", "1-4", "5-9", "10-14", "15+"],
  empty: "No bookings scheduled yet",
  previous: "Previous heatmap dates",
  today: "Today",
  next: "Next heatmap dates",
  skipPrevious: "Skip back 5 pages",
  skipNext: "Skip forward 5 pages",
};

describe("BookedHoursHeatmap", () => {
  it("shows empty copy when there are no cells", () => {
    renderWithProviders(<BookedHoursHeatmap cells={[]} earliestWeek="2026-01-05" latestWeek="2026-01-05" todayWeek="2026-01-05" todayWeekday={0} locale="en" labels={labels} />);
    expect(screen.getByText("No bookings scheduled yet")).toBeInTheDocument();
  });

  it("renders the title and an accessible label for a 15+ hour cell", () => {
    renderWithProviders(
      <BookedHoursHeatmap
        cells={[
          { weekStart: "2026-01-05", weekday: 0, hours: 3, bookings: 1 },
          { weekStart: "2026-01-05", weekday: 1, hours: 20, bookings: 3 },
        ]}
        earliestWeek="2026-01-05"
        latestWeek="2026-01-05"
        todayWeek="2026-01-05"
        todayWeekday={0}
        locale="en"
        labels={labels}
      />,
      { messages: messagesWithBookingsCount }
    );
    expect(screen.getByText("Booked hours")).toBeInTheDocument();
    expect(screen.getByLabelText(/Jan 6.*20h/)).toBeInTheDocument();
  });

  it("renders every legend bucket label", () => {
    renderWithProviders(
      <BookedHoursHeatmap
        cells={[{ weekStart: "2026-01-05", weekday: 0, hours: 3, bookings: 1 }]}
        earliestWeek="2025-12-01"
        latestWeek="2026-01-05"
        todayWeek="2026-01-05"
        todayWeekday={0}
        locale="en"
        labels={labels}
      />,
      { messages: messagesWithBookingsCount }
    );
    for (const l of labels.legend) {
      expect(screen.getByText(l)).toBeInTheDocument();
    }
    expect(screen.getByRole("button", { name: labels.previous })).toBeEnabled();
    expect(screen.getByRole("button", { name: labels.next })).toBeDisabled();
    expect(screen.getByRole("button", { name: labels.today })).toBeDisabled();
  });

  it("uses a numeric date order from the supplied locale for week labels", () => {
    renderWithProviders(
      <BookedHoursHeatmap
        cells={[{ weekStart: "2026-12-04", weekday: 0, hours: 0, bookings: 0 }]}
        earliestWeek="2026-12-04"
        latestWeek="2026-12-04"
        todayWeek="2026-12-04"
        todayWeekday={0}
        locale="en-US"
        labels={labels}
      />,
      { messages: messagesWithBookingsCount }
    );
    expect(screen.getByText("12/04")).toBeInTheDocument();
    expect(screen.getByLabelText(/Dec 4.*0 bookings.*0h/)).toHaveClass("ring-1");
  });

  it("shows a tooltip with the date, bookings, and hours on cell focus", async () => {
    renderWithProviders(
      <BookedHoursHeatmap
        cells={[{ weekStart: "2026-01-05", weekday: 0, hours: 6, bookings: 2 }]}
        earliestWeek="2026-01-05"
        latestWeek="2026-01-05"
        todayWeek="2026-01-05"
        todayWeekday={0}
        locale="en"
        labels={labels}
      />,
      { messages: messagesWithBookingsCount }
    );
    const cell = screen.getByLabelText(/Mon, Jan 5/);
    cell.focus();
    const tooltip = await screen.findByText((_, el) => el?.getAttribute("data-slot") === "tooltip-content");
    expect(tooltip.textContent).toMatch(/Mon, Jan 5/);
    expect(tooltip.textContent).toMatch(/2/);
    expect(tooltip.textContent).toMatch(/6h/);
  });

  it("shows skip-back/skip-forward buttons only when more than 5 pages remain in that direction", () => {
    renderWithProviders(
      <BookedHoursHeatmap
        cells={[{ weekStart: "2026-01-05", weekday: 0, hours: 3, bookings: 1 }]}
        earliestWeek="2000-01-03"
        latestWeek="2050-01-03"
        todayWeek="2026-01-05"
        todayWeekday={0}
        locale="en"
        labels={labels}
      />,
      { messages: messagesWithBookingsCount }
    );
    expect(screen.getByRole("button", { name: labels.skipPrevious })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: labels.skipNext })).toBeInTheDocument();
  });

  it("hides skip-back/skip-forward buttons when 5 or fewer pages remain", () => {
    renderWithProviders(
      <BookedHoursHeatmap
        cells={[{ weekStart: "2026-01-05", weekday: 0, hours: 3, bookings: 1 }]}
        earliestWeek="2026-01-05"
        latestWeek="2026-01-05"
        todayWeek="2026-01-05"
        todayWeekday={0}
        locale="en"
        labels={labels}
      />,
      { messages: messagesWithBookingsCount }
    );
    expect(screen.queryByRole("button", { name: labels.skipPrevious })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: labels.skipNext })).not.toBeInTheDocument();
  });

  it("jumps 5 pages forward when skip-forward is clicked, clamped to latestWeek", () => {
    pushMock.mockClear();
    renderWithProviders(
      <BookedHoursHeatmap
        cells={[{ weekStart: "2026-01-05", weekday: 0, hours: 3, bookings: 1 }]}
        earliestWeek="2000-01-03"
        latestWeek="2050-01-03"
        todayWeek="2026-01-05"
        todayWeekday={0}
        locale="en"
        labels={labels}
      />,
      { messages: messagesWithBookingsCount }
    );
    // Single visible week (pageSize=1) ending 2026-01-05; 5 pages forward = +5 weeks.
    screen.getByRole("button", { name: labels.skipNext }).click();
    expect(pushMock).toHaveBeenCalledWith(expect.stringContaining("hm=2026-02-09"));
  });
});
