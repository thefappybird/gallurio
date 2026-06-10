import { describe, it, expect } from "vitest";
import { needsOverrideConfirm, editHasDiff, type EditSession } from "./themeEditorState";
import { DEFAULT_BRAND_KIT, type PortfolioSavedTheme } from "@/lib/page-builder/types";

describe("needsOverrideConfirm", () => {
  it("is true only when a real tile is active AND a current theme exists", () => {
    expect(needsOverrideConfirm({ kind: "tile", key: "preset:minimal" }, DEFAULT_BRAND_KIT)).toBe(true);
  });
  it("is false when no current theme exists", () => {
    expect(needsOverrideConfirm({ kind: "tile", key: "preset:minimal" }, null)).toBe(false);
  });
  it("is false when the current tile (not a real tile) is active", () => {
    expect(needsOverrideConfirm({ kind: "current" }, DEFAULT_BRAND_KIT)).toBe(false);
    expect(needsOverrideConfirm({ kind: "none" }, DEFAULT_BRAND_KIT)).toBe(false);
  });
});

describe("editHasDiff", () => {
  const base: PortfolioSavedTheme = { id: "x", name: "Base", brandKit: DEFAULT_BRAND_KIT };
  const session = (over: Partial<EditSession> = {}): EditSession => ({
    id: "x",
    baseTheme: base,
    baseWorkingKit: DEFAULT_BRAND_KIT,
    draftKit: DEFAULT_BRAND_KIT,
    draftName: "Base",
    ...over,
  });
  it("is false when neither name nor kit changed", () => {
    expect(editHasDiff(session())).toBe(false);
    expect(editHasDiff(null)).toBe(false);
  });
  it("is true when the name changed (trimmed)", () => {
    expect(editHasDiff(session({ draftName: "Renamed" }))).toBe(true);
    expect(editHasDiff(session({ draftName: "  Base  " }))).toBe(false);
  });
  it("is true when a styling field changed", () => {
    expect(editHasDiff(session({ draftKit: { ...DEFAULT_BRAND_KIT, accentColor: "#000000" } }))).toBe(true);
  });
});
