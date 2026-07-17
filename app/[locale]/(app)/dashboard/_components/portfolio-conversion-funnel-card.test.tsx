import { describe, expect, it } from "vitest";
import { renderWithProviders } from "@/test-utils/render";
import { screen } from "@testing-library/react";
import { PortfolioConversionFunnelCard } from "./portfolio-conversion-funnel-card";

const labels = {
  title: "Contact funnel",
  visitorDays: "Visitor-days",
  contactOpened: "Contact opened",
  inquirySubmitted: "Inquiry submitted",
  ofVisitors: "of visitor-days",
  ofOpened: "of opened",
  ofTotal: "of total",
  collectingData: "Collecting data",
  empty: "No visits yet",
};

describe("PortfolioConversionFunnelCard", () => {
  it("shows the empty label when there are no visitor-days", () => {
    renderWithProviders(
      <PortfolioConversionFunnelCard
        funnel={{ visitorDays: 0, contactVisitorDays: 0, inquiries: 0, contactTracked: false }}
        locale="en"
        labels={labels}
      />
    );
    expect(screen.getByText("No visits yet")).toBeInTheDocument();
  });

  it("shows the visitor-days count", () => {
    renderWithProviders(
      <PortfolioConversionFunnelCard
        funnel={{ visitorDays: 100, contactVisitorDays: 40, inquiries: 10, contactTracked: true }}
        locale="en"
        labels={labels}
      />
    );
    expect(screen.getByText("100")).toBeInTheDocument();
  });

  it("shows the contact-opened stage as count and percent of visitor-days", () => {
    renderWithProviders(
      <PortfolioConversionFunnelCard
        funnel={{ visitorDays: 100, contactVisitorDays: 40, inquiries: 10, contactTracked: true }}
        locale="en"
        labels={labels}
      />
    );
    expect(screen.getByText(/40.*40% of visitor-days/)).toBeInTheDocument();
  });

  it("shows the inquiry-submitted stage as count with percent-of-opened and percent-of-total", () => {
    renderWithProviders(
      <PortfolioConversionFunnelCard
        funnel={{ visitorDays: 100, contactVisitorDays: 40, inquiries: 10, contactTracked: true }}
        locale="en"
        labels={labels}
      />
    );
    expect(screen.getByText(/10.*25% of opened.*10% of total/)).toBeInTheDocument();
  });

  it("shows the collectingData note instead of a 0% when contact-open is not tracked yet", () => {
    renderWithProviders(
      <PortfolioConversionFunnelCard
        funnel={{ visitorDays: 50, contactVisitorDays: 0, inquiries: 3, contactTracked: false }}
        locale="en"
        labels={labels}
      />
    );
    expect(screen.getByText("Collecting data")).toBeInTheDocument();
  });
});
