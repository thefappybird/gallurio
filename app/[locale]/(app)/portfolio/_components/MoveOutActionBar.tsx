"use client";

/**
 * SuppressedActionBar — Puck actionBar override that renders an empty
 * container so Puck's built-in floating action bar shows no buttons.
 *
 * BlockActionsToolbar (our always-visible toolbar anchored to the selected
 * block) takes over all action handling. Puck's own bar was unreliable:
 * its visibility is gated by internal `dragFinished` state we can't control.
 *
 * Module-level component — stable reference required so Puck does not
 * remount the subtree on every render.
 *
 * Editor chrome → English-only (RELEASE-CHECKLIST §4f).
 */

import type { ReactNode } from "react";
import { ActionBar } from "@measured/puck";

type ActionBarOverrideProps = {
  label?: string;
  children: ReactNode;
  parentAction: ReactNode;
};

/**
 * Renders Puck's ActionBar shell with no children — suppresses all built-in
 * action buttons so they don't compete with BlockActionsToolbar.
 */
export function SuppressedActionBar({ label }: ActionBarOverrideProps) {
  return <ActionBar label={label} />;
}

// Keep the old export name so EditorShell's import still resolves while
// we update it in a follow-up step.
/** @deprecated Use SuppressedActionBar */
export { SuppressedActionBar as MoveOutActionBar };
