import { describe, it, expect, vi } from "vitest";
import { screen, fireEvent } from "@testing-library/react";
import { renderWithProviders, enMessages } from "@/test-utils/render";
import { ThemeGrid } from "./ThemeGrid";
import { DEFAULT_BRAND_KIT, type PortfolioSavedTheme } from "@/lib/page-builder/types";
import { THEME_PRESET_DEFINITIONS } from "./themePresetDefinitions";

const brandKitKeys = {
  ...enMessages.app.pageBuilder.brandKit,
  themes: "Themes",
  searchPlaceholder: "Search themes",
  noThemesMatch: "No themes match your search.",
  prevPage: "Previous themes",
  nextPage: "More themes",
  pageIndicator: "{current} / {total}",
  applyTheme: "Apply theme: {name}",
  deleteTheme: "Delete theme: {name}",
  saveCurrentAsTheme: "Save current as theme",
  themeNamePlaceholder: "Theme name",
  saveAction: "Save",
  enterThemeName: "Enter a name for this theme.",
  nameTooLong: "Name too long.",
  saveThemeError: "Could not save theme.",
  themeLimitReached: "Limit {max} reached.",
};
const messages = {
  ...enMessages,
  app: {
    ...enMessages.app,
    pageBuilder: {
      ...enMessages.app.pageBuilder,
      brandKit: brandKitKeys,
    },
  },
};

function setup(over: Partial<Parameters<typeof ThemeGrid>[0]> = {}) {
  const onChange = vi.fn();
  const onSaveTheme = vi.fn().mockResolvedValue(undefined);
  const onDeleteTheme = vi.fn().mockResolvedValue(undefined);
  renderWithProviders(
    <ThemeGrid
      value={DEFAULT_BRAND_KIT}
      onChange={onChange}
      savedThemes={[]}
      onSaveTheme={onSaveTheme}
      onDeleteTheme={onDeleteTheme}
      {...over}
    />,
    { messages }
  );
  return { onChange, onSaveTheme, onDeleteTheme };
}

const manySaved = (n: number): PortfolioSavedTheme[] =>
  Array.from({ length: n }, (_, i) => ({
    id: `s${i}`,
    name: `Saved ${i}`,
    brandKit: { ...DEFAULT_BRAND_KIT, accentColor: `#0000${(i % 10)}${(i % 10)}` },
  }));

describe("ThemeGrid", () => {
  it("applies the full brand kit when a preset tile is clicked (regression)", () => {
    const { onChange } = setup();
    fireEvent.click(screen.getByRole("button", { name: "Apply theme: Editorial" }));
    expect(onChange).toHaveBeenCalledWith(THEME_PRESET_DEFINITIONS.editorial.brandKit);
    expect(onChange.mock.calls[0][0].accentColor).toBe("#7e6a52");
    expect(onChange.mock.calls[0][0].headingFont).toBe("playfair");
  });

  it("shows at most 9 tiles per page and paginates beyond 9", () => {
    setup({ savedThemes: manySaved(6) }); // 6 presets + 6 saved = 12 -> 2 pages
    expect(screen.getAllByRole("button", { name: /Apply theme:/ })).toHaveLength(9);
    fireEvent.click(screen.getByRole("button", { name: "More themes" }));
    expect(screen.getAllByRole("button", { name: /Apply theme:/ })).toHaveLength(3);
  });

  it("does not render pagination for 9 or fewer tiles", () => {
    setup({ savedThemes: manySaved(3) }); // 6 + 3 = 9
    expect(screen.queryByRole("button", { name: "More themes" })).toBeNull();
  });

  it("filters tiles by the search query and shows an empty message", () => {
    setup({ savedThemes: manySaved(2) });
    fireEvent.change(screen.getByPlaceholderText("Search themes"), {
      target: { value: "Saved 1" },
    });
    expect(screen.getAllByRole("button", { name: /Apply theme:/ })).toHaveLength(1);
    fireEvent.change(screen.getByPlaceholderText("Search themes"), {
      target: { value: "nope" },
    });
    expect(screen.getByText("No themes match your search.")).toBeInTheDocument();
  });

  it("renders delete only on saved tiles and calls onDeleteTheme", () => {
    const { onDeleteTheme } = setup({ savedThemes: manySaved(1) });
    expect(screen.queryByRole("button", { name: "Delete theme: Minimal" })).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Delete theme: Saved 0" }));
    expect(onDeleteTheme).toHaveBeenCalledWith("s0");
  });

  it("marks the tile matching the current brand kit as selected", () => {
    setup(); // value = DEFAULT_BRAND_KIT == Minimal preset
    expect(screen.getByRole("button", { name: "Apply theme: Minimal" })).toHaveAttribute(
      "aria-pressed",
      "true"
    );
  });
});
