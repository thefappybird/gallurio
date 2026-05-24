import { describe, expect, it } from "vitest";
import { screen } from "@testing-library/react";
import { renderWithProviders } from "@/test-utils/render";
import { PipelineFunnel } from "./pipeline-funnel";

const labels = { inquiries: "Inquiries", quoted: "Quoted", booked: "Booked" };

describe("PipelineFunnel", () => {
  it("renders all three labels and counts", () => {
    renderWithProviders(
      <PipelineFunnel
        counts={{ inquiries: 5, quoted: 3, booked: 2 }}
        title="Pipeline"
        labels={labels}
      />
    );
    expect(screen.getByText("Pipeline")).toBeInTheDocument();
    expect(screen.getByText("Inquiries")).toBeInTheDocument();
    expect(screen.getByText("Quoted")).toBeInTheDocument();
    expect(screen.getByText("Booked")).toBeInTheDocument();
    expect(screen.getAllByText("5").length).toBeGreaterThan(0);
    expect(screen.getAllByText("3").length).toBeGreaterThan(0);
    expect(screen.getAllByText("2").length).toBeGreaterThan(0);
  });

  it("renders without crashing when all counts are zero", () => {
    renderWithProviders(
      <PipelineFunnel
        counts={{ inquiries: 0, quoted: 0, booked: 0 }}
        title="Pipeline"
        labels={labels}
      />
    );
    expect(screen.getByText("Pipeline")).toBeInTheDocument();
  });
});
