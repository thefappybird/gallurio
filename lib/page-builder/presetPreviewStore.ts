"use client";

import { createAnchoredPreviewStore } from "./anchoredPreviewStore";

/**
 * Which preset or manual block's drawer help is showing — at most one, ever.
 *
 * Deliberately a single module-level value rather than per-row state. Puck
 * renders every drawer item TWICE (the draggable plus a `Drawer-draggableBg`
 * ghost), so per-row state gave each preset two independent popovers whose
 * pointer handlers fought — one closing while the other opened. That was the
 * flicker. Keyed by block name, both copies of a row resolve to the same entry
 * and simply agree.
 *
 * Interaction contract:
 *   - hovering or focusing a row opens its preview/help;
 *   - clicking a row opens it too;
 *   - hovering or clicking a DIFFERENT row swaps the preview over;
 *   - clicking outside, or acting on the canvas, closes it;
 *   - merely moving the pointer off a row does NOT close it.
 *
 * Built on the generic `createAnchoredPreviewStore` factory (see that module
 * for the "single active item + anchor" mechanics this wraps).
 */

const store = createAnchoredPreviewStore();

/**
 * Show `name`'s preview, anchored beside `row`.
 *
 * The anchor is captured only when the BLOCK changes. Re-anchoring on every
 * pointerenter would reintroduce the flicker from a third direction: Puck's two
 * mounts of one row are two different elements, so a pointer crossing between
 * the draggable and its ghost would re-anchor repeatedly and jitter the panel
 * between their boxes. Holding the first anchor costs nothing — the row does
 * not move while the pointer is on it.
 */
export function openPresetPreview(name: string, row: HTMLElement): void {
  store.open(name, row);
}

/** Close whatever is open. No-op when nothing is. */
export function closePresetPreview(): void {
  store.close();
}

/** Subscribe to changes; returns an unsubscribe. */
export function subscribePresetPreview(listener: () => void): () => void {
  return store.subscribe(listener);
}

/** The active preset/manual block name, or null. */
export function getActivePresetPreview(): string | null {
  return store.getActiveKey();
}

/** The row the active preview is anchored to, or null. */
export function getActivePresetAnchor(): HTMLElement | null {
  return store.getAnchor();
}

/** Reactive read of the active preset/manual block name. SSR-safe. */
export function useActivePresetPreview(): string | null {
  return store.useActiveKey();
}

/** Test-only: reset module state between runs. */
export function __resetPresetPreview(): void {
  store.reset();
}
