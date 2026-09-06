import "server-only";

import { Types } from "mongoose";
import { connectDB } from "@/lib/db/mongoose";
import { GalleryItem } from "@/lib/db/models/GalleryItem";
import { GalleryCollection } from "@/lib/db/models/GalleryCollection";
import { collectBlocks, mapBlocks } from "@/lib/page-builder/blockTree";
import type { PuckData, PuckBlockEntry } from "@/lib/page-builder/types";

/** Block types whose `images[]` cache is reconciled against live GalleryItems. */
const GALLERY_BLOCK_TYPES = new Set(["GalleryGrid", "GalleryMasonry", "GalleryCarousel"]);

/** Block types whose `backgroundImages[]` cache is reconciled (Container + presets). */
const BG_BLOCK_TYPES = new Set([
  "Container",
  "HeroPreset",
  "AboutPreset",
  "ServicesPreset",
  "CtaPreset",
  "ContactPreset",
  "GalleryGridPreset",
  "GalleryMasonryPreset",
  "FeaturedWorkPreset",
]);

/** Which prop keys on a block hold a baked GalleryImage[] to reconcile. */
function imageKeysOf(type: string): string[] {
  const keys: string[] = [];
  if (GALLERY_BLOCK_TYPES.has(type)) keys.push("images");
  if (BG_BLOCK_TYPES.has(type)) keys.push("backgroundImages");
  return keys;
}

type StoredImage = { id?: unknown; publicId?: unknown; alt?: unknown };

function storedImagesAt(block: PuckBlockEntry, key: string): StoredImage[] {
  const imgs = block.props?.[key];
  return Array.isArray(imgs) ? (imgs as StoredImage[]) : [];
}

function validId(id: unknown): id is string {
  return typeof id === "string" && Types.ObjectId.isValid(id);
}

/**
 * Rebuilds every gallery block's `images[]` and every Container/preset block's
 * `backgroundImages[]` from the live GalleryItem documents. Walks the FULL
 * tree via `collectBlocks`/`mapBlocks` (root content, zones, and blocks
 * nested inside preset slot props — e.g. a GalleryGrid inside
 * GalleryGridPreset.props.content), not just the top-level arrays.
 *
 * - ONE batched query: `GalleryItem.find({ workspaceId, _id: { $in: allIds } })`
 *   (no N+1). `workspaceId` comes from the CALLER's session — never Puck props —
 *   so foreign ids resolve to nothing and are pruned (tenant-safe).
 * - For each stored id still present: emit `{ id, publicId: assetId,
 *   alt: caption || altText || "" }`. Description is the active alt source;
 *   the retired `altText` field remains only as compatibility for old items.
 * - Drops ids whose item no longer exists. Preserves the stored order. NEVER adds.
 * - No-op (and no DB call) when NO block anywhere in the tree (including
 *   nested) is a gallery or background-image block.
 *
 * Pure transform over the fetched map — returns a NEW data object; does not mutate
 * the input.
 */
