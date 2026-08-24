"use client";

/**
 * SuppressedActionBar — Puck actionBar override that renders nothing, so
 * Puck's built-in floating overlay shows no action bar AND no label pill.
 *
 * BlockActionsToolbar (our always-visible toolbar anchored to the selected
 * block) takes over all action handling. Puck's own bar was unreliable:
 * its visibility is gated by internal `dragFinished` state we can't control.
 *
 * Rendering an empty fragment is safe: Puck only falls back to its
 * DefaultActionBar when `overrides.actionBar` is itself falsy (not provided).
 * A function that returns an empty fragment is still truthy, so Puck uses it
 * and renders nothing — no residual "<label>" pill. (Puck's RenderFunc type
 * requires a ReactElement, so a fragment is used rather than `null`.)
 *
 * Module-level component — stable reference required so Puck does not
 * remount the subtree on every render.
 *
 * Editor chrome is intentionally English-only.
 */

import type { ReactElement, ReactNode } from "react";

type ActionBarOverrideProps = {
  label?: string;
  children: ReactNode;
  parentAction: ReactNode;
};

export const SuppressedActionBar: (props: ActionBarOverrideProps) => ReactElement = () => <></>;
