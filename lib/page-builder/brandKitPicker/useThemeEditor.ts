"use client";

import { useCallback, useMemo, useRef, useState } from "react";
import type { PortfolioBrandKit, PortfolioSavedTheme } from "@/lib/page-builder/types";
import { isThemeNameTaken } from "@/lib/page-builder/themeNames";
import type { ThemeTileModel } from "./themeTiles";
import {
  type ThemeSelection,
  type EditSession,
  needsOverrideConfirm,
  editHasDiff,
} from "./themeEditorState";

type SaveResult = { ok: true; theme: PortfolioSavedTheme } | { error: string };

/** Error codes for the inline name inputs; components map these to messages. */
export type ThemeNameError = "required" | "tooLong" | "duplicate" | "saveFailed";

type Options = {
  value: PortfolioBrandKit;
  onChange: (next: PortfolioBrandKit) => void;
  savedThemes: PortfolioSavedTheme[];
  onSaveTheme?: (name: string) => Promise<SaveResult>;
  onUpdateTheme?: (id: string, name: string, brandKit: PortfolioBrandKit) => Promise<SaveResult>;
};

function validateName(
  name: string,
  savedThemes: PortfolioSavedTheme[],
  excludeId?: string
): ThemeNameError | null {
  const trimmed = name.trim();
  if (!trimmed) return "required";
  if (trimmed.length > 60) return "tooLong";
  if (isThemeNameTaken(trimmed, savedThemes, excludeId)) return "duplicate";
  return null;
}

