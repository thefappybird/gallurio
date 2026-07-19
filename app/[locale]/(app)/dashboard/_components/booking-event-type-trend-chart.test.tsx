import { describe, expect, it, vi, beforeEach } from "vitest";
import React from "react";
import { screen } from "@testing-library/react";
import { renderWithProviders } from "@/test-utils/render";

const captured = vi.hoisted(() => ({
  bars: [] as Record<string, unknown>[],
  xAxis: null as Record<string, unknown> | null,
}));

vi.mock("recharts", async () => {
  const R = (await import("react")).default;
  function Bar(props: Record<string, unknown>) {
    captured.bars.push(props);
    return null;
  }
  function XAxis(props: Record<string, unknown>) {
    captured.xAxis = props;
    return null;
  }
  return {
    ResponsiveContainer: ({ children }: { children: React.ReactNode }) =>
      R.createElement(R.Fragment, null, children),
    BarChart: ({ children }: { children: React.ReactNode }) =>
      R.createElement(R.Fragment, null, children),
    Bar,
    XAxis,
    YAxis: () => null,
    Tooltip: () => null,
  };
});

import { BookingEventTypeTrendChart } from "./booking-event-type-trend-chart";

const labels = {
  eventTypes: { wedding: "Wedding", corporate: "Corporate" },
  empty: "No bookings yet",
};

describe("BookingEventTypeTrendChart", () => {
  beforeEach(() => {
    captured.bars = [];
    captured.xAxis = null;
  });

  it("shows empty copy when there are no points", () => {
    renderWithProviders(
      <BookingEventTypeTrendChart
        trend={{ eventTypes: [], points: [] }}
        currency="PHP"
        locale="en"
        labels={labels}
      />
    );
    expect(screen.getByText("No bookings yet")).toBeInTheDocument();
  });

  it("renders a stacked bar per event type with the translated legend", () => {
    renderWithProviders(
      <BookingEventTypeTrendChart
        trend={{
          eventTypes: ["wedding", "corporate"],
          points: [
            { bucket: "2026-01-05", values: { wedding: 1000, corporate: 500 } },
            { bucket: "2026-01-12", values: { wedding: 1200 } },
          ],
        }}
        currency="PHP"
        locale="en"
        labels={labels}
      />
    );
    expect(captured.bars).toHaveLength(2);
    expect(captured.bars[0]).toMatchObject({ dataKey: "wedding", stackId: "v", name: "Wedding" });
    expect(captured.bars[1]).toMatchObject({
      dataKey: "corporate",
      stackId: "v",
      name: "Corporate",
    });
    expect(screen.getByText("Wedding")).toBeInTheDocument();
    expect(screen.getByText("Corporate")).toBeInTheDocument();
  });

  it("assigns each bar a distinct chart color", () => {
    renderWithProviders(
      <BookingEventTypeTrendChart
        trend={{
          eventTypes: ["wedding", "corporate"],
          points: [{ bucket: "2026-01-05", values: { wedding: 1000, corporate: 500 } }],
        }}
        currency="PHP"
        locale="en"
        labels={labels}
      />
    );
    expect(captured.bars[0].fill).toBe("var(--chart-1)");
    expect(captured.bars[1].fill).toBe("var(--chart-2)");
  });

  it("wires the week bucket into XAxis and renders the card title when provided", () => {
    renderWithProviders(
      <BookingEventTypeTrendChart
        trend={{
          eventTypes: ["wedding"],
          points: [{ bucket: "2026-01-05", values: { wedding: 1000 } }],
        }}
        currency="PHP"
        locale="en"
        labels={{ ...labels, title: "Value by event type" }}
      />
    );
    expect(captured.xAxis?.dataKey).toBe("bucket");
    expect(screen.getByText("Value by event type")).toBeInTheDocument();
  });

  it("formats the XAxis tick as a short UTC date and reverses it for RTL", () => {
    renderWithProviders(
      <BookingEventTypeTrendChart
        trend={{
          eventTypes: ["wedding"],
          points: [{ bucket: "2026-01-05", values: { wedding: 1000 } }],
        }}
        currency="PHP"
        locale="ar"
        labels={labels}
      />,
      { locale: "ar" }
    );
    const tickFormatter = captured.xAxis?.tickFormatter as (d: string) => string;
    expect(tickFormatter("2026-01-05")).toBe(
      new Date("2026-01-05T00:00:00Z").toLocaleDateString("ar", {
        month: "short",
        day: "numeric",
        timeZone: "UTC",
      })
    );
    expect(captured.xAxis?.reversed).toBe(true);
  });
});
