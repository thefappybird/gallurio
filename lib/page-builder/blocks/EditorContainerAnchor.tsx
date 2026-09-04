"use client";

import { useEffect } from "react";
import { usePuckStore } from "@/lib/page-builder/puckHooks";
import { isContainerClass } from "@/lib/page-builder/containerAnchorPredicate";
import { CONTAINER_EDITOR_HEIGHT_PX, type ContainerHeight } from "./manualBlocks";

/** Out-of-flow "bridge" footprint height (px) — see the mode comment below. */
const BRIDGE_HEIGHT_PX = 16;

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
 * Two modes, matching the only two cases in which the anchor exists in the
 * data at all (see shouldKeepAnchor — a container holding ANY ordinary child
 * carries no anchor):
 *  - empty container ("empty" mode): unchanged — a real in-flow div at the
 *    full editor footprint, so the container is droppable and Puck's own
 *    empty-zone overlay tracks it.
 *  - all children container-class ("bridge" mode): a nested pair of
 *    Containers/Columns under a row + justify-content:between should end
 *    flush at the slot's inline edges. An in-flow bridge div used to be a
 *    THIRD flex item competing for that free space, so it is now taken out
 *    of flow (`position: absolute`, pinned to the slot's inline edges and
 *    bottom — the slot is already `position: relative`, see ContainerBlock)
 *    while staying a real, measurable rect for dnd-kit's rect math.
 *
 * A3 note: NO ResizeObserver and no DOM-size measurements. Mode/height come
 * purely from Puck store data (props.minHeight + content length), so there is
 * no feedback loop here that could contribute to the Columns oscillation
 * crash described in items 3/4/6. The root cause of that crash — shared
 * containerName "pf-cols" causing cross-instance @container rule
 * contamination — was fixed in ColumnsBlock (A1).
 */
export function EditorContainerAnchor({ id }: { id: string }) {
  const parentId = id.replace(/--anchor$/, "");

  // Reactively compute the anchor's mode from the parent's live content
  // array. This selector re-evaluates whenever the parent container's
  // children change (add/remove/reorder triggers a store update → re-render).
  //
  // The selector MUST return a primitive. usePuckStore is a zustand store read
  // through useSyncExternalStore, which compares successive snapshots with
  // Object.is; a fresh object makes every snapshot look new → "The result of
  // getSnapshot should be cached" → infinite re-render. null = render nothing
  // (a stale anchor left in a mixed slot by an older draft, until the
  // reconciler strips it on the next store tick).
  const mode = usePuckStore((s): "empty" | "bridge" | null => {
    const parent = s.getItemById(parentId);
    if (!parent) return null;

    const content =
      (parent.props?.content as Array<{ type: string }> | undefined) ?? [];
    const realChildren = content.filter((item) => item.type !== "ContainerAnchor");

    if (realChildren.length === 0) return "empty";
    return realChildren.every((child) => isContainerClass(child.type)) ? "bridge" : null;
  });

  // Only needed in "empty" mode — a second primitive-returning selector, safe
  // for the same Object.is-snapshot-stability reason as above.
  const minHeight = usePuckStore((s): ContainerHeight => {
    const parent = s.getItemById(parentId);
    return (parent?.props?.minHeight as ContainerHeight | undefined) ?? "auto";
  });

  // Selection bounce: if Puck selects this anchor (e.g. user clicks its tiny
  // footprint or keyboard-navigates into it), immediately redirect selection
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

  if (mode === null) return null;

  if (mode === "bridge") {
    return (
      <div
        className="pf-container-anchor"
        aria-hidden="true"
        style={{
          position: "absolute",
          insetInlineStart: 0,
          insetInlineEnd: 0,
          bottom: 0,
          height: `${BRIDGE_HEIGHT_PX}px`,
          pointerEvents: "none",
        }}
      />
    );
  }

  return (
    <div
      className="pf-container-anchor"
      aria-hidden="true"
      style={{ height: `${CONTAINER_EDITOR_HEIGHT_PX[minHeight]}px`, width: "100%", pointerEvents: "none" }}
    />
  );
}
