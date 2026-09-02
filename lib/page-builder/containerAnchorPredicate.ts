/**
 * Shared predicate for container-anchor logic. A Container always keeps its
 * editor drop anchor now (appended as the slot's last child), regardless of
 * what its real children are:
 *  - empty: the anchor IS the drop target (full editor footprint).
 *  - every real child is container-class (Container or Columns): the anchor
 *    is a thin "bridge" so a sibling can land next to the nested
 *    container/columns instead of inside it.
 *  - one or more ordinary (non-container) children: the anchor absorbs any
 *    leftover flex space when the slot is stretched taller than its own
 *    content (e.g. a shorter Columns cell next to a taller sibling), so the
 *    whole highlighted area is droppable, not just the strip under the
 *    existing children.
 *
 * The anchor's RENDERED height for each case is decided in
 * EditorContainerAnchor (data has no measured geometry) — this module only
 * decides whether the anchor exists in the data, and stays a pure function
 * of the data so containerAnchorReconciler.ts remains idempotent by
 * reference.
 */

export function isContainerClass(type: string): boolean {
  return type === "Container" || type === "Columns";
}

export function shouldKeepAnchor(): boolean {
  return true;
}
