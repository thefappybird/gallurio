import { describe, expect, it } from "vitest";
import { render } from "@testing-library/react";
import InquiryDetailLoading from "./loading";

describe("InquiryDetailLoading", () => {
  it("mirrors the page's card order: client, event, booking draft, history", () => {
    const { container } = render(<InquiryDetailLoading />);
    const cards = Array.from(
      container.querySelectorAll("[data-skeleton-card]")
    ).map((el) => el.getAttribute("data-skeleton-card"));
    expect(cards).toEqual([
      "client-info",
      "event-request",
      "booking-draft",
      "history",
    ]);
  });
});
