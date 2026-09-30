import { describe, it, expect, vi } from "vitest";
import { screen } from "@testing-library/react";
import { renderWithProviders } from "@/test-utils/render";
import filMessages from "@/messages/fil.json";
import { InquiryViewToggle } from "./inquiry-view-toggle";

vi.mock("next/navigation", () => ({
  useSearchParams: () => new URLSearchParams(),
}));
vi.mock("@/lib/i18n/navigation", () => ({
  useRouter: () => ({ push: vi.fn() }),
  usePathname: () => "/inquiries",
}));

describe("InquiryViewToggle", () => {
  it("labels the toggle group in the active locale", () => {
    renderWithProviders(<InquiryViewToggle view="table" />, {
      locale: "fil",
      messages: filMessages as never,
    });
    expect(screen.getByRole("tablist",{ name: "Toggle ng view ng mga inquiry" })).toBeInTheDocument();
  });
});
