import { describe, expect, it, vi, beforeEach } from "vitest";
import React from "react";
import { renderWithProviders } from "@/test-utils/render";

// Capture XAxis / YAxis props via a mock that renders BarChart children
// so React calls each child component function and our mocks can capture props.
const captured = vi.hoisted(() => ({
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

  return {
    ResponsiveContainer: ({ children }: { children: React.ReactNode }) =>
      R.createElement(R.Fragment, null, children),
    BarChart: ({ children }: { children: React.ReactNode }) =>
      R.createElement(R.Fragment, null, children),
    XAxis,
    YAxis,
    Tooltip: () => null,
    Legend: () => null,
    Bar: ({ children }: { children?: React.ReactNode }) =>
      R.createElement(R.Fragment, null, children ?? null),
    Cell: () => null,
  };
});

import { TeamPerformanceCards } from "./team-performance-cards";

const revenueByTeam = [
  { teamId: "t1", name: "Alpha", color: "#e04", isActive: true, total: 50000 },
];
const bookingsByTeam = [
  { teamId: "t1", name: "Alpha", color: "#e04", isActive: true, count: 5 },
];

describe("TeamPerformanceCards bar chart RTL axes", () => {
  beforeEach(() => {
    captured.xAxis = null;
    captured.yAxis = null;
  });

  it("sets YAxis orientation='right' and XAxis reversed=true for Arabic (RTL) locale", () => {
    renderWithProviders(
      <TeamPerformanceCards
        revenueByTeam={revenueByTeam}
        bookingsByTeam={bookingsByTeam}
        currency="PHP"
        locale="ar"
      />,
      { locale: "ar" }
    );
    expect(captured.yAxis?.orientation).toBe("right");
    expect(captured.xAxis?.reversed).toBe(true);
  });
});
