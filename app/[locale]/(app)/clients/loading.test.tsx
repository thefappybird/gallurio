import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";

vi.mock("next-intl/server", () => ({
  getTranslations: vi.fn(async () => (key: string) => `common:${key}`),
}));

import ClientsLoading from "./loading";
import { DEFAULT_PAGE_SIZE } from "@/lib/pagination";

describe("ClientsLoading", () => {
  it("renders an accessible busy skeleton", async () => {
    const ui = await ClientsLoading();
    render(ui);
    const status = screen.getByRole("status");
    expect(status).toHaveAttribute("aria-busy", "true");
    expect(screen.getByText("common:loading")).toBeInTheDocument();
  });

  it("reserves DEFAULT_PAGE_SIZE skeleton rows, matching the real page's default limit", async () => {
    const ui = await ClientsLoading();
    const { container } = render(ui);
    const rows = container.querySelectorAll("table tbody tr");
    expect(rows).toHaveLength(DEFAULT_PAGE_SIZE);
  });
});
