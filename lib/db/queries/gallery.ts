/**
 * Tenant-safe gallery read helpers for the public portfolio blocks.
 *
 * Multi-tenant safety:
 * - `workspaceId` is ALWAYS supplied by the caller from server render context
 *   (never from Puck props). Every query filters by `workspaceId`.
 * - `getItemsByIds` only returns items whose `workspaceId` matches; IDs from
 *   another workspace or missing IDs are silently dropped.
 */

import { Types } from "mongoose";
import { connectDB } from "@/lib/db/mongoose";
import { GalleryItem } from "@/lib/db/models/GalleryItem";
import { GalleryCollection } from "@/lib/db/models/GalleryCollection";
import { cloudinaryThumbnailUrl } from "@/lib/storage/cloudinary";

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

// ---------------------------------------------------------------------------
// Picker data helpers (owner editor only — called by the portfolio API route)
// ---------------------------------------------------------------------------

const PICKER_ITEMS_CAP = 60;

export type PickerCollection = {
  id: string;
  name: string;
  coverUrl: string | null;
  coverPublicId: string;
  itemCount: number;
};

export type PickerItem = {
  id: string;
  /** Cloudinary public ID — used by single-image fields (Hero/CTA backgrounds). */
  publicId: string;
  thumbUrl: string;
  caption: string | null;
};

/**
 * Returns all gallery collections (with cover thumbnails) for a workspace.
 * Backed by the existing { workspaceId, order } compound index.
 */
export async function listCollectionsForPicker(workspaceId: string): Promise<PickerCollection[]> {
  if (!workspaceId) return [];

  await connectDB();

  const collections = await GalleryCollection.find({ workspaceId })
    .sort({ order: 1, _id: 1 })
    .lean();

  const collectionIds = collections.map((c) => c._id);

  // Separate collections with an explicit cover from those without.
  const withCover = collections.filter((c) => Boolean(c.coverItemId));
  const withoutCover = collections.filter((c) => !c.coverItemId);
  const withoutCoverIds = withoutCover.map((c) => c._id);

  // Batch-fetch item counts, explicit cover items, and newest-item fallbacks in parallel.
  const [countsByColId, explicitCoverMap, newestByColId] = await Promise.all([
    GalleryItem.aggregate<{ _id: Types.ObjectId; count: number }>([
      { $match: { workspaceId: new Types.ObjectId(workspaceId), collectionId: { $in: collectionIds } } },
      { $group: { _id: "$collectionId", count: { $sum: 1 } } },
    ]),
    // For each collection that has a coverItemId, fetch the cloudinaryPublicId.
    (async (): Promise<Map<string, string>> => {
      const coverIds = withCover
        .map((c) => c.coverItemId)
        .filter((id): id is Types.ObjectId => Boolean(id));
      if (coverIds.length === 0) return new Map();
      const coverItems = await GalleryItem.find({
        workspaceId,
        _id: { $in: coverIds },
      })
        .select({ cloudinaryPublicId: 1 })
        .lean();
      return new Map(coverItems.map((ci) => [String(ci._id), ci.cloudinaryPublicId as string]));
    })(),
    // For cover-less collections, fetch the newest item per collection in a single aggregate.
    (async (): Promise<Map<string, string>> => {
      if (withoutCoverIds.length === 0) return new Map();
      const rows = await GalleryItem.aggregate<{ _id: Types.ObjectId; cloudinaryPublicId: string }>([
        {
          $match: {
            workspaceId: new Types.ObjectId(workspaceId),
            collectionId: { $in: withoutCoverIds },
          },
        },
        { $sort: { createdAt: -1, _id: -1 } },
        {
          $group: {
            _id: "$collectionId",
            cloudinaryPublicId: { $first: "$cloudinaryPublicId" },
          },
        },
      ]);
      return new Map(rows.map((r) => [String(r._id), r.cloudinaryPublicId]));
    })(),
  ]);

  const countMap = new Map(countsByColId.map((r) => [String(r._id), r.count]));

  return collections.map((c) => {
    const colId = String(c._id);
    let coverPublicId: string;
    if (c.coverItemId) {
      coverPublicId = explicitCoverMap.get(String(c.coverItemId)) ?? "";
    } else {
      coverPublicId = newestByColId.get(colId) ?? "";
    }
    return {
      id: colId,
      name: c.name,
      coverUrl: coverPublicId
        ? cloudinaryThumbnailUrl(coverPublicId, { width: 240, height: 240 })
        : null,
      coverPublicId,
      itemCount: countMap.get(colId) ?? 0,
    };
  });
}

