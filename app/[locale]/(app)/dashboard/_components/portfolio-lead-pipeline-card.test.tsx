import { describe, expect, it } from "vitest";
import { renderWithProviders } from "@/test-utils/render";
import { screen } from "@testing-library/react";
import { PortfolioLeadPipelineCard } from "./portfolio-lead-pipeline-card";

const labels = {
  title: "Lead pipeline",
  new: "New",
  booked: "Booked",
  archived: "Archived",
  total: "Total",
  empty: "No inquiries yet",
};

describe("PortfolioLeadPipelineCard", () => {
  it("shows the empty label when total is zero", () => {
    renderWithProviders(
      <PortfolioLeadPipelineCard
        pipeline={{ total: 0, newCount: 0, booked: 0, archived: 0 }}
        locale="en"
        labels={labels}
      />
    );
    expect(screen.getByText("No inquiries yet")).toBeInTheDocument();
  });

  it("shows the three stage labels", () => {
    renderWithProviders(
      <PortfolioLeadPipelineCard
        pipeline={{ total: 100, newCount: 20, booked: 50, archived: 30 }}
        locale="en"
        labels={labels}
      />
    );
    expect(screen.getByText("New")).toBeInTheDocument();
    expect(screen.getByText("Booked")).toBeInTheDocument();
    expect(screen.getByText("Archived")).toBeInTheDocument();
  });

  it("shows each stage's count", () => {
    renderWithProviders(
      <PortfolioLeadPipelineCard
        pipeline={{ total: 100, newCount: 20, booked: 50, archived: 30 }}
        locale="en"
        labels={labels}
      />
    );
    expect(screen.getByText("20")).toBeInTheDocument();
    expect(screen.getByText("50")).toBeInTheDocument();
    expect(screen.getByText("30")).toBeInTheDocument();
  });

  it("shows each stage's share percentage and the total footer", () => {
    renderWithProviders(
      <PortfolioLeadPipelineCard
        pipeline={{ total: 100, newCount: 20, booked: 50, archived: 30 }}
        locale="en"
        labels={labels}
      />
    );
    expect(screen.getByText("20%")).toBeInTheDocument();
    expect(screen.getByText("50%")).toBeInTheDocument();
    expect(screen.getByText("30%")).toBeInTheDocument();
    expect(screen.getByText("Total")).toBeInTheDocument();
    expect(screen.getByText("100")).toBeInTheDocument();
  });

  it("shows 0% for a stage with zero count, not NaN", () => {
    renderWithProviders(
      <PortfolioLeadPipelineCard
        pipeline={{ total: 10, newCount: 0, booked: 10, archived: 0 }}
        locale="en"
        labels={labels}
      />
    );
    expect(screen.getAllByText("0%")).toHaveLength(2);
    expect(screen.queryByText("NaN%")).toBeNull();
  });
});
