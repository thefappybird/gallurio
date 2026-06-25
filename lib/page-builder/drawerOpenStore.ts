import { createContext } from "react";

/**
 * Module-level store for the open/closed state of a named EditorDrawerSection
 * per block id. Survives StyleToolkitField remounts (which Puck triggers on each
 * field value change) so a collapsible section the user expanded stays expanded
 * while editing the same block. Without this, typing into an input inside a
 * non-first section (e.g. colSpan/rowSpan in the "Layout" section) would collapse
 * the section on every keystroke, because the remount resets the section's local
 * `open` state back to its `defaultOpen`.
 *
 * Keys are `${blockId}::${sectionTitle}`. A key with no entry falls back to the
 * caller-supplied default (the section's `defaultOpen`).
 */

const store = new Map<string, boolean>();

export function getDrawerOpen(key: string, fallback: boolean): boolean {
  const stored = store.get(key);
  return stored ?? fallback;
}

export function setDrawerOpen(key: string, open: boolean): void {
  store.set(key, open);
}

/**
 * Carries the currently-selected block id down to EditorDrawerSection so it can
 * build a persistence key. Empty string means "no block context" (standalone /
 * test render), in which case sections keep their original local-only behavior.
 */
export const BlockIdContext = createContext<string>("");
