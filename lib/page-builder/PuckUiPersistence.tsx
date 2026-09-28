"use client";

import { useEffect, useRef } from "react";
import { usePuckStore } from "./puckHooks";

export type PersistedPuckUi = {
  leftSideBarVisible?: boolean;
  rightSideBarVisible?: boolean;
  componentList?: Record<string, unknown>;
  selectedBlockId?: string;
};

/**
 * Mirrors Puck's own `ui` state (sidebar visibility, left-panel category
 * expand/collapse, current selection) into `pendingUiRef` continuously, and
 * restores it once a NEW <Puck> tree mounts. Puck 0.20.2 resets `ui` to
 * defaults on every remount, which otherwise silently closed every open
 * drawer and dropped the selection — both on a chrome-order-correcting
 * reseed (a block dropped into the header/footer gets moved back out) and on
 * the Preview toggle's full unmount/remount of <Puck>.
 *
 * Selection is restored by BLOCK ID, not by replaying the raw (position-
 * based) itemSelector — a chrome-order correction is exactly a case where
 * the block's index changed, so the old itemSelector could point at the
 * wrong block. Re-resolving the id via getSelectorForId in the freshly
 * mounted tree means a since-deleted block simply stays deselected instead
 * of mis-selecting something else.
 */
export function PuckUiPersistence({
  pendingUiRef,
}: {
  pendingUiRef: React.MutableRefObject<PersistedPuckUi | null>;
}) {
  const leftSideBarVisible = usePuckStore((s) => s.appState.ui.leftSideBarVisible);
  const rightSideBarVisible = usePuckStore((s) => s.appState.ui.rightSideBarVisible);
  const componentList = usePuckStore((s) => s.appState.ui.componentList) as
    | Record<string, unknown>
    | undefined;
  const selectedBlockId = usePuckStore((s) => s.selectedItem?.props?.id as string | undefined);
  const dispatch = usePuckStore((s) => s.dispatch);
  const getSelectorForId = usePuckStore((s) => s.getSelectorForId);

  // Runs once per mount (a fresh <Puck> tree = a fresh component instance),
  // so no dependency-driven re-fire guard is needed beyond this ref.
  const restoredRef = useRef(false);
  useEffect(() => {
    if (restoredRef.current) return;
    restoredRef.current = true;
    const pending = pendingUiRef.current;
    if (!pending) return;

    // Puck itself force-closes both sidebars on mount below its own 638px
    // breakpoint (chunk-55V3NZVF.mjs:13120-13128) — restoring a desktop
    // session's `true` here would silently re-open them under that width and
    // paint the canvas over. Same breakpoint, so we don't fight Puck's own call.
    const isNarrowViewport =
      typeof window !== "undefined" && !window.matchMedia("(min-width: 638px)").matches;

    const ui: Record<string, unknown> = {};
    if (!isNarrowViewport && pending.leftSideBarVisible !== undefined) ui.leftSideBarVisible = pending.leftSideBarVisible;
    if (!isNarrowViewport && pending.rightSideBarVisible !== undefined) ui.rightSideBarVisible = pending.rightSideBarVisible;
    if (pending.componentList) ui.componentList = pending.componentList;
    if (Object.keys(ui).length > 0) dispatch({ type: "setUi", ui });

    if (pending.selectedBlockId) {
      const selector = getSelectorForId(pending.selectedBlockId);
      if (selector) dispatch({ type: "setUi", ui: { itemSelector: selector } });
    }
  }, [dispatch, getSelectorForId, pendingUiRef]);

  useEffect(() => {
    pendingUiRef.current = {
      leftSideBarVisible,
      rightSideBarVisible,
      componentList,
      selectedBlockId,
    };
  }, [leftSideBarVisible, rightSideBarVisible, componentList, selectedBlockId, pendingUiRef]);

  return null;
}
