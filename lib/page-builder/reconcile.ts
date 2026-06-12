import "server-only";

import { Types } from "mongoose";
import { connectDB } from "@/lib/db/mongoose";
import { GalleryItem } from "@/lib/db/models/GalleryItem";
import { GalleryCollection } from "@/lib/db/models/GalleryCollection";
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

/** All block arrays in a Puck data tree: root content + every zone/slot array. */
function blockArrays(data: PuckData): PuckBlockEntry[][] {
  const arrays: PuckBlockEntry[][] = [];
  if (Array.isArray(data.content)) arrays.push(data.content);
  if (data.zones) {
    for (const key of Object.keys(data.zones)) {
      const arr = data.zones[key];
      if (Array.isArray(arr)) arrays.push(arr);
    }
  }
  return arrays;
}

function storedImagesAt(block: PuckBlockEntry, key: string): StoredImage[] {
  const imgs = block.props?.[key];
  return Array.isArray(imgs) ? (imgs as StoredImage[]) : [];
}

function validId(id: unknown): id is string {
  return typeof id === "string" && Types.ObjectId.isValid(id);
}

/**
 * Rebuilds every gallery block's `images[]` and every Container/preset block's
 * `backgroundImages[]` from the live GalleryItem documents.
 *
 * - ONE batched query: `GalleryItem.find({ workspaceId, _id: { $in: allIds } })`
 *   (no N+1). `workspaceId` comes from the CALLER's session — never Puck props —
 *   so foreign ids resolve to nothing and are pruned (tenant-safe).
 * - For each stored id still present: emit `{ id, publicId: cloudinaryPublicId,
 *   alt: altText || caption || "" }`. Refreshes a changed publicId/alt.
 * - Drops ids whose item no longer exists. Preserves the stored order. NEVER adds.
 * - No-op (and no DB call) when the tree has no gallery or background-image blocks.
 *
 * Pure transform over the fetched map — returns a NEW data object; does not mutate
 * the input.
 */