export async function reconcileGalleryImages(workspaceId: string, data: PuckData): Promise<PuckData> {
  if (!workspaceId || !data) return data;

  // 1. Collect every reconciled image id across every block at every depth
  //    (root content, zones, AND blocks nested inside preset slot props —
  //    see collectBlocks) — images + backgroundImages.
  const allIds = new Set<string>();
  let hasImageBlock = false;
  for (const block of collectBlocks(data)) {
    const keys = imageKeysOf(block.type);
    if (keys.length === 0) continue;
    hasImageBlock = true;
    for (const key of keys) {
      for (const img of storedImagesAt(block, key)) {
        if (validId(img.id)) allIds.add(img.id);
      }
    }
  }
  if (!hasImageBlock) return data;

  // 2. ONE batched, tenant-scoped query.
  const map = new Map<string, { publicId: string; alt: string }>();
  if (allIds.size > 0) {
    await connectDB();
    const docs = (await GalleryItem.find({ workspaceId, _id: { $in: [...allIds] } })
      .select({ assetId: 1, altText: 1, caption: 1 })
      .lean()) as Array<{ _id: unknown; assetId?: string; altText?: string; caption?: string }>;
    for (const d of docs) {
      map.set(String(d._id), {
        publicId: d.assetId ?? "",
        alt: d.caption || d.altText || "",
      });
    }
  }

  // 3. Rebuild each block's image arrays, preserving order, pruning misses.
  const rebuildBlock = (block: PuckBlockEntry): PuckBlockEntry => {
    const keys = imageKeysOf(block.type);
    if (keys.length === 0) return block;
    const nextProps = { ...block.props } as Record<string, unknown>;
    for (const key of keys) {
      const next: Array<{ id: string; publicId: string; alt: string }> = [];
      for (const img of storedImagesAt(block, key)) {
        if (!validId(img.id)) continue;
        const live = map.get(img.id);
        if (!live) continue; // pruned (missing or foreign workspace)
        next.push({ id: img.id, publicId: live.publicId, alt: live.alt });
      }
      nextProps[key] = next;
    }
    return { ...block, props: nextProps };
  };

  // mapBlocks reaches every block at every depth (including ones nested
  // inside preset slot props), applying rebuildBlock to each; blocks with no
  // image keys pass through the SAME reference.
  return mapBlocks(data, rebuildBlock);
}

type StoredCollection = { id?: unknown; name?: unknown; coverPublicId?: unknown; itemCount?: unknown };

/**
 * Rebuilds every FeaturedWork block's `collections[]` cache (name, coverPublicId,
 * itemCount) from the live GalleryCollection + GalleryItem documents. Walks
 * the FULL tree via `collectBlocks`/`mapBlocks` — including FeaturedWork
 * blocks nested inside preset slot props, not just top-level content/zones.
 *
 * - No-op (no DB call) when NO FeaturedWork block anywhere in the tree
 *   (including nested) exists.
 * - ONE batched `GalleryCollection.find` scoped by workspaceId (tenant-safe).
 * - Batched aggregates for item counts and cover resolution — no N+1.
 * - Prunes ids not in the result map (missing or foreign workspace). Preserves
 *   stored order. NEVER adds. Returns a NEW data object; does not mutate input.
 * - itemCount = 0 for private collections (isPublic === false).
 * - coverPublicId: coverItemId's assetId → newest item's → "".
 */
