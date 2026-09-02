"use client";

/**
 * Owns Ctrl/Cmd+Z (undo), Ctrl/Cmd+Shift+Z and Ctrl/Cmd+Y (redo), and
 * Delete/Backspace (remove the selected block) for the portfolio editor canvas.
 *
 * Puck 0.20.2 registers its own undo/redo hotkeys via a global singleton
 * `held`-key map shared across the whole page (`useHotkeyStore` inside
 * @measured/puck) that requires an EXACT modifier-key match on every
 * keydown/keyup. It listens on `document` in the bubble phase. Any keydown
 * swallowed elsewhere before it gets there (e.g. our own editable-target
 * suppressor in EditorShell, which only intercepts keydown and never keyup)
 * can leave that map permanently desynced, silently breaking every hotkey.
 * Rather than depend on it, this hook owns the combos itself: it intercepts
 * them on `document` in the CAPTURE phase — before Puck's bubble-phase
 * listener ever sees the event — and calls `stopImmediatePropagation()` so
 * Puck's own handler never also fires (no double-undo from one keypress).
 *
 * Puck has no built-in Delete/Backspace hotkey in this version (checked
 * against the installed @measured/puck 0.20.2 bundle) — the remove-selected-
 * block behaviour below is net-new, not a duplicate of existing Puck wiring.
 *
 * Must be called from a component rendered INSIDE the <Puck> tree (passed
 * via one of Puck's override slots), so `usePuckStore`'s context is
 * available — see EditorShell's `puck` override, where this is wired up
 * next to BlockActionsToolbar.
 */
import { useEffect } from "react";
import { usePuckStore } from "@/lib/page-builder/puckHooks";
import { isEditableTarget, isSelfManagedComboboxTarget } from "@/lib/page-builder/editableTarget";

// Mirrors ROOT_ZONE in moveBlockToRoot.ts — inlined here rather than imported
// to avoid coupling to a file another agent is concurrently editing.
const ROOT_ZONE = "root:default-zone";

export function useEditorCanvasHotkeys() {
  const back = usePuckStore((s) => s.history.back);
  const forward = usePuckStore((s) => s.history.forward);
  const dispatch = usePuckStore((s) => s.dispatch);
  const selectedItem = usePuckStore((s) => s.selectedItem);
  const itemSelector = usePuckStore((s) => s.appState?.ui?.itemSelector ?? null);
  const getPermissions = usePuckStore((s) => s.getPermissions);

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      const target = e.target ?? document.activeElement;
      // Never hijack a text edit — Ctrl+Z while typing must undo the TEXT
      // edit (native input behaviour), not the canvas.
      if (isEditableTarget(target) && !isSelfManagedComboboxTarget(target)) return;

      const isMod = e.ctrlKey || e.metaKey;
      if (isMod && e.key.toLowerCase() === "z") {
        e.preventDefault();
        e.stopImmediatePropagation();
        if (e.shiftKey) forward();
        else back();
        return;
      }
      if (isMod && e.key.toLowerCase() === "y") {
        e.preventDefault();
        e.stopImmediatePropagation();
        forward();
        return;
      }
      if (e.key === "Delete" || e.key === "Backspace") {
        if (!selectedItem || !itemSelector) return;
        // Consume the key once a block is selected regardless of the
        // permission outcome below, so a denied delete is a true no-op
        // (not, say, a Backspace falling through to browser back-navigation).
        e.preventDefault();
        e.stopImmediatePropagation();
        // Pinned blocks (e.g. Navigation, footer) declare permissions.delete
        // === false. Puck's own action bar is suppressed app-wide, so this
        // is the only remaining place that enforces it for the Delete key.
        const permissions = getPermissions({ item: selectedItem });
        if (permissions.delete === false) return;
        dispatch({ type: "remove", index: itemSelector.index, zone: itemSelector.zone ?? ROOT_ZONE });
      }
    }

    document.addEventListener("keydown", handleKeyDown, true);
    return () => document.removeEventListener("keydown", handleKeyDown, true);
  }, [back, forward, dispatch, selectedItem, itemSelector, getPermissions]);
}
