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
    Bar: () => null,
  };
});

import { PortfolioViewsChart } from "./portfolio-views-chart";

const sampleData = [
  { date: "2026-01-01", views: 10, visitors: 5 },
  { date: "2026-01-02", views: 20, visitors: 8 },
];

describe("PortfolioViewsChart RTL axes", () => {
  beforeEach(() => {
    captured.xAxis = null;
    captured.yAxis = null;
  });

  it("sets XAxis reversed=true and YAxis orientation='right' for Arabic (RTL) locale", () => {
    renderWithProviders(
      <PortfolioViewsChart
        data={sampleData}
        locale="ar"
        labels={{ views: "مشاهدات", visitors: "زوار" }}
      />,
      { locale: "ar" }
    );
    expect(captured.xAxis?.reversed).toBe(true);
    expect(captured.yAxis?.orientation).toBe("right");
  });
});
