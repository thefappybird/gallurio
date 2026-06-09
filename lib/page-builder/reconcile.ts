import "server-only";

import { Types } from "mongoose";
import { connectDB } from "@/lib/db/mongoose";
import { GalleryItem } from "@/lib/db/models/GalleryItem";
import type { PuckData, PuckBlockEntry } from "@/lib/page-builder/types";

/** Block types whose `images[]` cache is reconciled against live GalleryItems. */
const GALLERY_BLOCK_TYPES = new Set(["GalleryGrid", "GalleryMasonry", "GalleryCarousel"]);

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

function storedImagesOf(block: PuckBlockEntry): StoredImage[] {
  const imgs = block.props?.images;
  return Array.isArray(imgs) ? (imgs as StoredImage[]) : [];
}

function validId(id: unknown): id is string {
  return typeof id === "string" && Types.ObjectId.isValid(id);
}

/**
 * Rebuilds every gallery block's `images[]` from the live GalleryItem documents.
 *
 * - ONE batched query: `GalleryItem.find({ workspaceId, _id: { $in: allIds } })`
 *   (no N+1). `workspaceId` comes from the CALLER's session — never Puck props —
 *   so foreign ids resolve to nothing and are pruned (tenant-safe).
 * - For each stored id still present: emit `{ id, publicId: cloudinaryPublicId,
 *   alt: altText || caption || "" }`. Refreshes a changed publicId/alt.
 * - Drops ids whose item no longer exists. Preserves the stored order. NEVER adds.
 * - No-op (and no DB call) when the tree has no gallery blocks.
 *
 * Pure transform over the fetched map — returns a NEW data object; does not mutate
 * the input.
 */
export async function reconcileGalleryImages(workspaceId: string, data: PuckData): Promise<PuckData> {
  if (!workspaceId || !data) return data;

  const arrays = blockArrays(data);

  // 1. Collect every gallery block's image ids across all blocks + zones.
  const allIds = new Set<string>();
  let hasGalleryBlock = false;
  for (const arr of arrays) {
    for (const block of arr) {
      if (!GALLERY_BLOCK_TYPES.has(block.type)) continue;
      hasGalleryBlock = true;
      for (const img of storedImagesOf(block)) {
        if (validId(img.id)) allIds.add(img.id);
      }
    }
  }
  if (!hasGalleryBlock) return data;

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

  // 3. Rebuild each gallery block's images[], preserving order, pruning misses.
  const rebuildBlock = (block: PuckBlockEntry): PuckBlockEntry => {
    if (!GALLERY_BLOCK_TYPES.has(block.type)) return block;
    const next: Array<{ id: string; publicId: string; alt: string }> = [];
    for (const img of storedImagesOf(block)) {
      if (!validId(img.id)) continue;
      const live = map.get(img.id);
      if (!live) continue; // pruned (missing or foreign workspace)
      next.push({ id: img.id, publicId: live.publicId, alt: live.alt });
    }
    return { ...block, props: { ...block.props, images: next } };
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
