"use client";

import { useCallback, useMemo, useRef, useState } from "react";
import type { PortfolioBrandKit, PortfolioSavedTheme } from "@/lib/page-builder/types";
import type { ThemeTileModel } from "./themeTiles";
import {
  type ThemeSelection,
  type EditSession,
  needsOverrideConfirm,
  editHasDiff,
} from "./themeEditorState";

type UpdateResult = { ok: true; theme: PortfolioSavedTheme } | { error: string };

type Options = {
  value: PortfolioBrandKit;
  onChange: (next: PortfolioBrandKit) => void;
  savedThemes: PortfolioSavedTheme[];
  onUpdateTheme?: (id: string, name: string, brandKit: PortfolioBrandKit) => Promise<UpdateResult>;
};

export function useThemeEditor({ value, onChange, savedThemes, onUpdateTheme }: Options) {
  const [currentTheme, setCurrentTheme] = useState<PortfolioBrandKit | null>(null);
  const [selection, setSelection] = useState<ThemeSelection>({ kind: "none" });
  const [editing, setEditing] = useState<EditSession | null>(null);

  const [pendingOverride, setPendingOverride] = useState<{ nextKit: PortfolioBrandKit; activeKit: PortfolioBrandKit } | null>(null);
  // Tracks the most recently applied tile's kit so cancelOverride can revert correctly
  // even when `value` is a stale controlled prop.
  const lastTileKit = useRef<PortfolioBrandKit | null>(null);
  const [editGuardOpen, setEditGuardOpen] = useState(false);
  const [editGuardError, setEditGuardError] = useState<string | null>(null);
  const [editSaving, setEditSaving] = useState(false);
  const pendingExit = useRef<(() => void) | null>(null);

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
      // Revert target is the last tile applied (more reliable than `value` which
      // may be stale in a controlled component whose parent hasn't re-rendered yet).
      const activeKit = lastTileKit.current ?? value;
      setPendingOverride({ nextKit, activeKit });
      return;
    }
    onChange(nextKit);
    setCurrentTheme(nextKit);
    setSelection({ kind: "current" });
  }, [editing, selection, currentTheme, value, onChange]); // value kept for fallback activeKit

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

  const onCurrentThemeSaved = useCallback((theme: PortfolioSavedTheme) => {
    setCurrentTheme(null);
    setSelection({ kind: "tile", key: `saved:${theme.id}` });
  }, []);

  const enterEdit = useCallback((theme: PortfolioSavedTheme) => {
    lastTileKit.current = theme.brandKit;
    setEditing({
      id: theme.id,
      baseTheme: theme,
      baseWorkingKit: value,
      draftKit: theme.brandKit,
      draftName: theme.name,
    });
    onChange(theme.brandKit);
    setSelection({ kind: "tile", key: `saved:${theme.id}` });
  }, [value, onChange]);

  const changeEditName = useCallback((name: string) => {
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
    setEditSaving(true);
    setEditGuardError(null);
    try {
      const res = await onUpdateTheme(editing.id, editing.draftName.trim(), editing.draftKit);
      if ("error" in res) {
        setEditGuardError(res.error);
        return;
      }
      lastTileKit.current = res.theme.brandKit;
      onChange(res.theme.brandKit);
      exitEditNow();
    } finally {
      setEditSaving(false);
    }
  }, [editing, onUpdateTheme, onChange, exitEditNow]);

  const cancelEditGuard = useCallback(() => {
    pendingExit.current = null;
    setEditGuardOpen(false);
    setEditGuardError(null);
  }, []);

  return useMemo(() => ({
    currentTheme,
    selection,
    editing,
    hasUnsavedCurrent,
    editDiff,
    applyTile,
    changeControl,
    overrideOpen: pendingOverride !== null,
    confirmOverride,
    cancelOverride,
    enterEdit,
    editName: editing?.draftName ?? "",
    changeEditName,
    requestExit,
    editGuardOpen,
    editGuardError,
    editSaving,
    discardEdit,
    saveAndExitEdit,
    cancelEditGuard,
    onCurrentThemeSaved,
    needsCloseGuard: hasUnsavedCurrent || editDiff,
  }), [
    currentTheme, selection, editing, hasUnsavedCurrent, editDiff, applyTile,
    changeControl, pendingOverride, confirmOverride, cancelOverride, enterEdit,
    changeEditName, requestExit, editGuardOpen, editGuardError, editSaving,
    discardEdit, saveAndExitEdit, cancelEditGuard, onCurrentThemeSaved,
  ]);
}

export type ThemeEditorController = ReturnType<typeof useThemeEditor>;
