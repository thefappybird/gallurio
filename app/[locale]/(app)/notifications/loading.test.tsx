import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";

vi.mock("next-intl/server", () => ({
  getTranslations: vi.fn(async () => (key: string) => `common:${key}`),
}));

import NotificationsLoading from "./loading";

describe("NotificationsLoading", () => {
  it("renders an accessible busy skeleton", async () => {
    const ui = await NotificationsLoading();
    render(ui);
    const status = screen.getByRole("status");
    expect(status).toHaveAttribute("aria-busy", "true");
    expect(screen.getByText("common:loading")).toBeInTheDocument();
  });

  it("reserves a 2-line body and a trailing meta column per row", async () => {
    const ui = await NotificationsLoading();
    render(ui);
    const bodyLines = screen.getAllByTestId("notification-row-body-line");
    expect(bodyLines.length).toBe(2 * 6);
    const metaColumns = screen.getAllByTestId("notification-row-meta-skeleton");
    expect(metaColumns.length).toBe(6);
  });
});
