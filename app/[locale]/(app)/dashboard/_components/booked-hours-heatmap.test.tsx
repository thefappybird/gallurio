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
};

describe("BookedHoursHeatmap", () => {
  it("shows empty copy when there are no cells", () => {
    renderWithProviders(<BookedHoursHeatmap cells={[]} locale="en" labels={labels} />);
    expect(screen.getByText("No bookings scheduled yet")).toBeInTheDocument();
  });

  it("renders the title and an accessible label for a 15+ hour cell", () => {
    renderWithProviders(
      <BookedHoursHeatmap
        cells={[
          { weekStart: "2026-01-05", weekday: 0, hours: 3 },
          { weekStart: "2026-01-05", weekday: 1, hours: 20 },
        ]}
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
        locale="en"
        labels={labels}
      />
    );
    for (const l of labels.legend) {
      expect(screen.getByText(l)).toBeInTheDocument();
    }
  });
});