export async function reconcileFeaturedCollections(workspaceId: string, data: PuckData): Promise<PuckData> {
  if (!workspaceId || !data) return data;

  // Collect references from both legacy FeaturedWork and the current
  // CollectionCard primitive. Both persist a small collection cache.
  const allIds = new Set<string>();
  let hasCollectionCard = false;
  for (const block of collectBlocks(data)) {
    if (block.type === "FeaturedWork") {
      hasCollectionCard = true;
      const cols = block.props?.collections;
      if (!Array.isArray(cols)) continue;
      for (const col of cols as StoredCollection[]) {
        if (validId(col.id)) allIds.add(col.id as string);
      }
    } else if (block.type === "CollectionCard") {
      hasCollectionCard = true;
      const col = block.props?.collection as StoredCollection | undefined;
      if (col && validId(col.id)) allIds.add(col.id as string);
    }
  }
  if (!hasCollectionCard) return data;
  if (allIds.size === 0) return data;

  await connectDB();

  const wsObjectId = new Types.ObjectId(workspaceId);
  const idArr = [...allIds];

  // 2. ONE batched, tenant-scoped collection fetch.
  const colDocs = (await GalleryCollection.find({ workspaceId, _id: { $in: idArr } })
    .select({ name: 1, coverItemId: 1, isPublic: 1 })
    .lean()) as Array<{ _id: unknown; name?: string; coverItemId?: unknown; isPublic?: boolean }>;

  // Map by string id for O(1) lookup.
  const colMap = new Map<string, { name: string; coverItemId: string | null; isPublic: boolean }>();
  for (const doc of colDocs) {
    colMap.set(String(doc._id), {
      name: doc.name ?? "",
      coverItemId: doc.coverItemId ? String(doc.coverItemId) : null,
      isPublic: doc.isPublic ?? true,
    });
  }

  // 3. Batched item count aggregate (all collections in one pass).
  const countMap = new Map<string, number>();
  if (idArr.length > 0) {
    const countResults = (await GalleryItem.aggregate([
      { $match: { workspaceId: wsObjectId, collectionId: { $in: idArr.map((id) => new Types.ObjectId(id)) } } },
      { $group: { _id: "$collectionId", count: { $sum: 1 } } },
    ])) as Array<{ _id: unknown; count: number }>;
    for (const r of countResults) {
      countMap.set(String(r._id), r.count);
    }
  }

  // 4. Batched cover resolution.
  //    a) Explicit coverItemId → resolve assetId.
  const explicitCoverIds: string[] = [];
  for (const col of colMap.values()) {
    if (col.coverItemId) explicitCoverIds.push(col.coverItemId);
  }
  const explicitCoverMap = new Map<string, string>();
  if (explicitCoverIds.length > 0) {
    const coverDocs = (await GalleryItem.find({ workspaceId, _id: { $in: explicitCoverIds } })
      .select({ assetId: 1 })
      .lean()) as Array<{ _id: unknown; assetId?: string }>;
    for (const d of coverDocs) {
      explicitCoverMap.set(String(d._id), d.assetId ?? "");
    }
  }

  //    b) Collections without coverItemId → newest item per collection.
  const coverlessIds = idArr.filter((id) => {
    const col = colMap.get(id);
    return col && !col.coverItemId;
  });
  const newestCoverMap = new Map<string, string>();
  if (coverlessIds.length > 0) {
    const newestResults = (await GalleryItem.aggregate([
      { $match: { workspaceId: wsObjectId, collectionId: { $in: coverlessIds.map((id) => new Types.ObjectId(id)) } } },
      { $sort: { createdAt: -1, _id: -1 } },
      { $group: { _id: "$collectionId", pid: { $first: "$assetId" } } },
    ])) as Array<{ _id: unknown; pid?: string }>;
    for (const r of newestResults) {
      newestCoverMap.set(String(r._id), r.pid ?? "");
    }
  }

  const rebuildReference = (entry: StoredCollection) => {
    if (!validId(entry.id)) return null;
    const id = entry.id as string;
    const col = colMap.get(id);
    if (!col) return null;
    const explicitCover = col.coverItemId ? explicitCoverMap.get(col.coverItemId) : undefined;
    const coverPublicId = explicitCover ?? newestCoverMap.get(id) ?? "";
    const totalCount = countMap.get(id) ?? 0;
    return { id, name: col.name, coverPublicId, itemCount: col.isPublic ? totalCount : 0 };
  };

  const rebuildCollectionCardBlock = (block: PuckBlockEntry): PuckBlockEntry => {
    if (block.type === "FeaturedWork") {
      const stored = Array.isArray(block.props?.collections) ? (block.props.collections as StoredCollection[]) : [];
      const collections = stored.flatMap((entry) => {
        const refreshed = rebuildReference(entry);
        return refreshed ? [refreshed] : [];
      });
      return { ...block, props: { ...block.props, collections } };
    }
    if (block.type === "CollectionCard") {
      const stored = block.props?.collection as StoredCollection | undefined;
      if (!stored) return block;
      // A deleted or foreign collection is deliberately cleared rather than
      // leaving stale tenant data in a card.
      return { ...block, props: { ...block.props, collection: rebuildReference(stored) ?? undefined } };
    }
    return block;
  };

  return mapBlocks(data, rebuildCollectionCardBlock);
}
