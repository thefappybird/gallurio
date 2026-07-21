import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";

vi.mock("next-intl/server", () => ({
  setRequestLocale: vi.fn(),
  getTranslations: vi.fn(async (arg?: string | { locale?: string; namespace?: string }) => {
    const namespace = typeof arg === "string" ? arg : arg?.namespace;
    return (key: string) => `${namespace}:${key}`;
  }),
}));

import PortfolioMakerPage from "./page";

describe("Portfolio Maker marketing page", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders the headline and a CTA linking to the free demo", async () => {
    const page = await PortfolioMakerPage({ params: Promise.resolve({ locale: "en" }) });
    render(page);

    expect(screen.getByText("marketing.portfolioMaker:header.headline")).toBeInTheDocument();
    const cta = screen.getByRole("link", { name: "marketing.portfolioMaker:demo.cta" });
    expect(cta).toHaveAttribute("href", "/portfolio-maker-demo");
  });
});
