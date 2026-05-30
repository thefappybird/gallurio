/**
 * Tenant-safe gallery read helpers for the public portfolio blocks.
 *
 * Multi-tenant safety:
 * - `workspaceId` is ALWAYS supplied by the caller from server render context
 *   (never from Puck props). Every query filters by `workspaceId`.
 * - `listItemsForBlock` resolves the collection scoped to `{ _id, workspaceId,
 *   isPublic: true }` first. A private collection (`isPublic: false`) or a
 *   collection from another workspace resolves to nothing → items come back `[]`
 *   (blocks render their empty state).
 * - `getItemsByIds` only returns items whose `workspaceId` matches; IDs from
 *   another workspace or missing IDs are silently dropped.
 */

import { Types } from "mongoose";
import { connectDB } from "@/lib/db/mongoose";
import { GalleryItem } from "@/lib/db/models/GalleryItem";
import { GalleryCollection } from "@/lib/db/models/GalleryCollection";

const DEFAULT_LIMIT = 24;
const MAX_LIMIT = 100;

export type GalleryBlockItem = {
  _id: Types.ObjectId;
  cloudinaryPublicId: string;
  url: string;
  caption: string;
  altText: string;
  order: number;
  width: number | null;
  height: number | null;
};

const ITEM_PROJECTION = {
  cloudinaryPublicId: 1,
  url: 1,
  caption: 1,
  altText: 1,
  order: 1,
  width: 1,
  height: 1,
} as const;

/**
 * Returns the public gallery items for a collection, scoped to a workspace.
 *
 * Returns `[]` when: collectionId is null/blank/malformed, the collection does
 * not exist, belongs to another workspace, or is not public.
 */
export async function listItemsForBlock(opts: {
  workspaceId: string;
  collectionId: string | null;
  limit?: number;
}): Promise<GalleryBlockItem[]> {
  const { workspaceId, collectionId } = opts;
  if (!workspaceId) return [];
  if (!collectionId || !collectionId.trim()) return [];
  if (!Types.ObjectId.isValid(collectionId)) return [];

  const limit = Math.min(Math.max(1, opts.limit ?? DEFAULT_LIMIT), MAX_LIMIT);

  await connectDB();

  // Resolve the collection first so private/foreign collections render empty.
  const collection = await GalleryCollection.findOne({
    _id: collectionId,
    workspaceId,
    isPublic: true,
  })
    .select("_id")
    .lean();

  if (!collection) return [];

  const items = (await GalleryItem.find({ workspaceId, collectionId })
    .select(ITEM_PROJECTION)
    .sort({ order: 1, createdAt: 1 })
    .limit(limit)
    .lean()) as unknown as GalleryBlockItem[];

  return items;
}

/**
 * Returns gallery items by id, scoped to a workspace, preserving the order of
 * the requested `itemIds`. IDs that are malformed, missing, or belong to
 * another workspace are dropped. Caps at MAX_LIMIT.
 */
export async function getItemsByIds(opts: {
  workspaceId: string;
  itemIds: string[];
}): Promise<GalleryBlockItem[]> {
  const { workspaceId } = opts;
  if (!workspaceId) return [];

  const validIds = (opts.itemIds ?? [])
    .filter((id) => typeof id === "string" && Types.ObjectId.isValid(id))
    .slice(0, MAX_LIMIT);

  if (validIds.length === 0) return [];

  await connectDB();

  const items = (await GalleryItem.find({
    workspaceId,
    _id: { $in: validIds },
  })
    .select(ITEM_PROJECTION)
    .lean()) as unknown as GalleryBlockItem[];

  // Preserve requested order; drop any id not returned by the query.
  const byId = new Map(items.map((it) => [String(it._id), it]));
  return validIds.map((id) => byId.get(id)).filter((it): it is GalleryBlockItem => Boolean(it));
}
