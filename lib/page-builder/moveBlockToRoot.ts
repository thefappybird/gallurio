/**
 * Pure helper for the "Move out" action bar button.
 *
 * Computes the Puck `move` dispatch action that relocates a nested block to the
 * page root zone, sidestepping the dnd-kit nested-zone drag-collision problem.
 *
 * Editor chrome → English-only (RELEASE-CHECKLIST §4f).
 */

export const ROOT_ZONE = "root:default-zone";

export type MoveAction = {
  type: "move";
  sourceIndex: number;
  sourceZone: string;
  destinationIndex: number;
  destinationZone: string;
};

type Indexes = {
  nodes: Record<string, { zone: string }>;
  zones: Record<string, { contentIds: string[] }>;
};

/**
 * Returns a Puck `move` action that sends `itemId` to the end of the root zone,
 * or `null` when the item is already at root, missing, or its zone data is absent.
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
