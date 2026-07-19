import { describe, expect, it } from "vitest";
import { renderWithProviders } from "@/test-utils/render";
import { screen } from "@testing-library/react";
import { PortfolioDemandProfileCard } from "./portfolio-demand-profile-card";

const labels = {
  title: "Demand profile",
  eventTypeMix: "Event types",
  requestedMonth: "Requested month",
  medianLeadTime: "Median lead time",
  days: "days",
  basedOn: "Based on",
  empty: "No demand data yet",
  eventTypes: { wedding: "Wedding", corporate: "Corporate" },
};

describe("PortfolioDemandProfileCard", () => {
  it("shows the empty label when there is no event-type or month data", () => {
    renderWithProviders(
      <PortfolioDemandProfileCard
        profile={{ eventTypeMix: [], requestedMonths: [], medianLeadTimeDays: null }}
        locale="en"
        labels={labels}
      />
    );
    expect(screen.getByText("No demand data yet")).toBeInTheDocument();
  });

  it("shows the event-type mix with translated labels", () => {
    renderWithProviders(
      <PortfolioDemandProfileCard
        profile={{
          eventTypeMix: [
            { eventType: "wedding", count: 8 },
            { eventType: "corporate", count: 2 },
          ],
          requestedMonths: [],
          medianLeadTimeDays: null,
        }}
        locale="en"
        labels={labels}
      />
    );
    expect(screen.getByText("Wedding")).toBeInTheDocument();
    expect(screen.getByText("Corporate")).toBeInTheDocument();
  });

  it("shows each event type's count and share percentage of the mix", () => {
    renderWithProviders(
      <PortfolioDemandProfileCard
        profile={{
          eventTypeMix: [
            { eventType: "wedding", count: 8 },
            { eventType: "corporate", count: 2 },
          ],
          requestedMonths: [],
          medianLeadTimeDays: null,
        }}
        locale="en"
        labels={labels}
      />
    );
    expect(screen.getByText(/8.*80%/)).toBeInTheDocument();
    expect(screen.getByText(/2.*20%/)).toBeInTheDocument();
  });

  it("shows the requested-months header and each month's short label with its count", () => {
    renderWithProviders(
      <PortfolioDemandProfileCard
        profile={{
          eventTypeMix: [],
          requestedMonths: [
            { month: "2026-01", count: 3 },
            { month: "2026-02", count: 7 },
          ],
          medianLeadTimeDays: null,
        }}
        locale="en"
        labels={labels}
      />
    );
    expect(screen.getByText("Requested month")).toBeInTheDocument();
    expect(screen.getByText("Jan 26")).toBeInTheDocument();
    expect(screen.getByText("Feb 26")).toBeInTheDocument();
    expect(screen.getByText("3")).toBeInTheDocument();
    expect(screen.getByText("7")).toBeInTheDocument();
  });

  it("shows the median lead time in days, and an em dash when null", () => {
    const { rerender } = renderWithProviders(
      <PortfolioDemandProfileCard
        profile={{ eventTypeMix: [{ eventType: "wedding", count: 1 }], requestedMonths: [], medianLeadTimeDays: 45 }}
        locale="en"
        labels={labels}
      />
    );
    expect(screen.getByText("Median lead time")).toBeInTheDocument();
    expect(screen.getByText(/45 days/)).toBeInTheDocument();

    rerender(
      <PortfolioDemandProfileCard
        profile={{ eventTypeMix: [{ eventType: "wedding", count: 1 }], requestedMonths: [], medianLeadTimeDays: null }}
        locale="en"
        labels={labels}
      />
    );
    expect(screen.getByText("—")).toBeInTheDocument();
  });

  it("shows the based-on sample size next to the median lead time", () => {
    renderWithProviders(
      <PortfolioDemandProfileCard
        profile={{
          eventTypeMix: [
            { eventType: "wedding", count: 8 },
            { eventType: "corporate", count: 2 },
          ],
          requestedMonths: [],
          medianLeadTimeDays: 45,
        }}
        locale="en"
        labels={labels}
      />
    );
    expect(screen.getByText(/Based on 10/)).toBeInTheDocument();
  });

  it("shows the event-type-mix section header", () => {
    renderWithProviders(
      <PortfolioDemandProfileCard
        profile={{
          eventTypeMix: [{ eventType: "wedding", count: 1 }],
          requestedMonths: [],
          medianLeadTimeDays: null,
        }}
        locale="en"
        labels={labels}
      />
    );
    expect(screen.getByText("Event types")).toBeInTheDocument();
  });
});
