import { describe, expect, it, vi, beforeEach } from "vitest";
import React from "react";
import { screen } from "@testing-library/react";
import { renderWithProviders } from "@/test-utils/render";

const captured = vi.hoisted(() => ({
  xAxis: null as Record<string, unknown> | null,
  yAxes: [] as Record<string, unknown>[],
}));

vi.mock("recharts", async () => {
  const R = (await import("react")).default;

  function XAxis(props: Record<string, unknown>) {
    captured.xAxis = props;
    return null;
  }
  function YAxis(props: Record<string, unknown>) {
    captured.yAxes.push(props);
    return null;
  }

  return {
    ResponsiveContainer: ({ children }: { children: React.ReactNode }) =>
      R.createElement(R.Fragment, null, children),
    ComposedChart: ({ children }: { children: React.ReactNode }) =>
      R.createElement(R.Fragment, null, children),
    XAxis,
    YAxis,
    Tooltip: () => null,
    Legend: () => null,
    Bar: () => null,
    Line: () => null,
  };
});

import { PortfolioVisitorsInquiriesChart } from "./portfolio-visitors-inquiries-chart";

const labels = { visitors: "Visitors", inquiries: "Inquiries", empty: "No data yet" };

const sampleData = [
  { date: "2026-01-01", visitors: 10, inquiries: 2 },
  { date: "2026-01-02", visitors: 20, inquiries: 5 },
];

describe("PortfolioVisitorsInquiriesChart", () => {
  beforeEach(() => {
    captured.xAxis = null;
    captured.yAxes = [];
  });

  it("shows the empty label when data is empty", () => {
    renderWithProviders(
      <PortfolioVisitorsInquiriesChart data={[]} locale="en" labels={labels} />
    );
    expect(screen.getByText("No data yet")).toBeInTheDocument();
  });

  it("shows the empty label when all values are zero", () => {
    renderWithProviders(
      <PortfolioVisitorsInquiriesChart
        data={[{ date: "2026-01-01", visitors: 0, inquiries: 0 }]}
        locale="en"
        labels={labels}
      />
    );
    expect(screen.getByText("No data yet")).toBeInTheDocument();
  });

  it("flips XAxis reversed and swaps YAxis orientations for Arabic (RTL) locale", () => {
    renderWithProviders(
      <PortfolioVisitorsInquiriesChart data={sampleData} locale="ar" labels={labels} />,
      { locale: "ar" }
    );
    expect(captured.xAxis?.reversed).toBe(true);
    expect(captured.yAxes[0]?.orientation).toBe("right");
    expect(captured.yAxes[1]?.orientation).toBe("left");
  });
});
