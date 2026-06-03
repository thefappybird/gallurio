import { describe, it, expect, vi } from "vitest";
import { screen, fireEvent, within, waitFor } from "@testing-library/react";
import { renderWithProviders } from "@/test-utils/render";
import { BrandKitPicker } from "./BrandKitPicker";
import { DEFAULT_BRAND_KIT, type PortfolioSavedTheme } from "@/lib/page-builder/types";

function setup(overrides: Partial<Parameters<typeof BrandKitPicker>[0]> = {}) {
  const onChange = vi.fn();
  renderWithProviders(
    <BrandKitPicker value={DEFAULT_BRAND_KIT} onChange={onChange} {...overrides} />
  );
  return { onChange };
}

describe("BrandKitPicker", () => {
  it("selecting a theme preset emits the updated kit", () => {
    const { onChange } = setup();
    fireEvent.click(screen.getByRole("button", { name: "Editorial" }));
    expect(onChange).toHaveBeenCalledWith(
      expect.objectContaining({ themePreset: "editorial" })
    );
  });

  it("selecting a heading font emits headingFont without touching bodyFont", () => {
    const { onChange } = setup();
    const headingGroup = screen.getByRole("group", { name: /heading font/i });
    fireEvent.click(within(headingGroup).getByRole("button", { name: /Playfair Display/i }));
    expect(onChange).toHaveBeenCalledWith(
      expect.objectContaining({ headingFont: "playfair" })
    );
    // Independent selectors: choosing a heading must not also rewrite the body.
    expect(onChange).toHaveBeenCalledWith(
      expect.objectContaining({ bodyFont: DEFAULT_BRAND_KIT.bodyFont })
    );
  });

  it("selecting a body font emits bodyFont without touching headingFont", () => {
    const { onChange } = setup();
    const bodyGroup = screen.getByRole("group", { name: /body font/i });
    fireEvent.click(within(bodyGroup).getByRole("button", { name: /^Inter/i }));
    expect(onChange).toHaveBeenCalledWith(
      expect.objectContaining({ bodyFont: "inter", headingFont: DEFAULT_BRAND_KIT.headingFont })
    );
  });

  it("falls back to the legacy fontPair when headingFont/bodyFont are absent", () => {
    // A pre-independent-fonts kit: only fontPair set. The picker should mark the
    // mapped families active without the caller needing to migrate the data.
    const { ...legacy } = DEFAULT_BRAND_KIT;
    delete (legacy as Record<string, unknown>).headingFont;
    delete (legacy as Record<string, unknown>).bodyFont;
    legacy.fontPair = "playfair-inter";
    const onChange = vi.fn();
    renderWithProviders(<BrandKitPicker value={legacy} onChange={onChange} />);
    const headingGroup = screen.getByRole("group", { name: /heading font/i });
    expect(within(headingGroup).getByRole("button", { name: /Playfair Display/i })).toHaveAttribute(
      "aria-pressed",
      "true"
    );
    const bodyGroup = screen.getByRole("group", { name: /body font/i });
    expect(within(bodyGroup).getByRole("button", { name: /^Inter/i })).toHaveAttribute(
      "aria-pressed",
      "true"
    );
  });

  it("propagates a color picked from the accent spectrum popover", () => {
    const { onChange } = setup();
    // Open the Accent color popover, then pick a preset swatch.
    fireEvent.click(screen.getByRole("button", { name: /accent/i }));
    fireEvent.click(screen.getByRole("button", { name: "#7c5cff" }));
    expect(onChange).toHaveBeenCalledWith(
      expect.objectContaining({ accentColor: "#7c5cff" })
    );
  });

  it("propagates a typed valid hex from the accent popover", () => {
    const { onChange } = setup();
    fireEvent.click(screen.getByRole("button", { name: /accent/i }));
    fireEvent.change(screen.getByLabelText("Accent hex"), { target: { value: "abcdef" } });
    expect(onChange).toHaveBeenCalledWith(
      expect.objectContaining({ accentColor: "#abcdef" })
    );
  });

  it("'use workspace branding' pulls primary/secondary from the prop", () => {
    const { onChange } = setup({
      workspaceBranding: { primaryColor: "#123456", secondaryColor: "#654321" },
    });
    fireEvent.click(screen.getByRole("button", { name: /use workspace branding/i }));
    expect(onChange).toHaveBeenCalledWith(
      expect.objectContaining({ primaryColor: "#123456", secondaryColor: "#654321" })
    );
  });

  it("hides the workspace-branding shortcut when no branding is provided", () => {
    setup();
    expect(screen.queryByRole("button", { name: /use workspace branding/i })).toBeNull();
  });

  describe("saved themes", () => {
    const themes: PortfolioSavedTheme[] = [
      {
        id: "t1",
        name: "Sunset",
        brandKit: { ...DEFAULT_BRAND_KIT, accentColor: "#e87a4f" },
      },
    ];

    it("renders an empty-state message when there are no saved themes", () => {
      setup({ onSaveTheme: vi.fn() });
      expect(screen.getByText(/no saved themes yet/i)).toBeInTheDocument();
    });

    it("applies a saved theme's brand kit when its swatch is clicked", () => {
      const { onChange } = setup({ savedThemes: themes, onSaveTheme: vi.fn() });
      fireEvent.click(screen.getByRole("button", { name: /apply theme: sunset/i }));
      expect(onChange).toHaveBeenCalledWith(
        expect.objectContaining({ accentColor: "#e87a4f" })
      );
    });

    it("saves the current kit under a trimmed name", async () => {
      const onSaveTheme = vi.fn().mockResolvedValue(undefined);
      setup({ onSaveTheme });
      fireEvent.change(screen.getByLabelText(/new theme name/i), {
        target: { value: "  Moody  " },
      });
      fireEvent.click(screen.getByRole("button", { name: /save current/i }));
      await waitFor(() => expect(onSaveTheme).toHaveBeenCalledWith("Moody"));
    });

    it("blocks saving a blank name and shows an inline error", async () => {
      const onSaveTheme = vi.fn().mockResolvedValue(undefined);
      setup({ onSaveTheme });
      // A space-only value: the trim guard must reject before calling onSaveTheme.
      // The button is disabled for empty input, so drive the Enter-key path.
      const input = screen.getByLabelText(/new theme name/i);
      fireEvent.change(input, { target: { value: "   " } });
      fireEvent.keyDown(input, { key: "Enter" });
      await waitFor(() => expect(screen.getByRole("alert")).toBeInTheDocument());
      expect(onSaveTheme).not.toHaveBeenCalled();
    });

    it("deletes a saved theme by id", async () => {
      const onDeleteTheme = vi.fn().mockResolvedValue(undefined);
      setup({ savedThemes: themes, onSaveTheme: vi.fn(), onDeleteTheme });
      fireEvent.click(screen.getByRole("button", { name: /delete theme: sunset/i }));
      await waitFor(() => expect(onDeleteTheme).toHaveBeenCalledWith("t1"));
    });

    it("hides the save form when no onSaveTheme handler is provided", () => {
      setup();
      expect(screen.queryByLabelText(/new theme name/i)).toBeNull();
    });
  });
});
