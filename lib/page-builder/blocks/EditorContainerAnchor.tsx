"use client";

import { useEffect } from "react";
import { usePuckStore } from "@/lib/page-builder/puckHooks";
import { isContainerClass } from "@/lib/page-builder/containerAnchorPredicate";
import { CONTAINER_EDITOR_HEIGHT_PX, type ContainerHeight } from "./manualBlocks";

// "none": no parent found, nothing renders. "fixed": empty/bridge cases —
// a pixel height computed from Puck data. "fill": ordinary children present
// — flex-grow absorbs whatever leftover space a stretched sibling creates
// (see Item 11 note above); collapses to 0px on its own when there's none.
type AnchorMode = { kind: "none" } | { kind: "fixed"; height: number } | { kind: "fill" };

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
 * Height is computed purely from Puck store data (props.minHeight + content length)
 * for the empty/bridge cases below. There is no feedback loop here that could
 * contribute to the Columns oscillation crash described in items 3/4/6. The root
 * cause of that crash — shared containerName "pf-cols" causing cross-instance
 * @container rule contamination — was fixed in ColumnsBlock (A1).
 *
 * Item 11: when the container holds ordinary (non-container) children, the
 * slot may still be stretched taller than its own content (e.g. a shorter
 * Columns cell next to a taller sibling). That leftover space is NOT
 * derivable from Puck data — it depends on measured layout of the sibling.
 * Rather than add a ResizeObserver (see A3 above — that class of feedback
 * loop already caused a real crash here), the "fill" mode below gives the
 * anchor `flex: "1 1 auto"` as the slot's last flex child; since the slot
 * itself already fills the stretched section (flex: "1 1 auto" in
 * ContainerBlock), the anchor absorbs exactly the remaining flex space with
 * pure CSS — no measurement, no feedback loop.
 */
export function EditorContainerAnchor({ id }: { id: string }) {
  const parentId = id.replace(/--anchor$/, "");

  // Reactively compute the anchor's mode from the parent's live content
  // array. This selector re-evaluates whenever the parent container's
  // children or minHeight change (add/remove/reorder triggers a store
  // update → re-render).
  const mode = usePuckStore((s): AnchorMode => {
    const parent = s.getItemById(parentId);
    if (!parent) return { kind: "none" };

    const minHeight =
      (parent.props?.minHeight as ContainerHeight | undefined) ?? "auto";
    const content =
      (parent.props?.content as Array<{ type: string }> | undefined) ?? [];
    const realChildren = content.filter((item) => item.type !== "ContainerAnchor");

    if (realChildren.length === 0) {
      // Empty container — show full editor footprint so it's droppable.
      return { kind: "fixed", height: CONTAINER_EDITOR_HEIGHT_PX[minHeight] };
    }
    if (realChildren.every((child) => isContainerClass(child.type))) {
      // Bridge case: every real child is container-class (Container or
      // Columns, any count) — keep a 4px footprint so another sibling can
      // still be dropped here instead of nested inside an existing child.
      return { kind: "fixed", height: 4 };
    }
    // Container has ordinary content: no fixed height (not derivable from
    // data) — let flex-grow absorb whatever leftover space a stretched
    // sibling creates. Collapses to 0 on its own when there's none.
    return { kind: "fill" };
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

  if (mode.kind === "none") return null;

  if (mode.kind === "fill") {
    // No fixed height (see Item 11 note above): flex-grow, not a pixel value,
    // absorbs the slot's leftover space so the anchor's own rect covers the
    // whole highlighted area — matching pointerEvents:"none" below, since
    // Puck/dnd-kit resolve drops from each child's measured rect, not native
    // pointer hit-testing (already proven by the empty/bridge cases above).
    return (
      <div
        className="pf-container-anchor"
        aria-hidden="true"
        style={{ flex: "1 1 auto", minHeight: 0, width: "100%", pointerEvents: "none" }}
      />
    );
  }

  return (
    <div
      className="pf-container-anchor"
      aria-hidden="true"
      style={{ height: `${mode.height}px`, width: "100%", pointerEvents: "none" }}
    />
  );
}
