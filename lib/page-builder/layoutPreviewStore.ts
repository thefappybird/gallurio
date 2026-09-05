"use client";

import type { ReactNode } from "react";
import { createAnchoredPreviewStore } from "./anchoredPreviewStore";

/**
 * Which layout-picker tile's enlarged preview is showing — at most one,
 * ever, shared across every `LayoutPicker` instance mounted at once (e.g.
 * the popup-layout and image-modal-layout pickers living side by side in
 * `CollectionsPopupPanelDialog`), so hovering one never leaves a second card
 * open from the other.
 *
 * Same interaction contract as `presetPreviewStore.ts`: hover, focus, or
 * click on a tile opens it; a different tile swaps it over; a pointerdown
 * outside the card or Escape closes it; merely leaving a tile does not.
 * Built on the same `createAnchoredPreviewStore` factory.
 */

export type LayoutPreviewPayload = {
  label: string;
  description: string;
  /** The tile's own schematic renderer, closed over its option id — the
   *  card only ever supplies `images` once real workspace photos are ready. */
  renderThumb: (images?: string[]) => ReactNode;
};

const store = createAnchoredPreviewStore<LayoutPreviewPayload>();

/** Show a tile's preview, anchored beside `anchor`. No-op if already active. */
export function openLayoutPreview(
  key: string,
  anchor: HTMLElement,
  payload: LayoutPreviewPayload
): void {
  store.open(key, anchor, payload);
}

/** Close whatever is open. No-op when nothing is. */
export function closeLayoutPreview(): void {
  store.close();
}

/** Subscribe to changes; returns an unsubscribe. */
export function subscribeLayoutPreview(listener: () => void): () => void {
  return store.subscribe(listener);
}

/** The active tile's key, or null. */
export function getActiveLayoutPreview(): string | null {
  return store.getActiveKey();
}

/** The active tile's label/description/renderer, or undefined. */
export function getActiveLayoutPreviewPayload(): LayoutPreviewPayload | undefined {
  return store.getActivePayload();
}

/** The tile the active preview is anchored to, or null. */
export function getActiveLayoutPreviewAnchor(): HTMLElement | null {
  return store.getAnchor();
}

/** Reactive read of the active tile key. SSR-safe. */
export function useActiveLayoutPreview(): string | null {
  return store.useActiveKey();
}

/** Test-only: reset module state between runs. */
export function __resetLayoutPreview(): void {
  store.reset();
}
