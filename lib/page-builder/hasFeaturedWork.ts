import type { PuckData } from "./types";

/**
 * Returns true if any zone in `zones` contains at least one "FeaturedWork" block.
 * Used by the editor to warn when the Collections Popup config has no visible block.
 */
export function hasFeaturedWorkInZones(
  zones: Record<string, PuckData | null | undefined>
): boolean {
  return Object.values(zones).some((zone) =>
    (zone?.content ?? []).some((item) => item.type === "FeaturedWork")
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
