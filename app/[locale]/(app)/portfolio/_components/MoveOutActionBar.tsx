"use client";

/**
 * Puck actionBar override that adds a "Move out" button to the block action bar.
 *
 * Clicking "Move out" dispatches a Puck `move` action that relocates the
 * currently selected nested block to the page root zone. The button is only
 * rendered when the selected block is actually nested (not already at root).
 *
 * This sidesteps the dnd-kit nested-zone drag-collision problem for blocks
 * (especially empty containers) that are hard to drag out manually.
 *
 * Editor chrome → English-only (RELEASE-CHECKLIST §4f).
 */

import type { ReactNode, SyntheticEvent } from "react";
import { ActionBar, usePuck } from "@measured/puck";
import type { AppState } from "@measured/puck";
import { ArrowUpFromLine } from "lucide-react";
import { moveBlockToRootAction } from "@/lib/page-builder/moveBlockToRoot";

/** Local mirror of Puck's internal PrivateAppState (not exported by @measured/puck). */
type AppStateWithIndexes = AppState & {
  indexes: {
    nodes: Record<string, { zone: string }>;
    zones: Record<string, { contentIds: string[] }>;
  };
};

type ActionBarOverrideProps = {
  label?: string;
  children: ReactNode;
  parentAction: ReactNode;
};

/**
 * Module-level component — stable reference, no closure over changing values.
 * Puck remounts the subtree whenever the override identity changes, so this
 * must NOT be defined inline or inside a render function.
 */
export function MoveOutActionBar({
  label,
  children,
  parentAction,
}: ActionBarOverrideProps) {
  const { appState, selectedItem, dispatch } = usePuck();

  // appState is typed as AppState (no indexes) but Puck passes PrivateAppState
  // at runtime. Cast to access indexes for the move calculation.
  const indexes = (appState as AppStateWithIndexes).indexes;
  const itemId = selectedItem?.props?.id as string | undefined;

  const action =
    indexes && itemId
      ? moveBlockToRootAction(indexes, itemId)
      : null;

  function handleMoveOut(e: SyntheticEvent) {
    e.stopPropagation();
    if (action) dispatch(action);
  }

  return (
    <ActionBar label={label}>
      {parentAction}
      {children}
      {action && (
        <ActionBar.Action label="Move out" onClick={handleMoveOut}>
          <ArrowUpFromLine size={16} aria-hidden />
        </ActionBar.Action>
      )}
    </ActionBar>
  );
}
