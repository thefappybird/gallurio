import { describe, it, expect, vi } from "vitest";
import { screen, fireEvent, waitFor } from "@testing-library/react";
import { renderWithProviders } from "@/test-utils/render";
import { BrandKitPicker } from "./BrandKitPicker";
import { THEME_PRESET_DEFINITIONS } from "./themePresetDefinitions";
import { DEFAULT_BRAND_KIT, type PortfolioSavedTheme } from "@/lib/page-builder/types";

function setup(overrides: Partial<Parameters<typeof BrandKitPicker>[0]> = {}) {
  const onChange = vi.fn();
  renderWithProviders(
    <BrandKitPicker value={DEFAULT_BRAND_KIT} onChange={onChange} {...overrides} />
  );
  return { onChange };
}

describe("BrandKitPicker", () => {
  it("applies the full brand kit (colors + fonts) when a preset is selected", () => {
    const { onChange } = setup();
    fireEvent.click(screen.getByRole("button", { name: "Apply theme: Editorial" }));
    const applied = onChange.mock.calls.at(-1)![0];
    expect(applied).toEqual(THEME_PRESET_DEFINITIONS.editorial.brandKit);
  });

  it("still renders the color and font editors", () => {
    setup();
    expect(screen.getByRole("group", { name: /heading font/i })).toBeInTheDocument();
    expect(screen.getByRole("group", { name: /body font/i })).toBeInTheDocument();
    expect(screen.getByText("Colors")).toBeInTheDocument();
  });

  it("selecting a heading font emits headingFont without touching bodyFont", () => {
    const { onChange } = setup();
    fireEvent.click(screen.getByRole("button", { name: /heading font/i }));
    fireEvent.mouseDown(screen.getByRole("option", { name: "Playfair Display" }));
    expect(onChange).toHaveBeenCalledWith(
      expect.objectContaining({ headingFont: "playfair" })
    );
    // Independent selectors: choosing a heading must not also rewrite the body.
    expect(onChange).toHaveBeenCalledWith(
      expect.objectContaining({ bodyFont: DEFAULT_BRAND_KIT.bodyFont })
    );
  });

  it("selecting a Google Font shortlist entry for heading emits a google: selection", () => {
    const { onChange } = setup();
    fireEvent.click(screen.getByRole("button", { name: /heading font/i }));
    fireEvent.mouseDown(screen.getByRole("option", { name: "Poppins" }));
    expect(onChange).toHaveBeenCalledWith(
      expect.objectContaining({ headingFont: "google:Poppins" })
    );
  });

  it("typing a custom Google Font name does not call onChange per keystroke, only on blur", () => {
    const { onChange } = setup();
    fireEvent.click(screen.getByRole("button", { name: /heading font/i }));
    fireEvent.mouseDown(screen.getByRole("option", { name: "Custom Google Font…" }));
    const input = screen.getByRole("textbox", { name: /heading font.*custom google font name/i });
    fireEvent.change(input, { target: { value: "B" } });
    fireEvent.change(input, { target: { value: "Be" } });
    fireEvent.change(input, { target: { value: "Bebas Neue" } });
    expect(onChange).not.toHaveBeenCalled();
    fireEvent.blur(input);
    expect(onChange).toHaveBeenCalledWith(
      expect.objectContaining({ headingFont: "google:Bebas Neue" })
    );
    expect(onChange).toHaveBeenCalledTimes(1);
  });

  it("selecting a body font emits bodyFont without touching headingFont", () => {
    const { onChange } = setup();
    fireEvent.click(screen.getByRole("button", { name: /body font/i }));
    fireEvent.mouseDown(screen.getByRole("option", { name: "Inter" }));
    expect(onChange).toHaveBeenCalledWith(
      expect.objectContaining({ bodyFont: "inter", headingFont: DEFAULT_BRAND_KIT.headingFont })
    );
  });

  it("falls back to the legacy fontPair when headingFont/bodyFont are absent", () => {
    const { ...legacy } = DEFAULT_BRAND_KIT;
    delete (legacy as Record<string, unknown>).headingFont;
    delete (legacy as Record<string, unknown>).bodyFont;
    legacy.fontPair = "playfair-inter";
    const onChange = vi.fn();
    renderWithProviders(<BrandKitPicker value={legacy} onChange={onChange} />);
    expect(screen.getByRole("button", { name: /heading font/i })).toHaveTextContent("Playfair Display");
    expect(screen.getByRole("button", { name: /body font/i })).toHaveTextContent("Inter");
  });

  it("propagates a color picked from the accent spectrum popover", () => {
    const { onChange } = setup();
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

  it("shows a Current Theme tile with inline name input after a divergent color edit", () => {
    setup({ onSaveTheme: vi.fn().mockResolvedValue({ ok: true, theme: { id: "n", name: "X", brandKit: DEFAULT_BRAND_KIT } }) });
    fireEvent.click(screen.getByRole("button", { name: /accent/i }));
    fireEvent.change(screen.getByLabelText("Accent hex"), { target: { value: "abcabc" } });
    // Current Theme tile appears with inline name input
    expect(screen.getByRole("textbox", { name: "Theme name" })).toBeInTheDocument();
    // The "Unsaved" badge is gone (replaced by the inline input)
    expect(screen.queryByText("Unsaved")).toBeNull();
  });

  it("enters edit mode from a saved tile and shows inline name input on the tile", () => {
    const themes = [
      { id: "t1", name: "Sunset", brandKit: { ...DEFAULT_BRAND_KIT, accentColor: "#e87a4f" } },
    ];
    setup({ savedThemes: themes, onSaveTheme: vi.fn().mockResolvedValue({ ok: true, theme: { id: "n", name: "X", brandKit: DEFAULT_BRAND_KIT } }) });
    fireEvent.click(screen.getByRole("button", { name: "Edit theme: Sunset" }));
    const input = screen.getByRole("textbox", { name: "Theme name" });
    expect(input).toBeInTheDocument();
    expect(input).toHaveValue("Sunset");
  });

  describe("saved themes", () => {
    const themes: PortfolioSavedTheme[] = [
      {
        id: "t1",
        name: "Sunset",
        brandKit: { ...DEFAULT_BRAND_KIT, accentColor: "#e87a4f" },
      },
    ];

    it("applies a saved theme's brand kit when its tile is clicked", () => {
      const { onChange } = setup({ savedThemes: themes, onSaveTheme: vi.fn().mockResolvedValue({ ok: true, theme: { id: "n", name: "X", brandKit: DEFAULT_BRAND_KIT } }) });
      fireEvent.click(screen.getByRole("button", { name: /apply theme: sunset/i }));
      expect(onChange).toHaveBeenCalledWith(
        expect.objectContaining({ accentColor: "#e87a4f" })
      );
    });

    it("deletes a saved theme by id", async () => {
      const onDeleteTheme = vi.fn().mockResolvedValue(undefined);
      setup({ savedThemes: themes, onSaveTheme: vi.fn().mockResolvedValue({ ok: true, theme: { id: "n", name: "X", brandKit: DEFAULT_BRAND_KIT } }), onDeleteTheme });
      fireEvent.click(screen.getByRole("button", { name: /delete theme: sunset/i }));
      await waitFor(() => expect(onDeleteTheme).toHaveBeenCalledWith("t1"));
    });
  });
});
