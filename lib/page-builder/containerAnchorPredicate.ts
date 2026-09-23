/**
 * Shared predicate for container-anchor logic. A Container's editor drop
 * anchor is present ONLY when every real child is itself container-class
 * (Container or Columns) — including zero children, the empty-container
 * bootstrap case:
 *  - empty: the anchor IS the drop target (full editor footprint).
 *  - every real child is container-class: the anchor is a thin "bridge" so a
 *    sibling can land next to the nested container/columns instead of
 *    inside it.
 *  - ANY ordinary (non-container) child is present: no anchor at all — an
 *    absorb-leftover-space "fill" anchor here made the anchor's presence and
 *    rendered mode fight each other on every edit (a real block dropped
 *    beside/removed near an ordinary child churned the anchor in and out),
 *    which is exactly the class of resolveData/reconciler thrash that broke
 *    the canvas earlier. Dropping this case entirely removes that surface.
 *
 * The anchor's RENDERED height for the two remaining cases is decided in
 * EditorContainerAnchor (data has no measured geometry) — this module only
 * decides whether the anchor exists in the data, and stays a pure function
 * of the data so containerAnchorReconciler.ts remains idempotent by
 * reference.
 */

export function isContainerClass(type: string): boolean {
  return type === "Container" || type === "Columns";
}

/**
 * Kill switch for the whole anchor mechanism.
 *
 * The bridge case above exists only because Puck 0.20 had no way to drop a
 * sibling BESIDE a nested container. Puck 0.23 replaced that drag model with
 * insertion lines, which may make the bridge redundant. Turning this off is
 * how we find out: both writers (this module's callers -- the live
 * `reconcileContainerAnchors` and `editorConfig`'s Container `resolveData` --
 * route through `shouldKeepAnchor`), so one flag stops emission everywhere and
 * the reconciler then strips anchors already sitting in saved or seeded data.
 *
 * The empty-container case is unaffected: an empty Container gets its editor
 * drop footprint from Puck's native `minEmptyHeight` (manualBlocks.tsx), not
 * from the anchor.
 *
 * `ContainerAnchor` stays registered in the config regardless, so published
 * pages and old drafts that still carry one keep rendering (it returns null
 * outside the editor).
 */
export const CONTAINER_ANCHORS_ENABLED = false;

export function shouldKeepAnchor(realChildren: readonly { type: string }[]): boolean {
  if (!CONTAINER_ANCHORS_ENABLED) return false;
  return realChildren.every((child) => isContainerClass(child.type));
}
