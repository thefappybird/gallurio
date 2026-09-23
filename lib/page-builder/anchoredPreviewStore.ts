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
/**
 * Grace period between the pointer leaving the row (or the card) and the card
 * closing. The card is anchored beside its row rather than nested inside it,
 * so the pointer must cross a small gap to reach it; closing immediately on
 * `pointerleave` would make the card unreachable.
 */
export const PREVIEW_CLOSE_DELAY_MS = 120;

export function createAnchoredPreviewStore<Payload = undefined>() {
  let activeKey: string | null = null;
  let activePayload: Payload | undefined;
  let anchor: HTMLElement | null = null;
  let closeTimer: ReturnType<typeof setTimeout> | null = null;
  const listeners = new Set<() => void>();

  function emit(): void {
    for (const l of listeners) l();
  }

  /** Opens `key`'s preview, anchored beside `anchorEl`. No-op if already active. */
  function open(key: string, anchorEl: HTMLElement, payload?: Payload): void {
    cancelClose();
    if (activeKey === key) return;
    activeKey = key;
    activePayload = payload;
    anchor = anchorEl;
    emit();
  }

  /**
   * Arm a close. Entering the row or the card again (either calls `open` or
   * `cancelClose`) keeps it open; anything else lets it fall shut.
   */
  function scheduleClose(delayMs: number = PREVIEW_CLOSE_DELAY_MS): void {
    if (activeKey === null || closeTimer !== null) return;
    closeTimer = setTimeout(() => {
      closeTimer = null;
      close();
    }, delayMs);
  }

  /** Call off a pending `scheduleClose`. No-op when none is armed. */
  function cancelClose(): void {
    if (closeTimer === null) return;
    clearTimeout(closeTimer);
    closeTimer = null;
  }

  /** Closes whatever is open. No-op when nothing is. */
  function close(): void {
    cancelClose();
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
    cancelClose();
    activeKey = null;
    activePayload = undefined;
    anchor = null;
    listeners.clear();
  }

  return {
    open,
    close,
    scheduleClose,
    cancelClose,
    subscribe,
    getActiveKey,
    getActivePayload,
    getAnchor,
    useActiveKey,
    reset,
  };
}