export async function reconcileGalleryImages(workspaceId: string, data: PuckData): Promise<PuckData> {
  if (!workspaceId || !data) return data;

  const arrays = blockArrays(data);

  // 1. Collect every reconciled image id across all blocks + zones (images + backgroundImages).
  const allIds = new Set<string>();
  let hasImageBlock = false;
  for (const arr of arrays) {
    for (const block of arr) {
      const keys = imageKeysOf(block.type);
      if (keys.length === 0) continue;
      hasImageBlock = true;
      for (const key of keys) {
        for (const img of storedImagesAt(block, key)) {
          if (validId(img.id)) allIds.add(img.id);
        }
      }
    }
  }
  if (!hasImageBlock) return data;

  // 2. ONE batched, tenant-scoped query.
  const map = new Map<string, { publicId: string; alt: string }>();
  if (allIds.size > 0) {
    await connectDB();
    const docs = (await GalleryItem.find({ workspaceId, _id: { $in: [...allIds] } })
      .select({ cloudinaryPublicId: 1, altText: 1, caption: 1 })
      .lean()) as Array<{ _id: unknown; cloudinaryPublicId?: string; altText?: string; caption?: string }>;
    for (const d of docs) {
      map.set(String(d._id), {
        publicId: d.cloudinaryPublicId ?? "",
        alt: d.altText || d.caption || "",
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

  const nextData: PuckData = {
    ...data,
    content: data.content.map(rebuildBlock),
  };

  if (data.zones) {
    const nextZones: Record<string, PuckBlockEntry[]> = {};
    for (const key of Object.keys(data.zones)) {
      nextZones[key] = Array.isArray(data.zones[key])
        ? data.zones[key].map(rebuildBlock)
        : data.zones[key];
    }
    nextData.zones = nextZones;
  }

  return nextData;
}

type StoredCollection = { id?: unknown; name?: unknown; coverPublicId?: unknown; itemCount?: unknown };

/**
 * Rebuilds every FeaturedWork block's `collections[]` cache (name, coverPublicId,
 * itemCount) from the live GalleryCollection + GalleryItem documents.
 *
 * - No-op (no DB call) when the tree has no FeaturedWork blocks.
 * - ONE batched `GalleryCollection.find` scoped by workspaceId (tenant-safe).
 * - Batched aggregates for item counts and cover resolution — no N+1.
 * - Prunes ids not in the result map (missing or foreign workspace). Preserves
 *   stored order. NEVER adds. Returns a NEW data object; does not mutate input.
 * - itemCount = 0 for private collections (isPublic === false).
 * - coverPublicId: coverItemId's cloudinaryPublicId → newest item's → "".
 */
export async function reconcileFeaturedCollections(workspaceId: string, data: PuckData): Promise<PuckData> {
  if (!workspaceId || !data) return data;

  const arrays = blockArrays(data);

  // 1. Collect all distinct collection ids from every FeaturedWork block.
  const allIds = new Set<string>();
  let hasFeaturedWork = false;
  for (const arr of arrays) {
    for (const block of arr) {
      if (block.type !== "FeaturedWork") continue;
      hasFeaturedWork = true;
      const cols = block.props?.collections;
      if (!Array.isArray(cols)) continue;
      for (const col of cols as StoredCollection[]) {
        if (validId(col.id)) allIds.add(col.id as string);
      }
    }
  }
  if (!hasFeaturedWork) return data;
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
  //    a) Explicit coverItemId → resolve cloudinaryPublicId.
  const explicitCoverIds: string[] = [];
  for (const col of colMap.values()) {
    if (col.coverItemId) explicitCoverIds.push(col.coverItemId);
  }
  const explicitCoverMap = new Map<string, string>();
  if (explicitCoverIds.length > 0) {
    const coverDocs = (await GalleryItem.find({ workspaceId, _id: { $in: explicitCoverIds } })
      .select({ cloudinaryPublicId: 1 })
      .lean()) as Array<{ _id: unknown; cloudinaryPublicId?: string }>;
    for (const d of coverDocs) {
      explicitCoverMap.set(String(d._id), d.cloudinaryPublicId ?? "");
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
      { $group: { _id: "$collectionId", pid: { $first: "$cloudinaryPublicId" } } },
    ])) as Array<{ _id: unknown; pid?: string }>;
    for (const r of newestResults) {
      newestCoverMap.set(String(r._id), r.pid ?? "");
    }
  }

  // 5. Rebuild each FeaturedWork block's collections[], preserving order, pruning misses.
  const rebuildFWBlock = (block: PuckBlockEntry): PuckBlockEntry => {
    if (block.type !== "FeaturedWork") return block;
    const stored = Array.isArray(block.props?.collections) ? (block.props.collections as StoredCollection[]) : [];
    const next: Array<{ id: string; name: string; coverPublicId: string; itemCount: number }> = [];
    for (const entry of stored) {
      if (!validId(entry.id)) continue;
      const id = entry.id as string;
      const col = colMap.get(id);
      if (!col) continue; // pruned (missing or foreign workspace)
      const explicitCover = col.coverItemId ? explicitCoverMap.get(col.coverItemId) : undefined;
      const coverPublicId = explicitCover ?? newestCoverMap.get(id) ?? "";
      const totalCount = countMap.get(id) ?? 0;
      next.push({ id, name: col.name, coverPublicId, itemCount: col.isPublic ? totalCount : 0 });
    }
    return { ...block, props: { ...block.props, collections: next } };
  };

  const nextData: PuckData = {
    ...data,
    content: data.content.map(rebuildFWBlock),
  };

  if (data.zones) {
    const nextZones: Record<string, PuckBlockEntry[]> = {};
    for (const key of Object.keys(data.zones)) {
      nextZones[key] = Array.isArray(data.zones[key])
        ? data.zones[key].map(rebuildFWBlock)
        : data.zones[key];
    }
    nextData.zones = nextZones;
  }

  return nextData;
}
