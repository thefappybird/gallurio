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
import { Workspace } from "@/lib/db/models/Workspace";
import { imageDeliveryUrl } from "@/lib/storage/cloudflareImages";
import { mapBlocks } from "@/lib/page-builder/blockTree";
import type { PickerCollection, PickerItem } from "@/lib/page-builder/galleryPicker/types";
import type { PuckData, PuckBlockEntry } from "@/lib/page-builder/types";

const MAX_LIMIT = 100;

export type GalleryBlockItem = {
  _id: Types.ObjectId;
  assetId: string;
  url: string;
  caption: string;
  altText: string;
  order: number;
  width: number | null;
  height: number | null;
};

const ITEM_PROJECTION = {
  assetId: 1,
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

// These shapes are the picker API's contract, consumed by the gallery picker
// components. They used to be declared twice — here and in the picker's own
// types module — which let the two drift silently (a field added to one was
// invisible to the other). Re-export the single definition instead.
export type { PickerCollection, PickerItem };

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
    // For each collection that has a coverItemId, fetch the assetId.
    (async (): Promise<Map<string, string>> => {
      const coverIds = withCover
        .map((c) => c.coverItemId)
        .filter((id): id is Types.ObjectId => Boolean(id));
      if (coverIds.length === 0) return new Map();
      const coverItems = await GalleryItem.find({
        workspaceId,
        _id: { $in: coverIds },
      })
        .select({ assetId: 1 })
        .lean();
      return new Map(coverItems.map((ci) => [String(ci._id), ci.assetId as string]));
    })(),
    // For cover-less collections, fetch the newest item per collection in a single aggregate.
    (async (): Promise<Map<string, string>> => {
      if (withoutCoverIds.length === 0) return new Map();
      const rows = await GalleryItem.aggregate<{ _id: Types.ObjectId; assetId: string }>([
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
            assetId: { $first: "$assetId" },
          },
        },
      ]);
      return new Map(rows.map((r) => [String(r._id), r.assetId]));
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
        ? imageDeliveryUrl(coverPublicId, { width: 240, height: 240, fit: "cover" })
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
    .select({ assetId: 1, caption: 1, altText: 1 })
    .lean();

  if (items.length > PICKER_ITEMS_CAP) {
    console.warn(
      `[gallery:picker] workspace ${workspaceId} has more than ${PICKER_ITEMS_CAP} items — results capped`
    );
    items.splice(PICKER_ITEMS_CAP);
  }

  return items.map((it) => ({
    id: String(it._id),
    publicId: it.assetId as string,
    thumbUrl: imageDeliveryUrl(it.assetId as string, { width: 200, height: 200, fit: "cover" }),
    caption: (it.caption as string) || null,
    altText: (it.altText as string) || null,
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

function toPickerItem(it: {
  _id: unknown;
  assetId?: unknown;
  caption?: unknown;
  altText?: unknown;
}): PickerItem {
  const publicId = (it.assetId as string) ?? "";
  return {
    id: String(it._id),
    publicId,
    thumbUrl: imageDeliveryUrl(publicId, { width: 200, height: 200, fit: "cover" }),
    caption: (it.caption as string) || null,
    altText: (it.altText as string) || null,
  };
}

export type GalleryMetaRow = { label: string; value: string };

// Legacy docs (pre-dating these fields) miss the key entirely on a `.lean()`
// read (Mongoose only backfills schema defaults through document hydration,
// which `.lean()` skips) — every reader here falls back explicitly so no
// migration is required.
function requiredDim(n: number | null | undefined): number {
  return typeof n === "number" && Number.isFinite(n) && n > 0 ? n : 1;
}

/**
 * A collection-page item enriched with the Featured Work popup's fields
 * (alt/title/date/location/client/meta/tags/width/height) on top of the
 * existing PickerItem contract (id/publicId/thumbUrl/caption/altText) that
 * the MediaPicker's "browse into a collection" view still reads from this
 * same endpoint. Additive only — MediaPicker ignores the extra keys.
 */
type CollectionPageItem = PickerItem & {
  alt: string;
  width: number;
  height: number;
  title: string;
  date: string;
  location: string;
  client: string;
  meta: GalleryMetaRow[];
  tags: string[];
};

function toCollectionPageItem(it: {
  _id: unknown;
  assetId?: unknown;
  caption?: unknown;
  altText?: unknown;
  width?: unknown;
  height?: unknown;
  title?: unknown;
  date?: unknown;
  location?: unknown;
  client?: unknown;
  meta?: unknown;
  tags?: unknown;
}): CollectionPageItem {
  return {
    ...toPickerItem(it),
    alt: (it.altText as string) || (it.caption as string) || "",
    width: requiredDim(it.width as number | null | undefined),
    height: requiredDim(it.height as number | null | undefined),
    title: (it.title as string) ?? "",
    date: (it.date as string) ?? "",
    location: (it.location as string) ?? "",
    client: (it.client as string) ?? "",
    meta: ((it.meta as GalleryMetaRow[]) ?? []).map((m) => ({ label: m.label, value: m.value })),
    tags: (it.tags as string[]) ?? [],
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
}): Promise<{ items: CollectionPageItem[]; nextCursor: string | null; total: number }> {
  const { workspaceId, collectionId } = opts;
  if (!workspaceId || !Types.ObjectId.isValid(collectionId)) return { items: [], nextCursor: null, total: 0 };

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

  const [docs, total] = await Promise.all([
    GalleryItem.find(filter)
      .sort({ order: 1, _id: 1 })
      .limit(limit + 1)
      .select({
        assetId: 1,
        caption: 1,
        altText: 1,
        order: 1,
        width: 1,
        height: 1,
        title: 1,
        date: 1,
        location: 1,
        client: 1,
        meta: 1,
        tags: 1,
      })
      .lean(),
    GalleryItem.countDocuments({ workspaceId, collectionId }),
  ]);

  const hasMore = docs.length > limit;
  const page = hasMore ? docs.slice(0, limit) : docs;
  const last = page[page.length - 1];
  const nextCursor = hasMore && last ? encodeCursor(last.order as number, String(last._id)) : null;
  return { items: page.map(toCollectionPageItem), nextCursor, total };
}

/**
 * One page of ALL workspace items, newest-first, paginated. Backs the virtual
 * "All photos" collection (covers standalone collectionId:null items too).
 * Deduplicates by asset: each unique `assetId` appears once (copy semantics can
 * create multiple GalleryItem docs per asset). The representative is the newest
 * doc per assetId; cursor pagination is by that representative's (createdAt, _id).
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

  // Group by asset so each unique photo appears once (copy semantics can create
  // several GalleryItem docs per asset). The representative is the newest doc
  // per assetId; pagination is by that representative's (createdAt, _id).
  const pipeline: PipelineStage[] = [
    { $match: { workspaceId: new Types.ObjectId(workspaceId) } },
    { $sort: { createdAt: -1, _id: -1 } },
    {
      $group: {
        _id: "$assetId",
        docId: { $first: "$_id" },
        createdAt: { $first: "$createdAt" },
        caption: { $first: "$caption" },
        altText: { $first: "$altText" },
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
    altText?: string;
  }>(pipeline);

  const hasMore = rows.length > limit;
  const page = hasMore ? rows.slice(0, limit) : rows;
  const last = page[page.length - 1];
  const nextCursor =
    hasMore && last ? encodeCursor(new Date(last.createdAt).getTime(), String(last.docId)) : null;

  const items: PickerItem[] = page.map((r) => ({
    id: String(r.docId),
    publicId: r._id,
    thumbUrl: imageDeliveryUrl(r._id, { width: 200, height: 200, fit: "cover" }),
    caption: (r.caption as string) || null,
    altText: (r.altText as string) || null,
  }));

  return { items, nextCursor };
}

// ---------------------------------------------------------------------------
// Public read helpers — gated on GalleryCollection.isPublic
// ---------------------------------------------------------------------------

export type PublicCollectionImage = {
  id: string;
  publicId: string;
  alt: string;
  width: number;
  height: number;
  title: string;
  caption: string;
  date: string;
  location: string;
  client: string;
  meta: GalleryMetaRow[];
  tags: string[];
};

/**
 * One page of a PUBLIC collection's images for the live portfolio page.
 * Gates on the collection's `isPublic` flag (tenant-scoped). `alt` = altText
 * || caption || "" (a11y string); `caption`/`title`/`date`/`location`/
 * `client`/`meta`/`tags` pass through separately for the popup layouts.
 * `width`/`height` are always a positive number (defaulted to 1 for the rare
 * legacy item with no recorded dimensions) — a downstream row packer treats
 * them as required. Foreign workspace, private, or missing collection →
 * empty page with total 0 (never throws).
 */
export async function listPublicCollectionItemsPage(opts: {
  workspaceId: string;
  collectionId: string;
  cursor?: string | null;
  limit?: number;
}): Promise<{ items: PublicCollectionImage[]; nextCursor: string | null; total: number }> {
  const { workspaceId, collectionId } = opts;
  if (!workspaceId || !Types.ObjectId.isValid(collectionId)) return { items: [], nextCursor: null, total: 0 };

  await connectDB();

  const col = await GalleryCollection.findOne({ _id: collectionId, workspaceId, isPublic: true })
    .select({ _id: 1 })
    .lean();
  if (!col) return { items: [], nextCursor: null, total: 0 };

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

  const [docs, total] = await Promise.all([
    GalleryItem.find(filter)
      .sort({ order: 1, _id: 1 })
      .limit(limit + 1)
      .select({
        assetId: 1,
        altText: 1,
        caption: 1,
        order: 1,
        width: 1,
        height: 1,
        title: 1,
        date: 1,
        location: 1,
        client: 1,
        meta: 1,
        tags: 1,
      })
      .lean(),
    GalleryItem.countDocuments({ workspaceId, collectionId }),
  ]);

  const hasMore = docs.length > limit;
  const page = hasMore ? docs.slice(0, limit) : docs;
  const last = page[page.length - 1];
  const nextCursor = hasMore && last ? encodeCursor(last.order as number, String(last._id)) : null;
  return {
    items: page.map((d) => ({
      id: String(d._id),
      publicId: (d.assetId as string) ?? "",
      alt: (d.altText as string) || (d.caption as string) || "",
      width: requiredDim(d.width as number | null | undefined),
      height: requiredDim(d.height as number | null | undefined),
      title: (d.title as string) ?? "",
      caption: (d.caption as string) ?? "",
      date: (d.date as string) ?? "",
      location: (d.location as string) ?? "",
      client: (d.client as string) ?? "",
      meta: ((d.meta as GalleryMetaRow[]) ?? []).map((m) => ({ label: m.label, value: m.value })),
      tags: (d.tags as string[]) ?? [],
    })),
    nextCursor,
    total,
  };
}

// Safety rail (not a product limit — the picker itself has no cap, per
// product decision) for the bulk "select all in collection" fetch. A single
// request pulling an unbounded number of docs is still a DoS surface even
// though it's owner-authenticated and workspace-scoped, so it gets its own
// high ceiling instead of reusing the 60-item PICKER_ITEMS_CAP.
const BULK_SELECT_CAP = 2000;

/**
 * The newest `limit` items of one collection, newest-first — backs the
 * "Select all in collection" bulk action (owner wants the whole collection).
 * Tenant-safe; foreign/missing collections return `{ items: [], truncated: false }`.
 * `limit` is clamped to `BULK_SELECT_CAP`; a missing/non-finite/non-positive
 * `limit` is treated as "give me everything" (up to the cap), never as 1.
 * `truncated: true` means the collection has more items than the cap and the
 * caller must not treat the response as the full set.
 */
export async function listCollectionNewest(opts: {
  workspaceId: string;
  collectionId: string;
  limit: number;
}): Promise<{ items: PickerItem[]; truncated: boolean }> {
  const { workspaceId, collectionId } = opts;
  if (!workspaceId || !Types.ObjectId.isValid(collectionId)) return { items: [], truncated: false };

  const requested = Number.isFinite(opts.limit) && opts.limit > 0 ? Math.trunc(opts.limit) : BULK_SELECT_CAP;
  const limit = Math.min(requested, BULK_SELECT_CAP);
  await connectDB();

  const docs = await GalleryItem.find({ workspaceId, collectionId })
    .sort({ createdAt: -1, _id: -1 })
    .limit(limit + 1)
    .select({ assetId: 1, caption: 1, altText: 1 })
    .lean();

  // Only the safety ceiling counts as "truncated" — a caller-supplied `limit`
  // below the ceiling (e.g. a small picker's own selection cap) is an
  // intentional partial request, not silent data loss.
  const hitCeiling = limit === BULK_SELECT_CAP && docs.length > limit;
  return { items: docs.slice(0, limit).map(toPickerItem), truncated: hitCeiling };
}

/**
 * Updates a single item's `altText` and/or `caption`. Only the keys actually
 * present in `opts` are written — a request that sends only `caption` never
 * blanks an existing `altText`, and vice versa. `altText` describes what the
 * image shows (accessibility + SEO); `caption` is optional visible context.
 * They are semantically distinct — never derive `altText` from a filename.
 * Filters by `{ _id: itemId, workspaceId }` always (tenant-safe); a foreign,
 * missing, or malformed `itemId` returns `null`.
 */
export type UpdateItemMetaResult = PickerItem & {
  title: string;
  date: string;
  location: string;
  client: string;
  meta: GalleryMetaRow[];
  tags: string[];
};

export async function updateItemMeta(opts: {
  workspaceId: string;
  itemId: string;
  altText?: string;
  caption?: string;
  title?: string;
  date?: string;
  location?: string;
  client?: string;
  tags?: string[];
  meta?: GalleryMetaRow[];
}): Promise<UpdateItemMetaResult | null> {
  const { workspaceId, itemId } = opts;
  if (!workspaceId || !Types.ObjectId.isValid(itemId)) return null;

  const set: Record<string, unknown> = {};
  if (opts.altText !== undefined) set.altText = opts.altText;
  if (opts.caption !== undefined) set.caption = opts.caption;
  if (opts.title !== undefined) set.title = opts.title;
  if (opts.date !== undefined) set.date = opts.date;
  if (opts.location !== undefined) set.location = opts.location;
  if (opts.client !== undefined) set.client = opts.client;
  if (opts.tags !== undefined) set.tags = opts.tags;
  if (opts.meta !== undefined) set.meta = opts.meta;
  if (Object.keys(set).length === 0) return null;

  await connectDB();

  const doc = await GalleryItem.findOneAndUpdate(
    { _id: itemId, workspaceId },
    { $set: set },
    { new: true }
  )
    .select({ assetId: 1, caption: 1, altText: 1, title: 1, date: 1, location: 1, client: 1, meta: 1, tags: 1 })
    .lean();
  if (!doc) return null;

  return {
    ...toPickerItem(doc),
    title: (doc.title as string) ?? "",
    date: (doc.date as string) ?? "",
    location: (doc.location as string) ?? "",
    client: (doc.client as string) ?? "",
    meta: ((doc.meta as GalleryMetaRow[]) ?? []).map((m) => ({ label: m.label, value: m.value })),
    tags: (doc.tags as string[]) ?? [],
  };
}

/** Prop keys that may hold GalleryImage-shaped `{ id, alt }` entries on a block. */
const ALT_HOLDING_PROP_KEYS = ["images", "backgroundImages"] as const;

/**
 * Rewrites the `alt` on every image entry referencing `itemId` inside the
 * workspace's PUBLISHED page (`publicPage.data.home` / `.gallery`) — the
 * baked cache `reconcileGalleryImages` (lib/page-builder/reconcile.ts) writes
 * at publish time, which the live public page's `<img alt>`, its ImageObject
 * structured data, and the tenant sitemap all read directly. Without this, an
 * alt-text edit only reaches those surfaces on the next publish. Only the
 * `alt` string changes on a match — never adds, removes, or reorders images,
 * never touches layout or any other prop/block.
 *
 * `PortfolioDraft` documents are deliberately left untouched — they are
 * independent snapshots (see the portfolio-drafts skill / docs) that get
 * reconciled at publish time like the rest of the tree; propagating into a
 * draft here would blur the "drafts are independent until published" rule.
 *
 * No-op (no write) when nothing on the published page references `itemId` —
 * the common case, since most photos are never placed on the page. Tenant-
 * safe: the read and the write both filter by the caller's `workspaceId`.
 */
export async function propagateItemAltText(opts: {
  workspaceId: string;
  itemId: string;
  alt: string;
}): Promise<void> {
  const { workspaceId, itemId, alt } = opts;
  if (!workspaceId || !Types.ObjectId.isValid(workspaceId) || !Types.ObjectId.isValid(itemId)) return;

  await connectDB();

  const ws = (await Workspace.findOne({ _id: workspaceId })
    .select({ "publicPage.data.home": 1, "publicPage.data.gallery": 1 })
    .lean()) as { publicPage?: { data?: { home?: PuckData | null; gallery?: PuckData | null } } } | null;
  if (!ws?.publicPage?.data) return;

  const set: Record<string, PuckData> = {};

  for (const zone of ["home", "gallery"] as const) {
    const data = ws.publicPage.data[zone];
    if (!data) continue;

    let changed = false;
    const next = mapBlocks(data, (block) => {
      let nextProps = block.props;
      let propsChanged = false;
      for (const key of ALT_HOLDING_PROP_KEYS) {
        const arr = block.props[key];
        if (!Array.isArray(arr)) continue;
        let arrChanged = false;
        const nextArr = arr.map((entry) => {
          if (entry && typeof entry === "object" && (entry as { id?: unknown }).id === itemId) {
            if ((entry as { alt?: unknown }).alt === alt) return entry;
            arrChanged = true;
            return { ...(entry as Record<string, unknown>), alt };
          }
          return entry;
        });
        if (arrChanged) {
          if (!propsChanged) nextProps = { ...block.props };
          nextProps[key] = nextArr;
          propsChanged = true;
        }
      }
      if (!propsChanged) return block;
      changed = true;
      return { ...block, props: nextProps } as PuckBlockEntry;
    });
    if (changed) set[`publicPage.data.${zone}`] = next;
  }

  if (Object.keys(set).length === 0) return;

  await Workspace.updateOne({ _id: workspaceId }, { $set: set });
}

/** Count GalleryItem docs in a workspace that reference a given asset. */
export async function countItemsByAssetId(
  workspaceId: string,
  assetId: string
): Promise<number> {
  if (!workspaceId || !assetId) return 0;
  await connectDB();
  return GalleryItem.countDocuments({ workspaceId, assetId });
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

  // Batch refcount computation: one aggregation for all distinct assetIds in
  // the request instead of a countDocuments() per item (was N+1). For each
  // assetId, collect every GalleryItem _id (batch + external) referencing it;
  // if any id outside the batch remains, the batch's items for that asset are
  // redundant duplicates and all get deleted. If the batch is the only
  // reference, keep exactly one (dedup) and delete the rest.
  const assetIds = Array.from(new Set(items.map((it) => it.assetId)));
  const batchIdSet = new Set(items.map((it) => String(it._id)));

  const session = await mongoose.startSession();
  try {
    await session.withTransaction(async () => {
      const refGroups = await GalleryItem.aggregate<{ _id: string; ids: Types.ObjectId[] }>([
        { $match: { workspaceId: new Types.ObjectId(workspaceId), assetId: { $in: assetIds } } },
        { $group: { _id: "$assetId", ids: { $push: "$_id" } } },
      ]).session(session);

      const toDelete: Types.ObjectId[] = [];
      const toDetach: Types.ObjectId[] = [];
      for (const group of refGroups) {
        const batchIdsForAsset = group.ids.filter((id) => batchIdSet.has(String(id)));
        if (batchIdsForAsset.length === 0) continue;
        const hasExternalRef = group.ids.some((id) => !batchIdSet.has(String(id)));
        if (hasExternalRef) {
          toDelete.push(...batchIdsForAsset);
        } else {
          toDetach.push(batchIdsForAsset[0]);
          toDelete.push(...batchIdsForAsset.slice(1));
        }
      }

      if (toDelete.length > 0) {
        await GalleryItem.deleteMany({ _id: { $in: toDelete }, workspaceId }, { session });
      }
      if (toDetach.length > 0) {
        await GalleryItem.updateMany({ _id: { $in: toDetach }, workspaceId }, { $set: { collectionId: null } }, { session });
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
    .select({ assetId: 1 })
    .lean();
  const present = new Set(existing.map((e) => e.assetId as string));
  const seen = new Set<string>();
  const toCopy = sources.filter((s) => {
    const aid = s.assetId as string;
    if (present.has(aid) || seen.has(aid)) return false;
    seen.add(aid);
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
        assetId: s.assetId,
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

/** Permanently delete every doc sharing the selected items' assets; report assets to destroy. */
export async function deleteItemsByAssetId(opts: {
  workspaceId: string;
  itemIds: string[];
}): Promise<{ assetIds: string[]; deletedDocs: number }> {
  const { workspaceId, itemIds } = opts;
  if (!workspaceId) return { assetIds: [], deletedDocs: 0 };
  await connectDB();

  const ids = itemIds.filter((x) => Types.ObjectId.isValid(x));
  if (ids.length === 0) return { assetIds: [], deletedDocs: 0 };
  const selected = await GalleryItem.find({ workspaceId, _id: { $in: ids } }).select({ assetId: 1 }).lean();
  const assetIds = [...new Set(selected.map((s) => s.assetId as string))];
  if (assetIds.length === 0) return { assetIds: [], deletedDocs: 0 };

  const allDocs = await GalleryItem.find({ workspaceId, assetId: { $in: assetIds } }).select({ _id: 1 }).lean();
  const allIds = allDocs.map((d) => d._id);

  const session = await mongoose.startSession();
  let deletedDocs = 0;
  try {
    await session.withTransaction(async () => {
      const del = await GalleryItem.deleteMany({ workspaceId, _id: { $in: allIds } }, { session });
      deletedDocs = del.deletedCount ?? 0;
      await GalleryCollection.updateMany(
        { workspaceId, coverItemId: { $in: allIds } },
        { $set: { coverItemId: null } },
        { session }
      );
    });
  } finally {
    await session.endSession();
  }
  return { assetIds, deletedDocs };
}
