/**
 * Tenant-safe gallery read helpers for the public portfolio blocks.
 *
 * Multi-tenant safety:
 * - `workspaceId` is ALWAYS supplied by the caller from server render context
 *   (never from Puck props). Every query filters by `workspaceId`.
 * - `getItemsByIds` only returns items whose `workspaceId` matches; IDs from
 *   another workspace or missing IDs are silently dropped.
 */

import mongoose, { Types, type PipelineStage } from "mongoose";
import type { GalleryItemDoc } from "@/lib/db/models/GalleryItem";
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
 * Deduplicates by Cloudinary asset: each unique `cloudinaryPublicId` appears
 * once (copy semantics can create multiple GalleryItem docs per asset). The
 * representative is the newest doc per publicId; cursor pagination is by that
 * representative's (createdAt, _id) descending.
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

  // Group by Cloudinary asset so each unique photo appears once (copy semantics
  // can create several GalleryItem docs per asset). The representative is the
  // newest doc per publicId; pagination is by that representative's (createdAt,_id).
  const pipeline: PipelineStage[] = [
    { $match: { workspaceId: new Types.ObjectId(workspaceId) } },
    { $sort: { createdAt: -1, _id: -1 } },
    {
      $group: {
        _id: "$cloudinaryPublicId",
        docId: { $first: "$_id" },
        createdAt: { $first: "$createdAt" },
        caption: { $first: "$caption" },
      },
    },
    { $sort: { createdAt: -1, docId: -1 } },
  ];

  if (opts.cursor) {
    const c = decodeCursor(opts.cursor);
    if (c) {
      const ms = Number(c.sortValue);
      if (Number.isFinite(ms)) {
        const d = new Date(ms);
        pipeline.push({
          $match: {
            $or: [{ createdAt: { $lt: d } }, { createdAt: d, docId: { $lt: new Types.ObjectId(c.id) } }],
          },
        });
      }
    }
  }

  pipeline.push({ $limit: limit + 1 });

  const rows = await GalleryItem.aggregate<{
    _id: string;
    docId: Types.ObjectId;
    createdAt: Date;
    caption?: string;
  }>(pipeline);

  const hasMore = rows.length > limit;
  const page = hasMore ? rows.slice(0, limit) : rows;
  const last = page[page.length - 1];
  const nextCursor =
    hasMore && last ? encodeCursor(new Date(last.createdAt).getTime(), String(last.docId)) : null;

  const items: PickerItem[] = page.map((r) => ({
    id: String(r.docId),
    publicId: r._id,
    thumbUrl: cloudinaryThumbnailUrl(r._id, { width: 200, height: 200 }),
    caption: (r.caption as string) || null,
  }));

  return { items, nextCursor };
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

/** Count GalleryItem docs in a workspace that reference a Cloudinary asset. */
export async function countItemsByPublicId(
  workspaceId: string,
  cloudinaryPublicId: string
): Promise<number> {
  if (!workspaceId || !cloudinaryPublicId) return 0;
  await connectDB();
  return GalleryItem.countDocuments({ workspaceId, cloudinaryPublicId });
}

/** Detach items from a collection: delete the membership, or keep as standalone if last. */
export async function detachItemsFromCollection(opts: {
  workspaceId: string;
  collectionId: string;
  itemIds: string[];
}): Promise<number> {
  const { workspaceId, collectionId, itemIds } = opts;
  if (!workspaceId || !Types.ObjectId.isValid(collectionId)) return 0;
  await connectDB();

  const ids = itemIds.filter((x) => Types.ObjectId.isValid(x));
  if (ids.length === 0) return 0;
  const items = await GalleryItem.find({ workspaceId, collectionId, _id: { $in: ids } }).lean();
  if (items.length === 0) return 0;

  const session = await mongoose.startSession();
  try {
    await session.withTransaction(async () => {
      for (const it of items) {
        const otherRefs = await GalleryItem.countDocuments({
          workspaceId,
          cloudinaryPublicId: it.cloudinaryPublicId,
          _id: { $ne: it._id },
        }).session(session);
        if (otherRefs > 0) {
          await GalleryItem.deleteOne({ _id: it._id, workspaceId }, { session });
        } else {
          await GalleryItem.updateOne({ _id: it._id, workspaceId }, { $set: { collectionId: null } }, { session });
        }
      }
      const col = await GalleryCollection.findOne({ _id: collectionId, workspaceId })
        .select({ coverItemId: 1 })
        .session(session);
      if (col && col.coverItemId && ids.includes(String(col.coverItemId))) {
        const newest = await GalleryItem.findOne({ workspaceId, collectionId })
          .sort({ createdAt: -1, _id: -1 })
          .select({ _id: 1 })
          .session(session);
        await GalleryCollection.updateOne(
          { _id: collectionId, workspaceId },
          { $set: { coverItemId: newest ? newest._id : null } },
          { session }
        );
      }
    });
  } finally {
    await session.endSession();
  }
  // All resolved items are always processed (deleted or detached); returning the
  // count this way is retry-safe (no mutable counter inside withTransaction).
  return items.length;
}

/** Copy existing items (by id) into a collection as new docs reusing the same asset. */
export async function copyItemsIntoCollection(opts: {
  workspaceId: string;
  collectionId: string;
  sourceItemIds: string[];
}): Promise<PickerItem[]> {
  const { workspaceId, collectionId, sourceItemIds } = opts;
  if (!workspaceId || !Types.ObjectId.isValid(collectionId)) return [];
  await connectDB();

  const ids = sourceItemIds.filter((id) => Types.ObjectId.isValid(id));
  if (ids.length === 0) return [];
  const sources = await GalleryItem.find({ workspaceId, _id: { $in: ids } }).lean();
  if (sources.length === 0) return [];

  const existing = await GalleryItem.find({ workspaceId, collectionId })
    .select({ cloudinaryPublicId: 1 })
    .lean();
  const present = new Set(existing.map((e) => e.cloudinaryPublicId as string));
  const seen = new Set<string>();
  const toCopy = sources.filter((s) => {
    const pid = s.cloudinaryPublicId as string;
    if (present.has(pid) || seen.has(pid)) return false;
    seen.add(pid);
    return true;
  });
  if (toCopy.length === 0) return [];

  const base = await GalleryItem.countDocuments({ workspaceId, collectionId });

  const session = await mongoose.startSession();
  let created: GalleryItemDoc[] = [];
  try {
    await session.withTransaction(async () => {
      const docs = toCopy.map((s, i) => ({
        workspaceId,
        collectionId,
        cloudinaryPublicId: s.cloudinaryPublicId,
        url: s.url,
        width: s.width ?? null,
        height: s.height ?? null,
        format: s.format ?? null,
        sizeBytes: s.sizeBytes ?? 0,
        caption: s.caption ?? "",
        altText: s.altText ?? "",
        order: base + i,
      }));
      created = await GalleryItem.create(docs, { session, ordered: true });
      const col = await GalleryCollection.findOne({ _id: collectionId, workspaceId })
        .select({ coverItemId: 1 })
        .session(session);
      if (col && !col.coverItemId && created[0]) {
        await GalleryCollection.updateOne(
          { _id: collectionId, workspaceId },
          { $set: { coverItemId: created[0]._id } },
          { session }
        );
      }
    });
  } finally {
    await session.endSession();
  }

  return created.map(toPickerItem);
}
