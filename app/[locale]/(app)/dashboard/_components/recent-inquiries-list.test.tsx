import { describe, expect, it } from "vitest";
import { Types } from "mongoose";
import { screen } from "@testing-library/react";
import { renderWithProviders } from "@/test-utils/render";
import { RecentInquiriesList } from "./recent-inquiries-list";
import type { InquiryDoc } from "@/lib/db/models";

function makeInquiry(overrides: Partial<InquiryDoc> = {}): InquiryDoc {
  return {
    _id: new Types.ObjectId(),
    workspaceId: new Types.ObjectId(),
    name: "Lena Okafor",
    email: "lena@example.com",
    phone: null,
    message: "",
    eventDate: null,
    eventType: "wedding",
    budgetRange: null,
    source: {
      utm_source: null,
      utm_medium: null,
      utm_campaign: null,
      referrer: null,
    },
    status: "inquiry",
    convertedClientId: null,
    convertedBookingId: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  } as unknown as InquiryDoc;
}

describe("RecentInquiriesList", () => {
  it("renders empty state with no inquiries", () => {
    renderWithProviders(
      <RecentInquiriesList
        inquiries={[]}
        locale="en"
        title="Recent inquiries"
        empty="Nothing here."
        viewAll="View all"
      />
    );
    expect(screen.getByText("Nothing here.")).toBeInTheDocument();
  });

  it("shows each inquiry's name, event type, and status", () => {
    renderWithProviders(
      <RecentInquiriesList
        inquiries={[
          makeInquiry({ name: "Lena Okafor", eventType: "corporate", status: "inquiry" }),
          makeInquiry({ name: "Jordan Patel", eventType: "wedding", status: "booked" }),
        ]}
        locale="en"
        title="Recent inquiries"
        empty="Nothing here."
        viewAll="View all"
      />
    );
    expect(screen.getByText("Lena Okafor")).toBeInTheDocument();
    expect(screen.getByText("Jordan Patel")).toBeInTheDocument();
    expect(screen.getByText("inquiry")).toBeInTheDocument();
    expect(screen.getByText("booked")).toBeInTheDocument();
  });

  it("links each inquiry to the inbox modal deep-link", () => {
    renderWithProviders(
      <RecentInquiriesList
        inquiries={[makeInquiry({ name: "Lena Okafor" })]}
        locale="en"
        title="Recent inquiries"
        empty="Nothing here."
        viewAll="View all"
      />
    );

    expect(screen.getByRole("link", { name: /Lena Okafor/i })).toHaveAttribute(
      "href",
      expect.stringContaining(`/inquiries?inquiryId=`)
    );
  });
});
