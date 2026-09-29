import { describe, expect, it } from "vitest";
import { screen } from "@testing-library/react";
import { renderWithProviders } from "@/test-utils/render";
import { RevenueTrendChartClient } from "./revenue-trend-chart-client";

const sampleData = Array.from({ length: 30 }).map((_, i) => ({
  date: `2026-05-${String(i + 1).padStart(2, "0")}`,
  amount: i * 100,
}));

describe("RevenueTrendChartClient", () => {
  it("lazily renders the real RevenueTrendChart once its chunk resolves", async () => {
    renderWithProviders(
      <RevenueTrendChartClient
        data={sampleData}
        currency="PHP"
        locale="en"
        title="Revenue trend"
      />
    );
    expect(await screen.findByText("Revenue trend", {}, { timeout: 15000 })).toBeInTheDocument();
  });
});
