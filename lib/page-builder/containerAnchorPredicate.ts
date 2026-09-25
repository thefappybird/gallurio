import { CONTAINER_PRESET_KEYS } from "./blocks/sectionPresets";

/**
 * Shared predicate for container-anchor logic. A Container's editor drop
 * anchor is present ONLY when every real child is itself container-class
 * (Container, Columns, or a container-rendering section preset) — including
 * zero children, the empty-container bootstrap case:
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
  return type === "Container" || type === "Columns"
    || (CONTAINER_PRESET_KEYS as readonly string[]).includes(type);
}

/**
 * Anchor HOSTS — component types whose own slot can carry a trailing
 * ContainerAnchor. Columns is container-CLASS (counts toward a parent's
 * all-container-class check) but is not itself a host: it never grew an
 * anchor of its own.
 */
export function isAnchorHost(type: string): boolean {
  return type === "Container" || (CONTAINER_PRESET_KEYS as readonly string[]).includes(type);
}

export function shouldKeepAnchor(realChildren: readonly { type: string }[]): boolean {
  return realChildren.every((child) => isContainerClass(child.type));
}
