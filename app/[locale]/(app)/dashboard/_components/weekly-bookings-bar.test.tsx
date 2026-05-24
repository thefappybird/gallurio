import { describe, expect, it } from "vitest";
import { screen } from "@testing-library/react";
import { renderWithProviders } from "@/test-utils/render";
import { WeeklyBookingsBar } from "./weekly-bookings-bar";

const sampleData = [
  { day: "Sun", count: 1 },
  { day: "Mon", count: 3 },
  { day: "Tue", count: 5 },
  { day: "Wed", count: 4 },
  { day: "Thu", count: 6 },
  { day: "Fri", count: 8 },
  { day: "Sat", count: 9 },
];

describe("WeeklyBookingsBar", () => {
  it("renders title and mounts with sample data", () => {
    renderWithProviders(<WeeklyBookingsBar data={sampleData} title="Weekly" />);
    expect(screen.getByText("Weekly")).toBeInTheDocument();
  });

  it("handles empty data without crashing", () => {
    renderWithProviders(<WeeklyBookingsBar data={[]} title="Weekly" />);
    expect(screen.getByText("Weekly")).toBeInTheDocument();
  });
});