/**
 * Returns the most recent gallery items (capped) for a workspace — used by the
 * MediaPicker (single/multi-image modes). Backed by the existing
 * { workspaceId, collectionId, order } compound index (no collectionId filter =
 * workspaceId leading field scan).
 *
 * Logs a warning if items were capped so the operator can tune.
 */
export async function listItemsForPicker(workspaceId: string): Promise<PickerItem[]> {
  if (!workspaceId) return [];

  await connectDB();

  const items = await GalleryItem.find({ workspaceId })
    .sort({ createdAt: -1 })
    .limit(PICKER_ITEMS_CAP + 1)
    .select({ cloudinaryPublicId: 1, caption: 1 })
    .lean();

  if (items.length > PICKER_ITEMS_CAP) {
    console.warn(
      `[gallery:picker] workspace ${workspaceId} has more than ${PICKER_ITEMS_CAP} items — results capped`
    );
    items.splice(PICKER_ITEMS_CAP);
  }

  return items.map((it) => ({
    id: String(it._id),
    publicId: it.cloudinaryPublicId as string,
    thumbUrl: cloudinaryThumbnailUrl(it.cloudinaryPublicId as string, {
      width: 200,
      height: 200,
    }),
    caption: (it.caption as string) || null,
  }));
}

// ---------------------------------------------------------------------------
// Paginated picker feeds (owner editor only — back the MediaPicker drill-in)
// ---------------------------------------------------------------------------

const PAGE_DEFAULT = 16;
const PAGE_MAX = 50;

function clampLimit(limit: number | undefined): number {
  const n = Number.isFinite(limit) ? (limit as number) : PAGE_DEFAULT;
  return Math.min(Math.max(1, Math.trunc(n)), PAGE_MAX);
}

// Opaque cursor = base64url of "<sortValue>|<_id>". sortValue is `order` for a
// collection feed (ascending) or createdAt-ms for the "all" feed (descending).
function encodeCursor(sortValue: string | number, id: string): string {
  return Buffer.from(`${sortValue}|${id}`, "utf8").toString("base64url");
}
function decodeCursor(cursor: string): { sortValue: string; id: string } | null {
  try {
    const [sortValue, id] = Buffer.from(cursor, "base64url").toString("utf8").split("|");
    if (!sortValue || !id || !Types.ObjectId.isValid(id)) return null;
    return { sortValue, id };
  } catch {
    return null;
  }
}

function toPickerItem(it: { _id: unknown; cloudinaryPublicId?: unknown; caption?: unknown }): PickerItem {
  const publicId = (it.cloudinaryPublicId as string) ?? "";
  return {
    id: String(it._id),
    publicId,
    thumbUrl: cloudinaryThumbnailUrl(publicId, { width: 200, height: 200 }),
    caption: (it.caption as string) || null,
  };
}

/**
 * One page of a collection's items, ordered by the existing
 * { workspaceId, collectionId, order } index. Cursor pagination on (order,_id)
 * ascending. Foreign/missing collections return an empty page (tenant-safe).
 */
export async function listCollectionItemsPage(opts: {
  workspaceId: string;
  collectionId: string;
  cursor?: string | null;
  limit?: number;
}): Promise<{ items: PickerItem[]; nextCursor: string | null }> {
  const { workspaceId, collectionId } = opts;
  if (!workspaceId || !Types.ObjectId.isValid(collectionId)) return { items: [], nextCursor: null };

  const limit = clampLimit(opts.limit);
  await connectDB();

  const filter: Record<string, unknown> = { workspaceId, collectionId };
  if (opts.cursor) {
    const c = decodeCursor(opts.cursor);
    if (c) {
      const order = Number(c.sortValue);
      if (Number.isFinite(order)) {
        filter.$or = [
          { order: { $gt: order } },
          { order, _id: { $gt: new Types.ObjectId(c.id) } },
        ];
      }
    }
  }

  const docs = await GalleryItem.find(filter)
    .sort({ order: 1, _id: 1 })
    .limit(limit + 1)
    .select({ cloudinaryPublicId: 1, caption: 1, order: 1 })
    .lean();

  const hasMore = docs.length > limit;
  const page = hasMore ? docs.slice(0, limit) : docs;
  const last = page[page.length - 1];
  const nextCursor = hasMore && last ? encodeCursor(last.order as number, String(last._id)) : null;
  return { items: page.map(toPickerItem), nextCursor };
}

/**
 * One page of ALL workspace items, newest-first, paginated. Backs the virtual
 * "All photos" collection (covers standalone collectionId:null items too).
 * Cursor pagination on (createdAt,_id) descending. Backed by the
 * { workspaceId, createdAt } index (added alongside this feed).
 */
