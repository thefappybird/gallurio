"use client";

import { useSyncExternalStore } from "react";

/**
 * Which section preset's drawer preview is showing — at most one, ever.
 *
 * Deliberately a single module-level value rather than per-row state. Puck
 * renders every drawer item TWICE (the draggable plus a `Drawer-draggableBg`
 * ghost), so per-row state gave each preset two independent popovers whose
 * pointer handlers fought — one closing while the other opened. That was the
 * flicker. Keyed by preset name, both copies of a row resolve to the same entry
 * and simply agree.
 *
 * Interaction contract:
 *   - hovering a row opens its preview;
 *   - clicking a row opens it too;
 *   - hovering or clicking a DIFFERENT row swaps the preview over;
 *   - clicking outside, or acting on the canvas, closes it;
 *   - merely moving the pointer off a row does NOT close it.
 */

let active: string | null = null;
// The row the single panel positions against. The panel is rendered ONCE,
// outside the rows: Puck mounts each row twice, so a per-row panel produced two
// stacked copies of the same card even after both agreed on what to show.
let anchor: HTMLElement | null = null;
const listeners = new Set<() => void>();

function emit(): void {
  for (const l of listeners) l();
}

/**
 * Show `name`'s preview, anchored beside `row`.
 *
 * The anchor is captured only when the PRESET changes. Re-anchoring on every
 * pointerenter would reintroduce the flicker from a third direction: Puck's two
 * mounts of one row are two different elements, so a pointer crossing between
 * the draggable and its ghost would re-anchor repeatedly and jitter the panel
 * between their boxes. Holding the first anchor costs nothing — the row does
 * not move while the pointer is on it.
 */
export function openPresetPreview(name: string, row: HTMLElement): void {
  if (active === name) return;
  active = name;
  anchor = row;
  emit();
}

/** Close whatever is open. No-op when nothing is. */
export function closePresetPreview(): void {
  if (active === null) return;
  active = null;
  anchor = null;
  emit();
}

/** Subscribe to changes; returns an unsubscribe. */
export function subscribePresetPreview(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/** The active preset name, or null. */
export function getActivePresetPreview(): string | null {
  return active;
}

/** The row the active preview is anchored to, or null. */
export function getActivePresetAnchor(): HTMLElement | null {
  return anchor;
}

/** Reactive read of the active preset name. SSR-safe. */
export function useActivePresetPreview(): string | null {
  return useSyncExternalStore(
    subscribePresetPreview,
    getActivePresetPreview,
    getActivePresetPreview
  );
}

/** Test-only: reset module state between runs. */
export function __resetPresetPreview(): void {
  active = null;
  anchor = null;
  listeners.clear();
}