export function useThemeEditor({ value, onChange, savedThemes, onSaveTheme, onUpdateTheme }: Options) {
  const [currentTheme, setCurrentTheme] = useState<PortfolioBrandKit | null>(null);
  const [selection, setSelection] = useState<ThemeSelection>({ kind: "none" });
  const [editing, setEditing] = useState<EditSession | null>(null);

  const [currentThemeName, setCurrentThemeNameState] = useState("");
  const [currentThemeNameError, setCurrentThemeNameError] = useState<ThemeNameError | null>(null);
  const [savingCurrentTheme, setSavingCurrentTheme] = useState(false);

  const [pendingOverride, setPendingOverride] = useState<{ nextKit: PortfolioBrandKit; activeKit: PortfolioBrandKit } | null>(null);
  const [editGuardOpen, setEditGuardOpen] = useState(false);
  const [editGuardError, setEditGuardError] = useState<ThemeNameError | null>(null);
  const [editSaving, setEditSaving] = useState(false);
  const pendingExit = useRef<(() => void) | null>(null);
  const lastTileKit = useRef<PortfolioBrandKit>(value);

  const editDiff = editHasDiff(editing);
  const hasUnsavedCurrent = currentTheme !== null;

  const applyTile = useCallback((tile: ThemeTileModel) => {
    onChange(tile.brandKit);
    lastTileKit.current = tile.brandKit;
    if (tile.variant === "current") setSelection({ kind: "current" });
    else setSelection({ kind: "tile", key: tile.key });
  }, [onChange]);

  const changeControl = useCallback((nextKit: PortfolioBrandKit) => {
    if (editing) {
      setEditing((e) => (e ? { ...e, draftKit: nextKit } : e));
      onChange(nextKit);
      return;
    }
    if (needsOverrideConfirm(selection, currentTheme)) {
      setPendingOverride({ nextKit, activeKit: lastTileKit.current });
      return;
    }
    onChange(nextKit);
    setCurrentTheme(nextKit);
    setSelection({ kind: "current" });
  }, [editing, selection, currentTheme, onChange]);

  const confirmOverride = useCallback(() => {
    if (!pendingOverride) return;
    onChange(pendingOverride.nextKit);
    setCurrentTheme(pendingOverride.nextKit);
    setSelection({ kind: "current" });
    setPendingOverride(null);
  }, [pendingOverride, onChange]);

  const cancelOverride = useCallback(() => {
    if (pendingOverride) onChange(pendingOverride.activeKit);
    setPendingOverride(null);
  }, [pendingOverride, onChange]);

  const setCurrentThemeName = useCallback((name: string) => {
    setCurrentThemeNameState(name);
    setCurrentThemeNameError(null);
  }, []);

  const saveCurrentTheme = useCallback(async (): Promise<boolean> => {
    if (!onSaveTheme || currentTheme === null) return false;
    const err = validateName(currentThemeName, savedThemes);
    if (err) { setCurrentThemeNameError(err); return false; }
    setSavingCurrentTheme(true);
    setCurrentThemeNameError(null);
    try {
      const res = await onSaveTheme(currentThemeName.trim());
      if ("error" in res) {
        setCurrentThemeNameError(res.error === "theme_name_exists" ? "duplicate" : "saveFailed");
        return false;
      }
      setCurrentTheme(null);
      setSelection({ kind: "tile", key: `saved:${res.theme.id}` });
      setCurrentThemeNameState("");
      return true;
    } finally {
      setSavingCurrentTheme(false);
    }
  }, [onSaveTheme, currentTheme, currentThemeName, savedThemes]);

  const enterEdit = useCallback((theme: PortfolioSavedTheme) => {
    lastTileKit.current = theme.brandKit;
    setEditing({ id: theme.id, baseTheme: theme, baseWorkingKit: value, draftKit: theme.brandKit, draftName: theme.name });
    onChange(theme.brandKit);
    setSelection({ kind: "tile", key: `saved:${theme.id}` });
  }, [value, onChange]);

  const changeEditName = useCallback((name: string) => {
    setEditGuardError(null);
    setEditing((e) => (e ? { ...e, draftName: name } : e));
  }, []);

  const exitEditNow = useCallback(() => {
    setEditing(null);
    setEditGuardOpen(false);
    setEditGuardError(null);
    const proceed = pendingExit.current;
    pendingExit.current = null;
    proceed?.();
  }, []);

  const requestExit = useCallback((proceed: () => void) => {
    if (editing && editHasDiff(editing)) {
      pendingExit.current = proceed;
      setEditGuardOpen(true);
      return;
    }
    setEditing(null);
    proceed();
  }, [editing]);

  const discardEdit = useCallback(() => {
    if (editing) onChange(editing.baseWorkingKit);
    exitEditNow();
  }, [editing, onChange, exitEditNow]);

  const saveAndExitEdit = useCallback(async () => {
    if (!editing || !onUpdateTheme) return;
    const err = validateName(editing.draftName, savedThemes, editing.id);
    if (err) { setEditGuardError(err); return; }
    setEditSaving(true);
    setEditGuardError(null);
    try {
      const res = await onUpdateTheme(editing.id, editing.draftName.trim(), editing.draftKit);
      if ("error" in res) {
        setEditGuardError(res.error === "theme_name_exists" ? "duplicate" : "saveFailed");
        return;
      }
      lastTileKit.current = res.theme.brandKit;
      onChange(res.theme.brandKit);
      exitEditNow();
    } finally {
      setEditSaving(false);
    }
  }, [editing, onUpdateTheme, savedThemes, onChange, exitEditNow]);

  const cancelEditGuard = useCallback(() => {
    pendingExit.current = null;
    setEditGuardOpen(false);
    setEditGuardError(null);
  }, []);

  return useMemo(() => ({
    currentTheme, selection, editing, hasUnsavedCurrent, editDiff,
    applyTile, changeControl,
    overrideOpen: pendingOverride !== null, confirmOverride, cancelOverride,
    currentThemeName, setCurrentThemeName, currentThemeNameError, savingCurrentTheme, saveCurrentTheme,
    enterEdit, editName: editing?.draftName ?? "", changeEditName,
    requestExit, editGuardOpen, editGuardError, editSaving, discardEdit, saveAndExitEdit, cancelEditGuard,
  }), [
    currentTheme, selection, editing, hasUnsavedCurrent, editDiff, applyTile, changeControl,
    pendingOverride, confirmOverride, cancelOverride,
    currentThemeName, setCurrentThemeName, currentThemeNameError, savingCurrentTheme, saveCurrentTheme,
    enterEdit, changeEditName, requestExit, editGuardOpen, editGuardError, editSaving, discardEdit, saveAndExitEdit, cancelEditGuard,
  ]);
}

export type ThemeEditorController = ReturnType<typeof useThemeEditor>;
