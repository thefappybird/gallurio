import { describe, expect, it } from "vitest";
import { screen } from "@testing-library/react";
import { renderWithProviders } from "@/test-utils/render";
import { BookedHoursHeatmap } from "./booked-hours-heatmap";

const labels = {
  title: "Booked hours",
  weekOf: "Week of",
  bookedHours: "Booked hours heatmap",
  weekdays: ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"],
  legend: ["0", "1-4", "5-9", "10-14", "15+"],
  empty: "No bookings scheduled yet",
  previous: "Previous heatmap dates",
  today: "Today",
  next: "Next heatmap dates",
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
          { weekStart: "2026-01-05", weekday: 0, hours: 3 },
          { weekStart: "2026-01-05", weekday: 1, hours: 20 },
        ]}
        earliestWeek="2026-01-05"
        latestWeek="2026-01-05"
        todayWeek="2026-01-05"
        todayWeekday={0}
        locale="en"
        labels={labels}
      />
    );
    expect(screen.getByText("Booked hours")).toBeInTheDocument();
    expect(screen.getByLabelText(/Tue: 20h/)).toBeInTheDocument();
  });

  it("renders every legend bucket label", () => {
    renderWithProviders(
      <BookedHoursHeatmap
        cells={[{ weekStart: "2026-01-05", weekday: 0, hours: 3 }]}
        earliestWeek="2025-12-01"
        latestWeek="2026-01-05"
        todayWeek="2026-01-05"
        todayWeekday={0}
        locale="en"
        labels={labels}
      />
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
        cells={[{ weekStart: "2026-12-04", weekday: 0, hours: 0 }]}
        earliestWeek="2026-12-04"
        latestWeek="2026-12-04"
        todayWeek="2026-12-04"
        todayWeekday={0}
        locale="en-US"
        labels={labels}
      />
    );
    expect(screen.getByText("12/04")).toBeInTheDocument();
    expect(screen.getByLabelText(/Week of 12\/04, Mon: 0h/)).toHaveClass("ring-1");
  });
});
