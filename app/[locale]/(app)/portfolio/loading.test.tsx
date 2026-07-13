import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";

vi.mock("next-intl/server", () => ({
  getTranslations: vi.fn(async () => (key: string) => `common:${key}`),
}));

import PortfolioLoading from "./loading";

describe("PortfolioLoading", () => {
  it("renders an accessible busy skeleton", async () => {
    const ui = await PortfolioLoading();
    render(ui);
    const status = screen.getByRole("status");
    expect(status).toHaveAttribute("aria-busy", "true");
    expect(screen.getByText("common:loading")).toBeInTheDocument();
  });
});
