import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import DashboardLoading from "./loading";

describe("DashboardLoading", () => {
  it("hides the KPI icon placeholder below sm, matching the real KpiTile icon", () => {
    render(<DashboardLoading />);
    const icons = screen.getAllByTestId("kpi-icon-skeleton");
    expect(icons.length).toBeGreaterThan(0);
    for (const icon of icons) {
      expect(icon).toHaveClass("hidden");
      expect(icon).toHaveClass("sm:flex");
    }
  });

  it("reserves the real SegmentedToggle's full-width mobile / auto-width desktop shape for the tabs skeleton", () => {
    render(<DashboardLoading />);
    const tabs = screen.getByTestId("tabs-skeleton");
    expect(tabs).toHaveClass("h-11");
    expect(tabs).toHaveClass("w-full");
    expect(tabs).toHaveClass("sm:h-9");
    expect(tabs).toHaveClass("sm:w-32");
  });
});
