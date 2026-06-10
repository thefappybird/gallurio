import { describe, it, expect, vi } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useThemeEditor } from "./useThemeEditor";
import { THEME_PRESET_DEFINITIONS } from "./themePresetDefinitions";
import { DEFAULT_BRAND_KIT, type PortfolioBrandKit, type PortfolioSavedTheme } from "@/lib/page-builder/types";

const editorialKit = THEME_PRESET_DEFINITIONS.editorial.brandKit;
const editorialTile = { key: "preset:editorial", name: "Editorial", brandKit: editorialKit, variant: "preset" as const };

function harness(initial: PortfolioBrandKit = DEFAULT_BRAND_KIT, saved: PortfolioSavedTheme[] = []) {
  const onChange = vi.fn();
  const onUpdateTheme = vi.fn().mockResolvedValue({ ok: true, theme: { id: "s1", name: "x", brandKit: initial } });
  const { result } = renderHook(() =>
    useThemeEditor({ value: initial, onChange, savedThemes: saved, onUpdateTheme }));
  return { result, onChange, onUpdateTheme };
}

describe("useThemeEditor", () => {
  it("creates a Current Theme on first divergent control edit (no confirm)", () => {
    const h = harness();
    act(() => h.result.current.changeControl({ ...DEFAULT_BRAND_KIT, accentColor: "#abcabc" }));
    expect(h.onChange).toHaveBeenCalledWith(expect.objectContaining({ accentColor: "#abcabc" }));
    expect(h.result.current.hasUnsavedCurrent).toBe(true);
    expect(h.result.current.overrideOpen).toBe(false);
    expect(h.result.current.selection).toEqual({ kind: "current" });
  });

  it("preserves the Current Theme when a different tile is loaded", () => {
    const h = harness();
    act(() => h.result.current.changeControl({ ...DEFAULT_BRAND_KIT, accentColor: "#abcabc" }));
    act(() => h.result.current.applyTile(editorialTile));
    expect(h.result.current.hasUnsavedCurrent).toBe(true);
    expect(h.result.current.selection).toEqual({ kind: "tile", key: "preset:editorial" });
  });

  it("asks for confirm when building on a different loaded theme", () => {
    const h = harness();
    act(() => h.result.current.changeControl({ ...DEFAULT_BRAND_KIT, accentColor: "#abcabc" }));
    act(() => h.result.current.applyTile(editorialTile));
    h.onChange.mockClear();
    act(() => h.result.current.changeControl({ ...editorialKit, primaryColor: "#010101" }));
    expect(h.result.current.overrideOpen).toBe(true);
    expect(h.onChange).not.toHaveBeenCalled();
    act(() => h.result.current.confirmOverride());
    expect(h.onChange).toHaveBeenCalledWith(expect.objectContaining({ primaryColor: "#010101" }));
    expect(h.result.current.selection).toEqual({ kind: "current" });
  });

  it("cancelOverride reverts to the active tile's kit", () => {
    const h = harness();
    act(() => h.result.current.changeControl({ ...DEFAULT_BRAND_KIT, accentColor: "#abcabc" }));
    act(() => h.result.current.applyTile(editorialTile));
    act(() => h.result.current.changeControl({ ...editorialKit, primaryColor: "#010101" }));
    h.onChange.mockClear();
    act(() => h.result.current.cancelOverride());
    expect(h.result.current.overrideOpen).toBe(false);
    expect(h.onChange).toHaveBeenCalledWith(editorialKit);
  });

  it("clears the Current Theme when it is saved", () => {
    const h = harness();
    act(() => h.result.current.changeControl({ ...DEFAULT_BRAND_KIT, accentColor: "#abcabc" }));
    act(() => h.result.current.onCurrentThemeSaved({ id: "n", name: "New", brandKit: { ...DEFAULT_BRAND_KIT, accentColor: "#abcabc" } }));
    expect(h.result.current.hasUnsavedCurrent).toBe(false);
    expect(h.result.current.selection).toEqual({ kind: "tile", key: "saved:n" });
  });

  describe("edit mode", () => {
    const saved: PortfolioSavedTheme = { id: "s1", name: "Studio", brandKit: { ...DEFAULT_BRAND_KIT, accentColor: "#222222" } };

    it("enters edit mode, applies the draft to the preview, no diff yet", () => {
      const h = harness(DEFAULT_BRAND_KIT, [saved]);
      act(() => h.result.current.enterEdit(saved));
      expect(h.onChange).toHaveBeenCalledWith(saved.brandKit);
      expect(h.result.current.editing?.id).toBe("s1");
      expect(h.result.current.editDiff).toBe(false);
    });

    it("draft edits set diff and do not create a Current Theme", () => {
      const h = harness(DEFAULT_BRAND_KIT, [saved]);
      act(() => h.result.current.enterEdit(saved));
      act(() => h.result.current.changeControl({ ...saved.brandKit, primaryColor: "#090909" }));
      expect(h.result.current.editDiff).toBe(true);
      expect(h.result.current.hasUnsavedCurrent).toBe(false);
    });

    it("requestExit with a diff opens the guard and defers the action", () => {
      const h = harness(DEFAULT_BRAND_KIT, [saved]);
      const proceed = vi.fn();
      act(() => h.result.current.enterEdit(saved));
      act(() => h.result.current.changeEditName("Studio X"));
      act(() => h.result.current.requestExit(proceed));
      expect(h.result.current.editGuardOpen).toBe(true);
      expect(proceed).not.toHaveBeenCalled();
    });

    it("requestExit without a diff proceeds immediately", () => {
      const h = harness(DEFAULT_BRAND_KIT, [saved]);
      const proceed = vi.fn();
      act(() => h.result.current.enterEdit(saved));
      act(() => h.result.current.requestExit(proceed));
      expect(proceed).toHaveBeenCalledTimes(1);
      expect(h.result.current.editing).toBeNull();
    });

    it("discardEdit reverts the working kit to pre-edit and exits", () => {
      const h = harness(DEFAULT_BRAND_KIT, [saved]);
      const proceed = vi.fn();
      act(() => h.result.current.enterEdit(saved));
      act(() => h.result.current.changeControl({ ...saved.brandKit, primaryColor: "#090909" }));
      act(() => h.result.current.requestExit(proceed));
      h.onChange.mockClear();
      act(() => h.result.current.discardEdit());
      expect(h.onChange).toHaveBeenCalledWith(DEFAULT_BRAND_KIT);
      expect(h.result.current.editing).toBeNull();
      expect(proceed).toHaveBeenCalledTimes(1);
    });

    it("saveAndExitEdit calls onUpdateTheme then proceeds", async () => {
      const h = harness(DEFAULT_BRAND_KIT, [saved]);
      const proceed = vi.fn();
      act(() => h.result.current.enterEdit(saved));
      act(() => h.result.current.changeEditName("Studio X"));
      act(() => h.result.current.requestExit(proceed));
      await act(async () => { await h.result.current.saveAndExitEdit(); });
      expect(h.onUpdateTheme).toHaveBeenCalledWith("s1", "Studio X", saved.brandKit);
      expect(h.result.current.editing).toBeNull();
      expect(proceed).toHaveBeenCalledTimes(1);
    });

    it("surfaces a duplicate-name error and stays in edit mode", async () => {
      const onUpdateTheme = vi.fn().mockResolvedValue({ error: "theme_name_exists" });
      const { result } = renderHook(() =>
        useThemeEditor({ value: DEFAULT_BRAND_KIT, onChange: vi.fn(), savedThemes: [saved], onUpdateTheme }));
      act(() => result.current.enterEdit(saved));
      act(() => result.current.changeEditName("Dupe"));
      act(() => result.current.requestExit(vi.fn()));
      await act(async () => { await result.current.saveAndExitEdit(); });
      expect(result.current.editGuardError).toBe("theme_name_exists");
      expect(result.current.editing?.id).toBe("s1");
    });
  });

  it("cancelOverride after editing then exiting edit mode reverts to the active (saved) tile's kit", async () => {
    const savedNine: PortfolioSavedTheme = { id: "s9", name: "Saved Nine", brandKit: { ...DEFAULT_BRAND_KIT, accentColor: "#aa00aa" } };
    const onChange = vi.fn();
    const onUpdateTheme = vi.fn().mockResolvedValue({ ok: true, theme: savedNine });
    const { result } = renderHook(() =>
      useThemeEditor({ value: DEFAULT_BRAND_KIT, onChange, savedThemes: [savedNine], onUpdateTheme }));

    // create a Current Theme so needsOverrideConfirm will be true later
    act(() => result.current.changeControl({ ...DEFAULT_BRAND_KIT, accentColor: "#abcabc" }));
    // enter edit mode on the saved tile (lastTileKit is still null / DEFAULT from init, not savedNine.brandKit)
    act(() => result.current.enterEdit(savedNine));
    // requestExit with no diff exits immediately
    act(() => result.current.requestExit(() => {}));
    // now selection is tile:saved:s9, currentTheme still non-null, editing is null
    expect(result.current.editing).toBeNull();
    expect(result.current.selection).toEqual({ kind: "tile", key: "saved:s9" });
    expect(result.current.hasUnsavedCurrent).toBe(true);
    // edit a base control -> override confirm pends
    act(() => result.current.changeControl({ ...savedNine.brandKit, primaryColor: "#020202" }));
    expect(result.current.overrideOpen).toBe(true);
    onChange.mockClear();
    act(() => result.current.cancelOverride());
    // must revert to the active saved tile's kit, NOT the stale DEFAULT/earlier kit
    expect(onChange).toHaveBeenCalledWith(savedNine.brandKit);
  });
});
