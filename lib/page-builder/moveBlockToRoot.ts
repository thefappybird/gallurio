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

export type ParentSelector = { index: number; zone: string };

/**
 * Extracts the parent block id from a Puck slot zone id (`${parentBlockId}:${slotName}`).
 * Returns null when the zone has no colon (malformed) — caller falls back.
 */
function parentBlockIdFromZone(zone: string): string | null {
  const lastColon = zone.lastIndexOf(":");
  if (lastColon <= 0) return null;
  return zone.slice(0, lastColon);
}

/**
 * Derives all toolbar dispatch actions for the selected block from the public
 * `appState.ui.itemSelector`. Returns null when no block is selected.
 *
 * `resolveParent` looks up the parent block's own selector (its index + the
 * zone it lives in) by parent block id — the caller supplies this from the
 * Puck store's `getSelectorForId` so this function stays pure/testable.
 */
export function selectedBlockActions(
  itemSelector: { index: number; zone?: string } | null,
  rootContentLength: number,
  resolveParent: (parentBlockId: string) => ParentSelector | null = () => null,
): BlockActions | null {
  if (!itemSelector) return null;

  const sourceZone = itemSelector.zone ?? ROOT_ZONE;

  let moveOut: MoveAction | null = null;
  if (sourceZone !== ROOT_ZONE) {
    const parentBlockId = parentBlockIdFromZone(sourceZone);
    const parentSelector = parentBlockId ? resolveParent(parentBlockId) : null;
    moveOut = parentSelector
      ? {
          type: "move",
          sourceIndex: itemSelector.index,
          sourceZone,
          destinationZone: parentSelector.zone,
          destinationIndex: parentSelector.index + 1,
        }
      // Fallback: malformed zone id or parent lookup failed — dump at the end
      // of root (old behaviour) rather than hiding the button. Findable but
      // imprecise beats a dead control.
      : {
          type: "move",
          sourceIndex: itemSelector.index,
          sourceZone,
          destinationZone: ROOT_ZONE,
          destinationIndex: rootContentLength,
        };
  }

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
