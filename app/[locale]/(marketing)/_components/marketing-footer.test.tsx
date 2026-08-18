import { describe, expect, it, vi } from "vitest";
import { render, screen, within } from "@testing-library/react";

vi.mock("next-intl", () => ({
  useTranslations: (namespace: string) => (key: string) => `${namespace}:${key}`,
}));

vi.mock("next/image", () => ({
  default: () => <span data-testid="brand-image" />,
}));

import { MarketingFooter } from "./marketing-footer";

describe("MarketingFooter", () => {
  it("uses the full localized legal-page titles for its legal links", () => {
    render(<MarketingFooter />);

    expect(screen.getByRole("link", { name: "marketing.terms:title" })).toHaveAttribute("href", "/terms");
    expect(screen.getByRole("link", { name: "marketing.privacy:title" })).toHaveAttribute("href", "/privacy");
    expect(screen.getByRole("link", { name: "marketing.footer:refundPolicy" })).toHaveAttribute("href", "/refunds");
    expect(within(screen.getByRole("navigation", { name: "Footer" })).getAllByRole("link").map((link) => link.getAttribute("href"))).toEqual([
      "/portfolio-maker-demo",
      "/about",
      "/pricing",
      "/compare",
      "/blog",
      "/book-demo",
      "/terms",
      "/privacy",
      "/refunds",
      "/contact",
    ]);
  });
});
