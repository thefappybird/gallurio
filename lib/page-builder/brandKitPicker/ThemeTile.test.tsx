import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { ThemeTile } from "./ThemeTile";
import { DEFAULT_BRAND_KIT } from "@/lib/page-builder/types";
import type { ThemeTileModel } from "./themeTiles";

const tile: ThemeTileModel = {
  key: "saved:a",
  name: "My Wedding",
  brandKit: { ...DEFAULT_BRAND_KIT, primaryColor: "#112233", accentColor: "#445566" },
  variant: "saved",
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

  it("shows a spinner and disables the delete control while deleting", () => {
    renderTile({ deleting: true });
    const del = screen.getByRole("button", { name: "Delete theme: My Wedding" });
    expect(del).toBeDisabled();
    expect(del.querySelector(".animate-spin")).not.toBeNull();
  });

  it("omits the delete control when no deleteLabel is given (presets)", () => {
    renderTile({ deleteLabel: undefined, onDelete: undefined });
    expect(screen.queryByRole("button", { name: /Delete theme/ })).toBeNull();
  });
});

describe("ThemeTile variants", () => {
  const savedTile: ThemeTileModel = { ...tile, variant: "saved" };
  const currentTile: ThemeTileModel = {
    key: "current", name: "Current Theme", brandKit: tile.brandKit, variant: "current",
  };

  it("renders an edit button on saved tiles that calls onEdit", () => {
    const onEdit = vi.fn();
    render(
      <ThemeTile tile={savedTile} selected={false} applyLabel="Apply theme: My Wedding"
        editLabel="Edit theme: My Wedding" onApply={() => {}} onEdit={onEdit} />
    );
    fireEvent.click(screen.getByRole("button", { name: "Edit theme: My Wedding" }));
    expect(onEdit).toHaveBeenCalledTimes(1);
  });

  it("omits the edit button when editLabel/onEdit are absent (presets)", () => {
    render(
      <ThemeTile tile={{ ...tile, variant: "preset" }} selected={false}
        applyLabel="Apply theme: Minimal" onApply={() => {}} />
    );
    expect(screen.queryByRole("button", { name: /Edit theme/ })).toBeNull();
  });

  it("renders the current tile with a badge and no edit/delete controls", () => {
    render(
      <ThemeTile tile={currentTile} selected applyLabel="Apply theme: Current Theme"
        currentBadge="Unsaved" onApply={() => {}} />
    );
    expect(screen.getByText("Unsaved")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Edit theme/ })).toBeNull();
    expect(screen.queryByRole("button", { name: /Delete theme/ })).toBeNull();
  });

  it("marks the tile being edited via data-editing", () => {
    render(
      <ThemeTile tile={savedTile} selected editing applyLabel="Apply theme: My Wedding"
        onApply={() => {}} />
    );
    expect(document.querySelector('[data-editing="true"]')).not.toBeNull();
  });

  it("shows edit and delete buttons clustered together (both present in the controls group)", () => {
    const onEdit = vi.fn();
    const onDelete = vi.fn();
    render(
      <ThemeTile tile={savedTile} selected={false}
        applyLabel="Apply theme: My Wedding"
        editLabel="Edit theme: My Wedding"
        deleteLabel="Delete theme: My Wedding"
        onApply={() => {}} onEdit={onEdit} onDelete={onDelete} />
    );
    const editBtn = screen.getByRole("button", { name: "Edit theme: My Wedding" });
    const deleteBtn = screen.getByRole("button", { name: "Delete theme: My Wedding" });
    // Both buttons should share the same parent container (the cluster div)
    expect(editBtn.parentElement).toBe(deleteBtn.parentElement);
  });
});

describe("ThemeTile name editing", () => {
  const currentTile: ThemeTileModel = {
    key: "current", name: "Current Theme", brandKit: tile.brandKit, variant: "current",
  };

  it("renders an inline name input + save icon and fires callbacks", () => {
    const onNameChange = vi.fn();
    const onSaveName = vi.fn();
    render(
      <ThemeTile tile={currentTile} selected applyLabel="Apply theme: Current Theme"
        nameEditing nameValue="Spring" saveNameLabel="Save theme"
        onNameChange={onNameChange} onSaveName={onSaveName} onApply={() => {}} />
    );
    const input = screen.getByRole("textbox", { name: "Save theme" });
    expect(input).toHaveValue("Spring");
    fireEvent.change(input, { target: { value: "Summer" } });
    expect(onNameChange).toHaveBeenCalledWith("Summer");
    fireEvent.keyDown(input, { key: "Enter" });
    expect(onSaveName).toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Save theme" }));
    expect(onSaveName).toHaveBeenCalledTimes(2);
    expect(screen.queryByRole("button", { name: "Apply theme: Current Theme" })).toBeNull();
  });

  it("shows an inline error with role=alert", () => {
    render(
      <ThemeTile tile={currentTile} selected applyLabel="x" nameEditing
        saveNameLabel="Save theme" nameError="A theme already exists with this name."
        onApply={() => {}} />
    );
    expect(screen.getByRole("alert")).toHaveTextContent("A theme already exists with this name.");
  });

  it("omits edit and delete buttons in name-editing mode", () => {
    render(
      <ThemeTile tile={currentTile} selected applyLabel="Apply theme: Current Theme"
        nameEditing nameValue="" saveNameLabel="Save theme"
        editLabel="Edit theme: Current Theme" deleteLabel="Delete theme: Current Theme"
        onApply={() => {}} onEdit={() => {}} onDelete={() => {}} />
    );
    expect(screen.queryByRole("button", { name: "Edit theme: Current Theme" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Delete theme: Current Theme" })).toBeNull();
  });
});
