import { describe, expect, it, vi } from "vitest";
import { render, screen, within } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";

const route = vi.hoisted(() => ({ pathname: "/" }));

vi.mock("next-intl", async (importOriginal) => {
  const actual = await importOriginal<typeof import("next-intl")>();
  return {
    ...actual,
    useTranslations: (namespace: string) => (key: string) => `${namespace}:${key}`,
  };
});

vi.mock("next/image", () => ({
  default: () => <span data-testid="brand-image" />,
}));
vi.mock("@/lib/i18n/navigation", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/i18n/navigation")>();
  return { ...actual, usePathname: () => route.pathname };
});

import { MarketingFooter } from "./marketing-footer";

describe("MarketingFooter", () => {
  it("uses the full localized legal-page titles for its legal links", () => {
    route.pathname = "/";
    render(<MarketingFooter />);

    expect(screen.getByRole("link", { name: "marketing.terms:title" })).toHaveAttribute("href", "/terms");
    expect(screen.getByRole("link", { name: "marketing.privacy:title" })).toHaveAttribute("href", "/privacy");
    expect(screen.getByRole("link", { name: "marketing.footer:refundPolicy" })).toHaveAttribute("href", "/refunds");
    expect(within(screen.getByRole("navigation", { name: "Footer" })).getAllByRole("link").map((link) => link.getAttribute("href"))).toEqual([
      "/portfolio-maker-demo",
      "/about",
      "/pricing",
      "/resources",
      "/compare",
      "/book-demo",
      "/terms",
      "/privacy",
      "/refunds",
      "/contact",
    ]);
  });

  it("uses English labels on editorial routes", () => {
    route.pathname = "/compare/gallurio-vs-wix";
    render(<MarketingFooter />);

    expect(screen.getByRole("link", { name: "Resources" })).toHaveAttribute("href", "/resources");
    expect(screen.getByRole("link", { name: "Terms of Service" })).toBeInTheDocument();
  });

  it("links the English-only Resources/Compare pages without a locale prefix under locale fil", () => {
    route.pathname = "/fil";
    render(
      <NextIntlClientProvider locale="fil">
        <MarketingFooter />
      </NextIntlClientProvider>
    );

    expect(screen.getByRole("link", { name: "marketing.footer:resources" })).toHaveAttribute("href", "/resources");
    expect(screen.getByRole("link", { name: "marketing.footer:compare" })).toHaveAttribute("href", "/compare");
  });
});
