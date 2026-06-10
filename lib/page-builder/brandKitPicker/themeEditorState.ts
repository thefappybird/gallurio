import type { PortfolioBrandKit, PortfolioSavedTheme } from "@/lib/page-builder/types";
import { brandKitsEqualForSelection } from "./themeTiles";

export type ThemeSelection =
  | { kind: "tile"; key: string }
  | { kind: "current" }
  | { kind: "none" };

export type EditSession = {
  /** Saved theme id being edited. */
  id: string;
  /** Snapshot for diffing + discard-revert. */
  baseTheme: PortfolioSavedTheme;
  /** Working kit captured at entry, restored on discard. */
  baseWorkingKit: PortfolioBrandKit;
  draftKit: PortfolioBrandKit;
  draftName: string;
};

/**
 * A base-control edit needs the override confirm only when a different real
 * tile is the active selection AND an unsaved Current Theme already exists (the
 * edit would overwrite it). Editing while the current tile is active just keeps
 * refining the Current Theme.
 */
export function needsOverrideConfirm(
  selection: ThemeSelection,
  currentTheme: PortfolioBrandKit | null
): boolean {
  return selection.kind === "tile" && currentTheme !== null;
}

/** True when the edit draft differs from the saved theme (name or styling). */
export function editHasDiff(editing: EditSession | null): boolean {
  if (!editing) return false;
  if (editing.draftName.trim() !== editing.baseTheme.name) return true;
  return !brandKitsEqualForSelection(editing.draftKit, editing.baseTheme.brandKit);
}
