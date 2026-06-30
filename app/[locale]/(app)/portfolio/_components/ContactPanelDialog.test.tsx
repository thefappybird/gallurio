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

  // C4: add-session border row shows effective default width = 1 (dashed default border exists)
  it("add-session border width input shows effective default of 1 (a dashed default exists)", () => {
    renderWithProviders(<ContactPanelDialog {...baseProps} />);
    fireEvent.click(screen.getByRole("button", { name: "Design" }));
    fireEvent.click(screen.getByRole("button", { name: "Button" }));
    fireEvent.click(screen.getByRole("button", { name: "New dates button" }));

    // The spinbutton in the border-width row for add-session should have placeholder="1"
    // (effective default: 1px dashed border always rendered when width is unset)
    const spinbuttons = screen.getAllByRole("spinbutton");
    // The last spinbutton in this section is the border width
    const borderWidth = spinbuttons[spinbuttons.length - 1];
    expect(borderWidth).toHaveAttribute("placeholder", "1");
  });

  // Item 4a: inactive tab color shows "foreground" as effective default when unset
  it("Tab text color swatch shows Foreground as effective default when tabColor is unset", () => {
    renderWithProviders(<ContactPanelDialog {...baseProps} />);
    fireEvent.click(screen.getByRole("button", { name: "Design" }));
    fireEvent.click(screen.getByRole("button", { name: "Tabs" }));
    fireEvent.click(screen.getByRole("button", { name: "Inactive tabs" }));

    // foreground token swatch is labeled "Text" (COLOR_LABEL.foreground = "Text").
    // When tabColor is unset, effectiveValue="foreground" makes it appear aria-pressed.
    const textSwatches = screen.getAllByRole("button", { name: "Text" });
    expect(textSwatches.some((el) => el.getAttribute("aria-pressed") === "true")).toBe(true);
  });

  // Item 4b: add-session button style selector shows "outline" as effective default when unset
  it("New dates button style selector shows Outline as effective default when addSessionButtonStyle is unset", () => {
    renderWithProviders(<ContactPanelDialog {...baseProps} />);
    fireEvent.click(screen.getByRole("button", { name: "Design" }));
    fireEvent.click(screen.getByRole("button", { name: "Button" }));
    fireEvent.click(screen.getByRole("button", { name: "New dates button" }));

    // "Outline" should be aria-pressed when addSessionButtonStyle is unset
    // (effective default = outline, matches resolveAddSessionAppearance default)
    const outlineBtn = screen.getByRole("button", { name: "Outline" });
    expect(outlineBtn).toHaveAttribute("aria-pressed", "true");
  });

  // Item 4c: active tab underline toggle shows effective default ON when unset
  it("Underline toggle appears lighter-active when activeTabUnderline is unset (effective default ON)", () => {
    renderWithProviders(<ContactPanelDialog {...baseProps} />);
    fireEvent.click(screen.getByRole("button", { name: "Design" }));
    fireEvent.click(screen.getByRole("button", { name: "Tabs" }));
    fireEvent.click(screen.getByRole("button", { name: "Active tab" }));

    const underlineBtn = screen.getByRole("button", { name: /underline/i });
    // Effective default ON → aria-pressed should be true even when unset
    expect(underlineBtn).toHaveAttribute("aria-pressed", "true");
  });

  // C3: Subtle toggle (effective default ON) shows in inactive tabs section
  it("Subtle toggle appears lighter-active when inactiveTabSubtle is unset (effective default ON)", () => {
    renderWithProviders(<ContactPanelDialog {...baseProps} />);
    fireEvent.click(screen.getByRole("button", { name: "Design" }));
    fireEvent.click(screen.getByRole("button", { name: "Tabs" }));
    fireEvent.click(screen.getByRole("button", { name: "Inactive tabs" }));

    const subtleBtn = screen.getByRole("button", { name: /subtle/i });
    // aria-pressed should reflect the effective default (ON)
    expect(subtleBtn).toHaveAttribute("aria-pressed", "true");
  });

  // Task 12: active tab size toggle must use charcoal (bg-foreground) not brand/teal
  it("active tab size toggle renders with bg-foreground (charcoal) class", () => {
    renderWithProviders(
      <ContactPanelDialog
        {...baseProps}
        contact={{ tabFontSize: "lg" } satisfies PortfolioContactConfig}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: "Design" }));
    fireEvent.click(screen.getByRole("button", { name: "Tabs" }));

    const lgBtn = screen.getByRole("button", { name: "L" });
    expect(lgBtn).toHaveClass("bg-foreground");
    expect(lgBtn).toHaveClass("text-background");
  });
});
