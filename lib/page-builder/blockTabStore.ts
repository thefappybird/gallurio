/**
 * Module-level store for the active Content/Design/Layout tab per block id.
 * Survives StyleToolkitField remounts (which Puck triggers on each field value
 * change) so the user's tab selection is preserved while editing the same block.
 * A different block id has no entry and defaults to "content".
 */

export type BlockTab = "content" | "design" | "layout";

const store = new Map<string, BlockTab>();

export function getBlockTab(blockId: string): BlockTab {
  return store.get(blockId) ?? "content";
}

export function setBlockTab(blockId: string, tab: BlockTab): void {
  store.set(blockId, tab);
}
