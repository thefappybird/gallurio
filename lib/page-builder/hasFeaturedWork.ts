import type { PuckData } from "./types";

type BlockLike = { type?: string; props?: { content?: unknown } };

/**
 * Recursively scans a block list for a FeaturedWork block. Presets and any block
 * dropped into a Container/Columns nest children in their `content` slot, so a
 * top-level-only scan would miss the most common insertion path.
 */
function containsFeaturedWork(items: readonly unknown[]): boolean {
  return items.some((item) => {
    const block = item as BlockLike;
    if (block.type === "FeaturedWork") return true;
    const nested = block.props?.content;
    return Array.isArray(nested) && containsFeaturedWork(nested);
  });
}

/**
 * Returns true if any zone in `zones` contains at least one "FeaturedWork" block
 * (at any nesting depth). Used by the editor to warn when the Collections Popup
 * config has no visible block.
 */
export function hasFeaturedWorkInZones(
  zones: Record<string, PuckData | null | undefined>
): boolean {
  return Object.values(zones).some((zone) =>
    containsFeaturedWork(zone?.content ?? [])
  );
}

/**
 * Returns "open" if the editor should open the collections popup directly,
 * or "warn" if it should show a warning first (no FeaturedWork block in any zone).
 */
export function resolveCollectionsPopupAction(hasBlock: boolean): "open" | "warn" {
  return hasBlock ? "open" : "warn";
}

/** Combines hasFeaturedWorkInZones + resolveCollectionsPopupAction in one call. */
export function computeCollectionsPopupAction(
  zones: Record<string, PuckData | null | undefined>
): "open" | "warn" {
  return resolveCollectionsPopupAction(hasFeaturedWorkInZones(zones));
}

/**
 * Applies the collections popup branch decision:
 * - `callbacks.open()` when action is "open"
 * - `callbacks.warn()` when action is "warn" (caller shows warning and can call open later)
 */
export function applyCollectionsPopupBranch(
  action: "open" | "warn",
  callbacks: { open: () => void; warn: () => void }
): void {
  if (action === "warn") {
    callbacks.warn();
  } else {
    callbacks.open();
  }
}
