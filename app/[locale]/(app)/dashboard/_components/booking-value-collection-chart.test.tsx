import { describe, expect, it, vi, beforeEach } from "vitest";
import React from "react";
import { screen } from "@testing-library/react";
import { renderWithProviders } from "@/test-utils/render";

const captured = vi.hoisted(() => ({
  lines: [] as Record<string, unknown>[],
  xAxis: null as Record<string, unknown> | null,
  yAxis: null as Record<string, unknown> | null,
}));

vi.mock("recharts", async () => {
  const R = (await import("react")).default;
  function XAxis(props: Record<string, unknown>) {
    captured.xAxis = props;
    return null;
  }
  function YAxis(props: Record<string, unknown>) {
    captured.yAxis = props;
    return null;
  }
  function Line(props: Record<string, unknown>) {
    captured.lines.push(props);
    return null;
  }
  return {
    ResponsiveContainer: ({ children }: { children: React.ReactNode }) =>
      R.createElement(R.Fragment, null, children),
    LineChart: ({ children }: { children: React.ReactNode }) =>
      R.createElement(R.Fragment, null, children),
    Line,
    XAxis,
    YAxis,
    Tooltip: () => null,
    Legend: () => null,
  };
});

import { BookingValueCollectionChart } from "./booking-value-collection-chart";

const labels = {
  bookedValue: "Booked value",
  collectedRevenue: "Collected revenue",
  empty: "No data yet",
};

describe("BookingValueCollectionChart", () => {
  beforeEach(() => {
    captured.lines = [];
    captured.xAxis = null;
    captured.yAxis = null;
  });

  it("shows empty copy when there is no data", () => {
    renderWithProviders(
      <BookingValueCollectionChart data={[]} currency="PHP" locale="en" labels={labels} />
    );
    expect(screen.getByText("No data yet")).toBeInTheDocument();
  });

  it("renders scheduled + collected lines with the translated names", () => {
    renderWithProviders(
      <BookingValueCollectionChart
        data={[
          { bucket: "2026-01-05", scheduledValue: 1000, collected: 400 },
          { bucket: "2026-01-12", scheduledValue: 1500, collected: 900 },
        ]}
        currency="PHP"
        locale="en"
        labels={labels}
      />
    );
    expect(captured.lines).toHaveLength(2);
    expect(captured.lines[0]).toMatchObject({
      dataKey: "scheduledValue",
      name: "Booked value",
      stroke: "var(--chart-1)",
    });
    expect(captured.lines[1]).toMatchObject({
      dataKey: "collected",
      name: "Collected revenue",
      stroke: "var(--chart-2)",
    });
    expect(captured.lines[1].strokeDasharray).toBeTruthy();
  });

  it("reverses the axes for Arabic (RTL) locale", () => {
    renderWithProviders(
      <BookingValueCollectionChart
        data={[{ bucket: "2026-01-05", scheduledValue: 1000, collected: 400 }]}
        currency="PHP"
        locale="ar"
        labels={labels}
      />,
      { locale: "ar" }
    );
    expect(captured.xAxis?.reversed).toBe(true);
    expect(captured.yAxis?.orientation).toBe("right");
  });

  it("renders the card title when provided", () => {
    renderWithProviders(
      <BookingValueCollectionChart
        data={[{ bucket: "2026-01-05", scheduledValue: 1000, collected: 400 }]}
        currency="PHP"
        locale="en"
        labels={{ ...labels, title: "Booked value vs. collected" }}
      />
    );
    expect(screen.getByText("Booked value vs. collected")).toBeInTheDocument();
  });

  it("shows empty copy when every point is zero-valued", () => {
    renderWithProviders(
      <BookingValueCollectionChart
        data={[{ bucket: "2026-01-05", scheduledValue: 0, collected: 0 }]}
        currency="PHP"
        locale="en"
        labels={labels}
      />
    );
    expect(screen.getByText("No data yet")).toBeInTheDocument();
  });
});
