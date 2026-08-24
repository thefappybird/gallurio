/**
 * Pure helpers for block action bar dispatch actions.
 *
 * Editor chrome is intentionally English-only.
 */

export const ROOT_ZONE = "root:default-zone";

export type MoveAction = {
  type: "move";
  sourceIndex: number;
  sourceZone: string;
  destinationIndex: number;
  destinationZone: string;
};

export type DuplicateAction = {
  type: "duplicate";
  sourceIndex: number;
  sourceZone: string;
};

export type RemoveAction = {
  type: "remove";
  index: number;
  zone: string;
};

export type BlockActions = {
  moveOut: MoveAction | null;
  moveUp: MoveAction | null;
  moveDown: MoveAction;
  duplicate: DuplicateAction;
  remove: RemoveAction;
};

/**
 * Derives all toolbar dispatch actions for the selected block from the public
 * `appState.ui.itemSelector`. Returns null when no block is selected.
 */
export function selectedBlockActions(
  itemSelector: { index: number; zone?: string } | null,
  rootContentLength: number,
): BlockActions | null {
  if (!itemSelector) return null;

  const sourceZone = itemSelector.zone ?? ROOT_ZONE;
  const moveOut: MoveAction | null = sourceZone !== ROOT_ZONE
    ? { type: "move", sourceIndex: itemSelector.index, sourceZone, destinationZone: ROOT_ZONE, destinationIndex: rootContentLength }
    : null;

  const sourceIndex = itemSelector.index;

  const moveUp: MoveAction | null = sourceIndex > 0
    ? { type: "move", sourceIndex, sourceZone, destinationZone: sourceZone, destinationIndex: sourceIndex - 1 }
    : null;

  return {
    moveOut,
    moveUp,
    moveDown: { type: "move", sourceIndex, sourceZone, destinationZone: sourceZone, destinationIndex: sourceIndex + 1 },
    duplicate: { type: "duplicate", sourceIndex, sourceZone },
    remove: { type: "remove", index: sourceIndex, zone: sourceZone },
  };
}

// ---------------------------------------------------------------------------
// Legacy helper — uses internal Puck `indexes` (not public appState).
// ---------------------------------------------------------------------------

type Indexes = {
  nodes: Record<string, { zone: string }>;
  zones: Record<string, { contentIds: string[] }>;
};

/**
 * @deprecated Use `selectedBlockActions` instead.
 */
export function moveBlockToRootAction(
  indexes: Indexes,
  itemId: string,
): MoveAction | null {
  const node = indexes.nodes[itemId];
  if (!node) return null;

  const sourceZone = node.zone;
  if (sourceZone === ROOT_ZONE) return null;

  const sourceZoneData = indexes.zones[sourceZone];
  if (!sourceZoneData) return null;

  const sourceIndex = sourceZoneData.contentIds.indexOf(itemId);
  if (sourceIndex < 0) return null;

  const rootZoneData = indexes.zones[ROOT_ZONE];
  const destinationIndex = rootZoneData ? rootZoneData.contentIds.length : 0;

  return {
    type: "move",
    sourceZone,
    sourceIndex,
    destinationZone: ROOT_ZONE,
    destinationIndex,
  };
}
