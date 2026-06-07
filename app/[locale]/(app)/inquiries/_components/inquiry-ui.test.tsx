import { describe, it, expect, vi } from "vitest";
import { createElement, type ReactNode } from "react";
import { screen } from "@testing-library/react";
import { renderWithProviders } from "@/test-utils/render";

vi.mock("@/lib/i18n/navigation", () => ({
  Link: ({ children, href, ...rest }: { children: ReactNode; href: string }) =>
    createElement("a", { href, ...rest }, children),
}));

import { InquiryStatusBadge } from "./inquiry-status-badge";
import { InquiryTable, type InquiryRow } from "./inquiry-table";

const rows: InquiryRow[] = [
  {
    id: "111111111111111111111111",
    name: "Emma Carter",
    email: "emma@example.com",
    status: "new",
    eventTitle: "Emma & Noah Wedding",
    eventDate: "2030-08-15T00:00:00.000Z",
    eventType: "wedding",
    submittedAt: "2026-05-30T10:00:00.000Z",
    source: "portfolio",
  },
];

describe("InquiryStatusBadge", () => {
  it("renders booked for the converted persisted status", () => {
    renderWithProviders(<InquiryStatusBadge status="converted" />);
    expect(screen.getByText("Booked")).toBeInTheDocument();
  });
});

describe("InquiryTable", () => {
  it("renders rows with a link to the detail page", () => {
    renderWithProviders(
      <InquiryTable rows={rows} locale="en" empty="No inquiries yet." emptyHint="hint" />
    );
    // Name appears in both mobile card + desktop table layouts.
    expect(screen.getAllByText("Emma Carter").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Emma & Noah Wedding").length).toBeGreaterThan(0);
    expect(screen.getAllByText("portfolio").length).toBeGreaterThan(0);
    const links = screen.getAllByRole("link", { name: /Open inquiry from Emma Carter/i });
    expect(links[0]).toHaveAttribute("href", "/inquiries/111111111111111111111111");
  });

  it("renders the empty state when there are no rows", () => {
    renderWithProviders(
      <InquiryTable rows={[]} locale="en" empty="No inquiries yet." emptyHint="Submit to see them." />
    );
    expect(screen.getByText("No inquiries yet.")).toBeInTheDocument();
    expect(screen.getByText("Submit to see them.")).toBeInTheDocument();
  });
});
