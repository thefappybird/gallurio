"use client";

import { useEffect } from "react";
import { usePuckStore } from "@/lib/page-builder/puckHooks";
import { CONTAINER_EDITOR_HEIGHT_PX, type ContainerHeight } from "./manualBlocks";

/**
 * Editor-only container anchor. Computes its own height reactively from the
 * parent container's live child list via usePuckStore, so it self-sizes on
 * every sibling change without depending on resolveData (which only fires on
 * insert/load, not on child moves — there is no "move" trigger in Puck 0.20.2).
 *
 * Also bounces Puck selection from itself to its parent container so the anchor
 * never appears selected in the sidebar or shows an action bar.
 *
 * Only mounted when puck.isEditing === true (guarded in editorConfig ContainerAnchor
 * render). usePuckStore therefore always runs within a live Puck provider context.
 *
 * A3 note: This component uses NO ResizeObserver and no DOM-size measurements.
 * Height is computed purely from Puck store data (props.minHeight + content length).
 * There is no feedback loop here that could contribute to the Columns oscillation
 * crash described in items 3/4/6. The root cause of that crash — shared
 * containerName "pf-cols" causing cross-instance @container rule contamination —
 * was fixed in ColumnsBlock (A1). This component needs no change.
 */
export function EditorContainerAnchor({ id }: { id: string }) {
  const parentId = id.replace(/--anchor$/, "");

  // Reactively compute height from the parent's live content array. This
  // selector re-evaluates whenever the parent container's children or
  // minHeight change (add/remove/reorder triggers a store update → re-render).
  const height = usePuckStore((s) => {
    const parent = s.getItemById(parentId);
    if (!parent) return 0;

    const minHeight =
      (parent.props?.minHeight as ContainerHeight | undefined) ?? "auto";
    const content =
      (parent.props?.content as Array<{ type: string }> | undefined) ?? [];
    const realChildren = content.filter((item) => item.type !== "ContainerAnchor");

    if (realChildren.length === 0) {
      // Empty container — show full editor footprint so it's droppable.
      return CONTAINER_EDITOR_HEIGHT_PX[minHeight];
    }
    if (realChildren.length === 1 && realChildren[0].type === "Container") {
      // Bridge case: keep a 4px footprint so a 2nd Container can be dropped
      // as a sibling (not nested inside the 1st Container).
      return 4;
    }
    // Container has real non-container content → collapse anchor to 0.
    return 0;
  });

  // Selection bounce: if Puck selects this anchor (e.g. user clicks the tiny
  // 4px footprint or keyboard-navigates into it), immediately redirect selection
  // to the parent container so the anchor never shows in the sidebar.
  const selectedItem = usePuckStore((s) => s.selectedItem);
  const dispatch = usePuckStore((s) => s.dispatch);
  const getSelectorForId = usePuckStore((s) => s.getSelectorForId);

  useEffect(() => {
    if (!selectedItem) return;
    const selectedId = selectedItem.props?.id as string | undefined;
    // Only bounce when THIS anchor is selected; any other selection → no-op.
    if (selectedId !== id) return;
    // Guard: if the anchor id has no --anchor suffix (malformed draft), then
    // parentId === id. Dispatching would select the parent (same id) → the
    // guard never fires again → infinite setState loop (React error #185).
    if (parentId === id) return;

    const parentSelector = getSelectorForId(parentId);
    if (!parentSelector) return;

    // Redirect selection to the parent Container. After the dispatch, Puck
    // updates selectedItem to the parent, breaking this condition → no loop.
    dispatch({ type: "setUi", ui: { itemSelector: parentSelector } });
  }, [selectedItem, id, parentId, dispatch, getSelectorForId]);

  if (height === 0) return null;

  return (
    <div
      aria-hidden="true"
      style={{ height: `${height}px`, width: "100%", pointerEvents: "none" }}
    />
  );
}
