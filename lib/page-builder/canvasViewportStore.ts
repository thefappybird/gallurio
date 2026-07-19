"use client";

import { useSyncExternalStore } from "react";

/**
 * Reactive module-level store for the EDIT canvas's device-width clamp + zoom.
 *
 * The viewport controls (rendered inside Puck's `header` override) and the CSS
 * injector (`RootCanvasStyle`, rendered inside the memoized `puck` override) are
 * sibling subtrees inside <Puck> — they can't share React state through the
 * memoized overrides without staleness, so they subscribe to this store instead.
 *
 * State is transient view config (not persisted) and intentionally survives the
 * per-zone Puck remount so the selected width/zoom sticks while switching pages.
 */

export type CanvasDevice = "mobile" | "tablet" | "desktop";

/** Clamp widths per device. `desktop` = null → full width (no clamp). */
export const CANVAS_DEVICE_WIDTHS: Record<CanvasDevice, number | null> = {
  mobile: 390,
  tablet: 768,
  desktop: null,
};

/** Discrete zoom steps (no auto-fit). 1 = 100%. */
export const CANVAS_ZOOM_STEPS = [0.5, 0.75, 1, 1.25, 1.5] as const;

/** Step the zoom one stop in `direction` (+1 in / -1 out), clamped to the range. */
export function stepZoom(current: number, direction: 1 | -1): number {
  const i = CANVAS_ZOOM_STEPS.indexOf(current as (typeof CANVAS_ZOOM_STEPS)[number]);
  const base = i === -1 ? CANVAS_ZOOM_STEPS.indexOf(1) : i;
  const next = Math.min(Math.max(base + direction, 0), CANVAS_ZOOM_STEPS.length - 1);
  return CANVAS_ZOOM_STEPS[next];
}

type CanvasViewportState = { device: CanvasDevice; zoom: number };

let state: CanvasViewportState = { device: "desktop", zoom: 1 };
const listeners = new Set<() => void>();

function emit() {
  for (const l of listeners) l();
}

export function setCanvasDevice(device: CanvasDevice) {
  if (state.device === device) return;
  state = { ...state, device };
  emit();
}

export function setCanvasZoom(zoom: number) {
  if (state.zoom === zoom) return;
  state = { ...state, zoom };
  emit();
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function getSnapshot() {
  return state;
}

/** Subscribe to the canvas viewport state. SSR-safe (returns the same default). */
export function useCanvasViewport(): CanvasViewportState {
  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
}
