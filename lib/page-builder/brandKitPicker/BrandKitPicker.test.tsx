import { describe, it, expect, vi } from "vitest";
import { screen, fireEvent } from "@testing-library/react";
import { renderWithProviders } from "@/test-utils/render";
import { BrandKitPicker } from "./BrandKitPicker";
import { DEFAULT_BRAND_KIT } from "@/lib/page-builder/types";

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

  it("selecting a font pairing emits the updated kit", () => {
    const { onChange } = setup();
    fireEvent.click(screen.getByRole("button", { name: /Playfair \+ Inter/i }));
    expect(onChange).toHaveBeenCalledWith(
      expect.objectContaining({ fontPair: "playfair-inter" })
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
});
