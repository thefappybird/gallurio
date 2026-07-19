import { describe, expect, it } from "vitest";
import { screen } from "@testing-library/react";
import { renderWithProviders } from "@/test-utils/render";
import { EventTypeDonut } from "./event-type-donut";

describe("EventTypeDonut", () => {
  it("shows empty state when there are no bookings", () => {
    renderWithProviders(<EventTypeDonut data={[]} title="Event types" empty="No data" />);
    expect(screen.getByText("No data")).toBeInTheDocument();
  });

  it("renders the legend with capitalized labels + percentages", () => {
    renderWithProviders(
      <EventTypeDonut
        data={[
          { eventType: "wedding", count: 8 },
          { eventType: "corporate", count: 2 },
        ]}
        title="Event types"
        empty="No data"
      />
    );
    expect(screen.getByText("Wedding")).toBeInTheDocument();
    expect(screen.getByText("Corporate")).toBeInTheDocument();
    expect(screen.getByText(/80%/)).toBeInTheDocument();
    expect(screen.getByText(/20%/)).toBeInTheDocument();
  });

  it("renders the total count in the center", () => {
    renderWithProviders(
      <EventTypeDonut
        data={[{ eventType: "wedding", count: 10 }]}
        title="Event types"
        empty="No data"
      />
    );
    expect(screen.getByText("10")).toBeInTheDocument();
  });
});
