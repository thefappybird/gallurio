import { describe, expect, it } from "vitest";
import { screen } from "@testing-library/react";
import { renderWithProviders } from "@/test-utils/render";
import { KpiStrip } from "./kpi-strip";

const labels = {
  revenueThisMonth: "Revenue",
  activeBookings: "Active",
  newInquiries: "New inquiries",
  outstandingBalance: "Outstanding",
};

const noTrends = {
  revenue: null,
  activeBookings: null,
  newInquiries: null,
  outstandingBalance: null,
};

describe("KpiStrip", () => {
  it("renders all four KPI labels", () => {
    renderWithProviders(
      <KpiStrip
        snapshot={{
          revenueThisMonth: 24_850,
          activeBookingsThisMonth: 18,
          newInquiries: 4,
          outstandingBalance: 12_000,
        }}
        currency="PHP"
        locale="en"
        labels={labels}
        trends={noTrends}
      />
    );
    expect(screen.getByText("Revenue")).toBeInTheDocument();
    expect(screen.getByText("Active")).toBeInTheDocument();
    expect(screen.getByText("New inquiries")).toBeInTheDocument();
    expect(screen.getByText("Outstanding")).toBeInTheDocument();
  });

  it("formats money KPIs through Intl.NumberFormat", () => {
    renderWithProviders(
      <KpiStrip
        snapshot={{
          revenueThisMonth: 24_850,
          activeBookingsThisMonth: 18,
          newInquiries: 4,
          outstandingBalance: 12_000,
        }}
        currency="PHP"
        locale="en"
        labels={labels}
        trends={noTrends}
      />
    );
    expect(screen.getByText(/24,850/)).toBeInTheDocument();
    expect(screen.getByText(/12,000/)).toBeInTheDocument();
  });

  it("renders integer KPIs without currency formatting", () => {
    renderWithProviders(
      <KpiStrip
        snapshot={{
          revenueThisMonth: 0,
          activeBookingsThisMonth: 18,
          newInquiries: 4,
          outstandingBalance: 0,
        }}
        currency="PHP"
        locale="en"
        labels={labels}
        trends={noTrends}
      />
    );
    expect(screen.getByText("18")).toBeInTheDocument();
    expect(screen.getByText("4")).toBeInTheDocument();
  });
});
