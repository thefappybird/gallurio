import { describe, expect, it, vi } from "vitest";
import { fireEvent, screen } from "@testing-library/react";
import { renderWithProviders } from "@/test-utils/render";
import { ContactPanelDialog } from "./ContactPanelDialog";
import { DEFAULT_BRAND_KIT, type PortfolioContactConfig } from "@/lib/page-builder/types";

const updateContactConfigAction = vi.fn().mockResolvedValue({ ok: true });
const updateFormLocaleAction = vi.fn().mockResolvedValue({ ok: true });
vi.mock("../_actions", () => ({
  updateContactConfigAction: (...args: unknown[]) => updateContactConfigAction(...args),
  updateFormLocaleAction: (...args: unknown[]) => updateFormLocaleAction(...args),
}));

vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

const baseProps = {
  open: true,
  contact: {} satisfies PortfolioContactConfig,
  onContactChange: vi.fn(),
  formLocale: "",
  onFormLocaleChange: vi.fn(),
  brandKit: DEFAULT_BRAND_KIT,
  onSaved: vi.fn(),
  onCancel: vi.fn(),
};

describe("ContactPanelDialog — effective defaults (unset color shows theme fallback)", () => {
  it("shows the Background token as effective when popup backgroundColor is unset", () => {
    renderWithProviders(<ContactPanelDialog {...baseProps} />);
    fireEvent.click(screen.getByRole("button", { name: "Design" }));
    fireEvent.click(screen.getByRole("button", { name: "Popup" }));

    // All Background swatches (there may be multiple color rows) — at least one should
    // be aria-pressed because effectiveValue="background" is set on the bg color row.
    const bgSwatches = screen.getAllByRole("button", { name: "Background" });
    expect(bgSwatches.some((el) => el.getAttribute("aria-pressed") === "true")).toBe(true);
  });
});

describe("ContactPanelDialog", () => {
  it("renders design groups as collapsed drawers", () => {
    renderWithProviders(<ContactPanelDialog {...baseProps} />);
    fireEvent.click(screen.getByRole("button", { name: "Design" }));

    const popup = screen.getByRole("button", { name: "Popup" });
    expect(popup).toHaveAttribute("aria-expanded", "false");
    expect(screen.queryByText("Background color")).not.toBeInTheDocument();

    fireEvent.click(popup);
    expect(popup).toHaveAttribute("aria-expanded", "true");
    expect(screen.getByText("Background color")).toBeInTheDocument();
  });

  it("splits button controls into submit and new-dates subsections", () => {
    renderWithProviders(<ContactPanelDialog {...baseProps} />);
    fireEvent.click(screen.getByRole("button", { name: "Design" }));
    fireEvent.click(screen.getByRole("button", { name: "Button" }));

    expect(screen.getByRole("button", { name: "Submit button" })).toHaveAttribute("aria-expanded", "false");
    expect(screen.getByRole("button", { name: "New dates button" })).toHaveAttribute("aria-expanded", "false");
  });

  it("does not render Done or Cancel footer buttons", () => {
    renderWithProviders(<ContactPanelDialog {...baseProps} />);

    expect(screen.queryByRole("button", { name: "Done" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Cancel" })).not.toBeInTheDocument();
  });
});
