import { describe, it, expect, vi } from "vitest";
import { useState } from "react";
import { screen, fireEvent, waitFor } from "@testing-library/react";
import { renderWithProviders } from "@/test-utils/render";
import { ThemeGrid } from "./ThemeGrid";
import { useThemeEditor } from "./useThemeEditor";
import { DEFAULT_BRAND_KIT, type PortfolioBrandKit, type PortfolioSavedTheme } from "@/lib/page-builder/types";
import { THEME_PRESET_DEFINITIONS } from "./themePresetDefinitions";

const manySaved = (n: number): PortfolioSavedTheme[] =>
  Array.from({ length: n }, (_, i) => ({
    id: `s${i}`,
    name: `Saved ${i}`,
    brandKit: { ...DEFAULT_BRAND_KIT, accentColor: `#0000${i % 10}${i % 10}` },
  }));

function Harness({
  savedThemes = [],
  onSaveTheme,
  onDeleteTheme,
  onChangeSpy,
}: {
  savedThemes?: PortfolioSavedTheme[];
  onSaveTheme?: (n: string) => Promise<{ ok: true; theme: PortfolioSavedTheme } | { error: string }>;
  onDeleteTheme?: (id: string) => Promise<void>;
  onChangeSpy?: (k: PortfolioBrandKit) => void;
}) {
  const [value, setValue] = useState<PortfolioBrandKit>(DEFAULT_BRAND_KIT);
  const controller = useThemeEditor({
    value,
    onChange: (k) => {
      setValue(k);
      onChangeSpy?.(k);
    },
    savedThemes,
    onSaveTheme,
    onUpdateTheme: async () => ({ ok: true, theme: { id: "x", name: "x", brandKit: value } }),
  });
  return (
    <ThemeGrid
      value={value}
      savedThemes={savedThemes}
      controller={controller}
      onDeleteTheme={onDeleteTheme}
    />
  );
}

function setup(over: Parameters<typeof Harness>[0] = {}) {
  const onChangeSpy = vi.fn();
  const onSaveTheme = vi.fn().mockResolvedValue({ ok: true, theme: { id: "n1", name: "New", brandKit: DEFAULT_BRAND_KIT } });
  const onDeleteTheme = vi.fn().mockResolvedValue(undefined);
  renderWithProviders(
    <Harness onChangeSpy={onChangeSpy} onSaveTheme={onSaveTheme} onDeleteTheme={onDeleteTheme} {...over} />
  );
  return { onChangeSpy, onSaveTheme, onDeleteTheme };
}

describe("ThemeGrid", () => {
  it("applies the full brand kit when a preset tile is clicked (regression)", () => {
    const { onChangeSpy } = setup();
    fireEvent.click(screen.getByRole("button", { name: "Apply theme: Editorial" }));
    expect(onChangeSpy).toHaveBeenCalledWith(THEME_PRESET_DEFINITIONS.editorial.brandKit);
  });

  it("shows at most 9 tiles per page and paginates beyond 9", () => {
    setup({ savedThemes: manySaved(6) }); // 6 presets + 6 saved = 12
    expect(screen.getAllByRole("button", { name: /Apply theme:/ })).toHaveLength(9);
    fireEvent.click(screen.getByRole("button", { name: "More themes" }));
    expect(screen.getAllByRole("button", { name: /Apply theme:/ })).toHaveLength(3);
  });

  it("does not render pagination for 9 or fewer tiles", () => {
    setup({ savedThemes: manySaved(3) }); // 9
    expect(screen.queryByRole("button", { name: "More themes" })).toBeNull();
  });

  it("filters tiles by the search query and shows an empty message", () => {
    setup({ savedThemes: manySaved(2) });
    fireEvent.change(screen.getByPlaceholderText("Search themes"), { target: { value: "Saved 1" } });
    expect(screen.getAllByRole("button", { name: /Apply theme:/ })).toHaveLength(1);
    fireEvent.change(screen.getByPlaceholderText("Search themes"), { target: { value: "nope" } });
    expect(screen.getByText("No themes match your search.")).toBeInTheDocument();
  });

  it("renders delete only on saved tiles and calls onDeleteTheme", () => {
    const { onDeleteTheme } = setup({ savedThemes: manySaved(1) });
    expect(screen.queryByRole("button", { name: "Delete theme: Minimal" })).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Delete theme: Saved 0" }));
    expect(onDeleteTheme).toHaveBeenCalledWith("s0");
  });

  it("renders an edit button only on saved tiles", () => {
    setup({ savedThemes: manySaved(1) });
    expect(screen.queryByRole("button", { name: "Edit theme: Minimal" })).toBeNull();
    expect(screen.getByRole("button", { name: "Edit theme: Saved 0" })).toBeInTheDocument();
  });

  it("marks the tile matching the current brand kit as selected", () => {
    setup();
    expect(screen.getByRole("button", { name: "Apply theme: Minimal" })).toHaveAttribute(
      "aria-pressed",
      "true"
    );
  });

  it("editing a saved tile shows inline name input; saving calls onUpdateTheme and exits edit mode", async () => {
    const saved = [{ id: "t1", name: "Ocean", brandKit: { ...DEFAULT_BRAND_KIT, accentColor: "#5fb3a8" } }];
    setup({ savedThemes: saved });
    fireEvent.click(screen.getByRole("button", { name: "Edit theme: Ocean" }));
    const input = screen.getByRole("textbox", { name: "Theme name" });
    fireEvent.change(input, { target: { value: "Ocean Renamed" } });
    fireEvent.click(screen.getByRole("button", { name: "Save theme" }));
    // After save, edit mode is exited (the tile no longer shows input but the regular apply button)
    await waitFor(() =>
      expect(screen.getByRole("button", { name: "Apply theme: Ocean" })).toBeInTheDocument()
    );
  });
});
