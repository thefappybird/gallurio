import { describe, it, expect, vi } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useThemeEditor } from "./useThemeEditor";
import { THEME_PRESET_DEFINITIONS } from "./themePresetDefinitions";
import { DEFAULT_BRAND_KIT, type PortfolioBrandKit, type PortfolioSavedTheme } from "@/lib/page-builder/types";

const editorialKit = THEME_PRESET_DEFINITIONS.editorial.brandKit;
const editorialTile = { key: "preset:editorial", name: "Editorial", brandKit: editorialKit, variant: "preset" as const };

const savedTheme = (id: string, name: string, kit: PortfolioBrandKit = DEFAULT_BRAND_KIT): PortfolioSavedTheme => ({ id, name, brandKit: kit });

function harness(initial: PortfolioBrandKit = DEFAULT_BRAND_KIT, saved: PortfolioSavedTheme[] = []) {
  const onChange = vi.fn();
  const onSaveTheme = vi.fn().mockResolvedValue({ ok: true as const, theme: { id: "n1", name: "New", brandKit: initial } });
  const onUpdateTheme = vi.fn().mockResolvedValue({ ok: true as const, theme: { id: "s1", name: "x", brandKit: initial } });
  const { result } = renderHook(() =>
    useThemeEditor({ value: initial, onChange, savedThemes: saved, onSaveTheme, onUpdateTheme }));
  return { result, onChange, onSaveTheme, onUpdateTheme };
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

  describe("saveCurrentTheme", () => {
    it("calls onSaveTheme, clears currentTheme, and sets selection to saved", async () => {
      const h = harness();
      act(() => h.result.current.changeControl({ ...DEFAULT_BRAND_KIT, accentColor: "#abcabc" }));
      act(() => h.result.current.setCurrentThemeName("My Theme"));
      await act(async () => { await h.result.current.saveCurrentTheme(); });
      expect(h.onSaveTheme).toHaveBeenCalledWith("My Theme");
      expect(h.result.current.hasUnsavedCurrent).toBe(false);
      expect(h.result.current.selection).toEqual({ kind: "tile", key: "saved:n1" });
    });

    it("returns false and sets error 'required' when name is empty", async () => {
      const h = harness();
      act(() => h.result.current.changeControl({ ...DEFAULT_BRAND_KIT, accentColor: "#abcabc" }));
      let result = false;
      await act(async () => { result = await h.result.current.saveCurrentTheme(); });
      expect(result).toBe(false);
      expect(h.result.current.currentThemeNameError).toBe("required");
      expect(h.onSaveTheme).not.toHaveBeenCalled();
    });

    it("returns false and sets error 'duplicate' when name already exists", async () => {
      const existing = savedTheme("e1", "Taken");
      const h = harness(DEFAULT_BRAND_KIT, [existing]);
      act(() => h.result.current.changeControl({ ...DEFAULT_BRAND_KIT, accentColor: "#abcabc" }));
      act(() => h.result.current.setCurrentThemeName("Taken"));
      let result = true;
      await act(async () => { result = await h.result.current.saveCurrentTheme(); });
      expect(result).toBe(false);
      expect(h.result.current.currentThemeNameError).toBe("duplicate");
      expect(h.onSaveTheme).not.toHaveBeenCalled();
    });
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

    it("saveAndExitEdit sets editGuardError 'duplicate' on name collision (excluding self allowed)", async () => {
      const other = savedTheme("s2", "Dupe");
      const onUpdateTheme = vi.fn().mockResolvedValue({ error: "theme_name_exists" });
      const { result } = renderHook(() =>
        useThemeEditor({ value: DEFAULT_BRAND_KIT, onChange: vi.fn(), savedThemes: [saved, other], onUpdateTheme }));
      act(() => result.current.enterEdit(saved));
      act(() => result.current.changeEditName("Dupe"));
      act(() => result.current.requestExit(vi.fn()));
      await act(async () => { await result.current.saveAndExitEdit(); });
      expect(result.current.editGuardError).toBe("duplicate");
      expect(result.current.editing?.id).toBe("s1");
    });
  });

  it("cancelOverride after editing then exiting edit mode reverts to the active (saved) tile's kit", async () => {
    const savedNine: PortfolioSavedTheme = { id: "s9", name: "Saved Nine", brandKit: { ...DEFAULT_BRAND_KIT, accentColor: "#aa00aa" } };
    const onChange = vi.fn();
    const onUpdateTheme = vi.fn().mockResolvedValue({ ok: true as const, theme: savedNine });
    const { result } = renderHook(() =>
      useThemeEditor({ value: DEFAULT_BRAND_KIT, onChange, savedThemes: [savedNine], onUpdateTheme }));

    // create a Current Theme so needsOverrideConfirm will be true later
    act(() => result.current.changeControl({ ...DEFAULT_BRAND_KIT, accentColor: "#abcabc" }));
    // enter edit mode on the saved tile
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

  it("color change while a saved tile is active (no unsaved draft) creates a new unsaved variant, leaving saved themes untouched", () => {
    const saved: PortfolioSavedTheme = { id: "s1", name: "Studio", brandKit: { ...DEFAULT_BRAND_KIT, accentColor: "#222222" } };
    const h = harness(DEFAULT_BRAND_KIT, [saved]);
    // Apply the saved tile
    act(() => h.result.current.applyTile({ key: "saved:s1", name: "Studio", brandKit: saved.brandKit, variant: "saved", savedThemeId: "s1" }));
    expect(h.result.current.selection).toEqual({ kind: "tile", key: "saved:s1" });
    expect(h.result.current.hasUnsavedCurrent).toBe(false);
    // Change a color
    act(() => h.result.current.changeControl({ ...saved.brandKit, primaryColor: "#ff0000" }));
    // A new unsaved current theme is created (not a silent overwrite of saved theme)
    expect(h.result.current.hasUnsavedCurrent).toBe(true);
    expect(h.result.current.selection.kind).toBe("current");
    // The saved theme is untouched
    expect(saved.brandKit.primaryColor).not.toBe("#ff0000");
  });

  it("requestAddNew opens the add-new guard when there is an unsaved draft (hasUnsavedCurrent)", () => {
    const h = harness();
    act(() => h.result.current.changeControl({ ...DEFAULT_BRAND_KIT, accentColor: "#abcabc" }));
    expect(h.result.current.hasUnsavedCurrent).toBe(true);
    act(() => h.result.current.requestAddNew());
    expect(h.result.current.addNewGuardOpen).toBe(true);
  });

  it("discardCurrentTheme clears the unsaved draft and reverts the canvas to the last applied tile kit", () => {
    const h = harness();
    // create an unsaved draft
    act(() => h.result.current.changeControl({ ...DEFAULT_BRAND_KIT, accentColor: "#abcabc" }));
    expect(h.result.current.hasUnsavedCurrent).toBe(true);
    h.onChange.mockClear();
    act(() => h.result.current.discardCurrentTheme());
    expect(h.result.current.hasUnsavedCurrent).toBe(false);
    // canvas reverted to the last applied tile kit (DEFAULT_BRAND_KIT before any changeControl)
    expect(h.onChange).toHaveBeenCalledWith(DEFAULT_BRAND_KIT);
  });

  describe("requestAddNew guard", () => {
    it("requestAddNew with NO unsaved state starts a blank new theme immediately (no guard)", () => {
      const h = harness();
      act(() => h.result.current.requestAddNew());
      expect(h.result.current.addNewGuardOpen).toBe(false);
      // currentTheme is already null, selection remains none — no error
      expect(h.result.current.hasUnsavedCurrent).toBe(false);
    });

    it("requestAddNew while editing a saved theme with a dirty diff opens the guard", () => {
      const saved: PortfolioSavedTheme = { id: "s1", name: "Studio", brandKit: { ...DEFAULT_BRAND_KIT, accentColor: "#222222" } };
      const h = harness(DEFAULT_BRAND_KIT, [saved]);
      act(() => h.result.current.enterEdit(saved));
      act(() => h.result.current.changeEditName("Studio X"));
      expect(h.result.current.editDiff).toBe(true);
      act(() => h.result.current.requestAddNew());
      expect(h.result.current.addNewGuardOpen).toBe(true);
    });

    it("requestAddNew while editing a saved theme with NO diff starts new theme immediately", () => {
      const saved: PortfolioSavedTheme = { id: "s1", name: "Studio", brandKit: { ...DEFAULT_BRAND_KIT, accentColor: "#222222" } };
      const h = harness(DEFAULT_BRAND_KIT, [saved]);
      act(() => h.result.current.enterEdit(saved));
      // no name change, no kit change — no diff
      expect(h.result.current.editDiff).toBe(false);
      act(() => h.result.current.requestAddNew());
      expect(h.result.current.addNewGuardOpen).toBe(false);
      expect(h.result.current.editing).toBeNull();
    });

    it("Save in the add-new guard with a DUPLICATE name keeps the modal open with the inline error", async () => {
      const existing = savedTheme("e1", "Taken");
      const h = harness(DEFAULT_BRAND_KIT, [existing]);
      // create an unsaved draft
      act(() => h.result.current.changeControl({ ...DEFAULT_BRAND_KIT, accentColor: "#abcabc" }));
      act(() => h.result.current.requestAddNew());
      expect(h.result.current.addNewGuardOpen).toBe(true);
      // type the duplicate name
      act(() => h.result.current.setAddNewGuardName("Taken"));
      await act(async () => { await h.result.current.saveAndAddNew(); });
      // modal stays open, error is set, no theme was started
      expect(h.result.current.addNewGuardOpen).toBe(true);
      expect(h.result.current.addNewGuardNameError).toBe("duplicate");
      expect(h.result.current.hasUnsavedCurrent).toBe(true);
    });

    it("Save in the add-new guard with a unique name persists the draft and starts the new theme", async () => {
      const h = harness();
      act(() => h.result.current.changeControl({ ...DEFAULT_BRAND_KIT, accentColor: "#abcabc" }));
      act(() => h.result.current.requestAddNew());
      act(() => h.result.current.setAddNewGuardName("Brand New"));
      await act(async () => { await h.result.current.saveAndAddNew(); });
      expect(h.onSaveTheme).toHaveBeenCalledWith("Brand New");
      expect(h.result.current.addNewGuardOpen).toBe(false);
      expect(h.result.current.hasUnsavedCurrent).toBe(false);
      expect(h.result.current.editing).toBeNull();
    });

    it("Discard in the add-new guard drops the unsaved draft and reverts the canvas", () => {
      const h = harness();
      act(() => h.result.current.changeControl({ ...DEFAULT_BRAND_KIT, accentColor: "#abcabc" }));
      act(() => h.result.current.requestAddNew());
      h.onChange.mockClear();
      act(() => h.result.current.discardAndAddNew());
      expect(h.result.current.addNewGuardOpen).toBe(false);
      expect(h.result.current.hasUnsavedCurrent).toBe(false);
      expect(h.onChange).toHaveBeenCalledWith(DEFAULT_BRAND_KIT);
    });

    it("Keep editing (cancelAddNew) closes the guard and stays on the current theme", () => {
      const h = harness();
      act(() => h.result.current.changeControl({ ...DEFAULT_BRAND_KIT, accentColor: "#abcabc" }));
      act(() => h.result.current.requestAddNew());
      expect(h.result.current.addNewGuardOpen).toBe(true);
      act(() => h.result.current.cancelAddNew());
      expect(h.result.current.addNewGuardOpen).toBe(false);
      expect(h.result.current.hasUnsavedCurrent).toBe(true);
    });
  });
});