export async function listAllItemsPage(opts: {
  workspaceId: string;
  cursor?: string | null;
  limit?: number;
}): Promise<{ items: PickerItem[]; nextCursor: string | null }> {
  const { workspaceId } = opts;
  if (!workspaceId) return { items: [], nextCursor: null };

  const limit = clampLimit(opts.limit);
  await connectDB();

  const filter: Record<string, unknown> = { workspaceId };
  if (opts.cursor) {
    const c = decodeCursor(opts.cursor);
    if (c) {
      const ms = Number(c.sortValue);
      if (Number.isFinite(ms)) {
        const d = new Date(ms);
        filter.$or = [
          { createdAt: { $lt: d } },
          { createdAt: d, _id: { $lt: new Types.ObjectId(c.id) } },
        ];
      }
    }
  }

  const docs = await GalleryItem.find(filter)
    .sort({ createdAt: -1, _id: -1 })
    .limit(limit + 1)
    .select({ cloudinaryPublicId: 1, caption: 1, createdAt: 1 })
    .lean();

  const hasMore = docs.length > limit;
  const page = hasMore ? docs.slice(0, limit) : docs;
  const last = page[page.length - 1];
  const nextCursor =
    hasMore && last ? encodeCursor(new Date(last.createdAt as Date).getTime(), String(last._id)) : null;
  return { items: page.map(toPickerItem), nextCursor };
}

// ---------------------------------------------------------------------------
// Public read helpers — gated on GalleryCollection.isPublic
// ---------------------------------------------------------------------------

export type PublicCollectionImage = { id: string; publicId: string; alt: string };

/**
 * One page of a PUBLIC collection's images for the live portfolio page.
 * Gates on the collection's `isPublic` flag (tenant-scoped). Returns
 * `{ id, publicId, alt }` where alt = altText || caption || "".
 * Foreign workspace, private, or missing collection → empty page (never throws).
 */
export async function listPublicCollectionItemsPage(opts: {
  workspaceId: string;
  collectionId: string;
  cursor?: string | null;
  limit?: number;
}): Promise<{ items: PublicCollectionImage[]; nextCursor: string | null }> {
  const { workspaceId, collectionId } = opts;
  if (!workspaceId || !Types.ObjectId.isValid(collectionId)) return { items: [], nextCursor: null };

  await connectDB();

  const col = await GalleryCollection.findOne({ _id: collectionId, workspaceId, isPublic: true })
    .select({ _id: 1 })
    .lean();
  if (!col) return { items: [], nextCursor: null };

  const limit = clampLimit(opts.limit);
  const filter: Record<string, unknown> = { workspaceId, collectionId };
  if (opts.cursor) {
    const c = decodeCursor(opts.cursor);
    if (c) {
      const order = Number(c.sortValue);
      if (Number.isFinite(order)) {
        filter.$or = [
          { order: { $gt: order } },
          { order, _id: { $gt: new Types.ObjectId(c.id) } },
        ];
      }
    }
  }

  const docs = await GalleryItem.find(filter)
    .sort({ order: 1, _id: 1 })
    .limit(limit + 1)
    .select({ cloudinaryPublicId: 1, altText: 1, caption: 1, order: 1 })
    .lean();

  const hasMore = docs.length > limit;
  const page = hasMore ? docs.slice(0, limit) : docs;
  const last = page[page.length - 1];
  const nextCursor = hasMore && last ? encodeCursor(last.order as number, String(last._id)) : null;
  return {
    items: page.map((d) => ({
      id: String(d._id),
      publicId: (d.cloudinaryPublicId as string) ?? "",
      alt: (d.altText as string) || (d.caption as string) || "",
    })),
    nextCursor,
  };
}

/**
 * The newest `limit` items of one collection, newest-first — backs the
 * "Select all in collection" bulk action (owner wants the latest N). Tenant-safe;
 * foreign/missing collections return []. `limit` is clamped to the safety cap.
 */
export async function listCollectionNewest(opts: {
  workspaceId: string;
  collectionId: string;
  limit: number;
}): Promise<PickerItem[]> {
  const { workspaceId, collectionId } = opts;
  if (!workspaceId || !Types.ObjectId.isValid(collectionId)) return [];

  const limit = Math.min(Math.max(1, Math.trunc(Number.isFinite(opts.limit) ? opts.limit : 1)), PICKER_ITEMS_CAP);
  await connectDB();

  const docs = await GalleryItem.find({ workspaceId, collectionId })
    .sort({ createdAt: -1, _id: -1 })
    .limit(limit)
    .select({ cloudinaryPublicId: 1, caption: 1 })
    .lean();

  return docs.map(toPickerItem);
}
