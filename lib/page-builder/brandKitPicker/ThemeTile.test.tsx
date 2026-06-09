import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { ThemeTile } from "./ThemeTile";
import { DEFAULT_BRAND_KIT } from "@/lib/page-builder/types";
import type { ThemeTileModel } from "./themeTiles";

const tile: ThemeTileModel = {
  key: "saved:a",
  name: "My Wedding",
  brandKit: { ...DEFAULT_BRAND_KIT, primaryColor: "#112233", accentColor: "#445566" },
  savedThemeId: "a",
};

function renderTile(over: Partial<Parameters<typeof ThemeTile>[0]> = {}) {
  const onApply = vi.fn();
  const onDelete = vi.fn();
  render(
    <ThemeTile
      tile={tile}
      selected={false}
      applyLabel={`Apply theme: ${tile.name}`}
      deleteLabel={`Delete theme: ${tile.name}`}
      onApply={onApply}
      onDelete={onDelete}
      {...over}
    />
  );
  return { onApply, onDelete };
}

describe("ThemeTile", () => {
  it("renders the title and two color swatches (primary, accent)", () => {
    renderTile();
    expect(screen.getByText("My Wedding")).toBeInTheDocument();
    const apply = screen.getByRole("button", { name: "Apply theme: My Wedding" });
    const swatches = apply.querySelectorAll("[data-swatch]");
    expect(swatches).toHaveLength(2);
    expect((swatches[0] as HTMLElement).style.background).toBe("#112233");
    expect((swatches[1] as HTMLElement).style.background).toBe("#445566");
  });

  it("calls onApply when the tile is clicked", () => {
    const { onApply } = renderTile();
    fireEvent.click(screen.getByRole("button", { name: "Apply theme: My Wedding" }));
    expect(onApply).toHaveBeenCalledTimes(1);
  });

  it("reflects the selected state via aria-pressed", () => {
    renderTile({ selected: true });
    expect(screen.getByRole("button", { name: "Apply theme: My Wedding" })).toHaveAttribute(
      "aria-pressed",
      "true"
    );
  });

  it("shows a delete control that calls onDelete", () => {
    const { onDelete } = renderTile();
    fireEvent.click(screen.getByRole("button", { name: "Delete theme: My Wedding" }));
    expect(onDelete).toHaveBeenCalledTimes(1);
  });

  it("omits the delete control when no deleteLabel is given (presets)", () => {
    renderTile({ deleteLabel: undefined, onDelete: undefined });
    expect(screen.queryByRole("button", { name: /Delete theme/ })).toBeNull();
  });
});
