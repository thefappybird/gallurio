"use client";

import { useSyncExternalStore } from "react";

/**
 * Generic "at most one active item, plus its anchor element" store factory.
 *
 * Extracted from `presetPreviewStore.ts` — see that module's header for the
 * full interaction-contract rationale (Puck mounts drawer rows twice, so
 * per-row state produced two fighting popovers). Any UI that shows exactly
 * one floating preview/help card anchored to whichever row/tile is hovered
 * or focused should create its own instance of this rather than
 * re-implementing the pattern. `presetPreviewStore.ts` and
 * `layoutPreviewStore.ts` both wrap one.
 *
 * `Payload` is optional data carried alongside the anchor (e.g. what to
 * render) — `presetPreviewStore` doesn't need it (the consumer resolves the
 * key itself via its own `describe` callback), `layoutPreviewStore` does.
 */
export function createAnchoredPreviewStore<Payload = undefined>() {
  let activeKey: string | null = null;
  let activePayload: Payload | undefined;
  let anchor: HTMLElement | null = null;
  const listeners = new Set<() => void>();

  function emit(): void {
    for (const l of listeners) l();
  }

  /** Opens `key`'s preview, anchored beside `anchorEl`. No-op if already active. */
  function open(key: string, anchorEl: HTMLElement, payload?: Payload): void {
    if (activeKey === key) return;
    activeKey = key;
    activePayload = payload;
    anchor = anchorEl;
    emit();
  }

  /** Closes whatever is open. No-op when nothing is. */
  function close(): void {
    if (activeKey === null) return;
    activeKey = null;
    activePayload = undefined;
    anchor = null;
    emit();
  }

  function subscribe(listener: () => void): () => void {
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  }

  function getActiveKey(): string | null {
    return activeKey;
  }

  function getActivePayload(): Payload | undefined {
    return activePayload;
  }

  function getAnchor(): HTMLElement | null {
    return anchor;
  }

  /** Reactive read of the active key. SSR-safe. */
  function useActiveKey(): string | null {
    return useSyncExternalStore(subscribe, getActiveKey, getActiveKey);
  }

  /** Test-only: reset module state between runs. */
  function reset(): void {
    activeKey = null;
    activePayload = undefined;
    anchor = null;
    listeners.clear();
  }

  return { open, close, subscribe, getActiveKey, getActivePayload, getAnchor, useActiveKey, reset };
}
