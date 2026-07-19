import { describe, expect, it } from "vitest";
import { screen } from "@testing-library/react";
import { renderWithProviders } from "@/test-utils/render";
import { RevenueTrendChart } from "./revenue-trend-chart";

const sampleData = Array.from({ length: 30 }).map((_, i) => ({
  date: `2026-05-${String(i + 1).padStart(2, "0")}`,
  amount: i * 100,
}));

describe("RevenueTrendChart", () => {
  it("renders title and mounts without crashing", () => {
    renderWithProviders(
      <RevenueTrendChart data={sampleData} currency="PHP" locale="en" title="Revenue trend" />
    );
    expect(screen.getByText("Revenue trend")).toBeInTheDocument();
  });

  it("handles empty data without crashing", () => {
    renderWithProviders(
      <RevenueTrendChart data={[]} currency="PHP" locale="en" title="Revenue trend" />
    );
    expect(screen.getByText("Revenue trend")).toBeInTheDocument();
  });
});
