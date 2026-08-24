import "server-only";

import { Types } from "mongoose";
import { connectDB } from "@/lib/db/mongoose";
import { GalleryCollection } from "@/lib/db/models/GalleryCollection";
import { GalleryItem } from "@/lib/db/models/GalleryItem";
import { imageDeliveryUrl } from "@/lib/storage/cloudflareImages";
import {
  capPublishedImages,
  collectFeaturedCollectionIds,
  collectPublishedGalleryImages,
  PUBLISHED_IMAGE_CAP,
  type PublishedImage,
} from "./publishedImages";

/**
 * Batched, tenant-scoped fetch of the cover/gallery photos for a set of
 * FeaturedWork collection ids. ONE `GalleryItem.find({ workspaceId,
 * collectionId: { $in } })` — no N+1. Ids belonging to another workspace
 * simply never match the filter, so they resolve to nothing (tenant-safe).
 *
 * Bounded at the DB: `.sort({ order: 1, _id: 1 }).limit(limit)` — a
 * collection with thousands of photos must not load them all into memory
 * just to keep the first `limit`. The `{ workspaceId, collectionId, order }`
 * index (see `GalleryItem.ts`) covers `{ workspaceId, collectionId: $in }`
 * as an equality-prefix + single-$in-field query with `order` as the sort
 * suffix — Mongo serves this as a per-collectionId index scan merged by the
 * sort key (SORT_MERGE), no in-memory sort stage. The `_id` tiebreak makes
 * truncation deterministic (stable across requests) even where `order` ties.
 * This also fixes non-deterministic truncation: which images survive the cap
 * no longer depends on Mongo's natural insertion order.
 */
export async function collectCollectionImages(opts: {
  workspaceId: string;
  collectionIds: string[];
  limit: number;
}): Promise<PublishedImage[]> {
  const { workspaceId, limit } = opts;
  const collectionIds = opts.collectionIds.filter((id) => Types.ObjectId.isValid(id));
  if (!Types.ObjectId.isValid(workspaceId) || collectionIds.length === 0) return [];

  await connectDB();

  // A published Puck snapshot can retain a collection reference after the
  // owner makes that collection private. The public popup already gates on
  // `isPublic`; the crawler surfaces must enforce the same boundary or they
  // expose private collection asset URLs through JSON-LD and image sitemaps.
  const publicCollections = await GalleryCollection.find({
    workspaceId,
    _id: { $in: collectionIds },
    isPublic: true,
  })
    .select({ _id: 1 })
    .lean<Array<{ _id: Types.ObjectId }>>();
  const publicCollectionIds = publicCollections.map((collection) => collection._id);
  if (publicCollectionIds.length === 0) return [];

  const docs = (await GalleryItem.find({ workspaceId, collectionId: { $in: publicCollectionIds } })
    .sort({ order: 1, _id: 1 })
    .limit(limit)
    .select({ assetId: 1, altText: 1, caption: 1 })
    .lean()) as Array<{ assetId?: string; altText?: string; caption?: string }>;

  const images: PublishedImage[] = [];
  for (const d of docs) {
    if (typeof d.assetId !== "string" || !d.assetId.trim()) continue;
    const url = imageDeliveryUrl(d.assetId);
    if (!url) continue;
    images.push({ url, alt: d.altText || d.caption || "" });
  }
  // The DB query is already bounded to `limit` docs — this cap only dedupes
  // by URL (copies can share an assetId). Silent: the combiner below owns
  // the single per-request truncation warning.
  return capPublishedImages(images, limit, { warn: false });
}

/**
 * Full published-image collection for a Gallery page's Puck tree: gallery-block
 * images plus (when FeaturedWork blocks reference collections) their live
 * collection photos, de-duped by URL and capped once combined. Shared by the
 * Gallery page's structured data and the tenant sitemap's <image:image> entries
 * so both surfaces stay consistent from one code path.
 */
export async function collectGalleryPublishedImages(opts: {
  workspaceId: string;
  galleryData: unknown;
  limit?: number;
}): Promise<PublishedImage[]> {
  const limit = opts.limit ?? PUBLISHED_IMAGE_CAP;
  // Both sources cap silently — this is the single per-request truncation
  // warning site, so an over-cap portfolio logs at most once per anonymous
  // hit instead of once per source.
  const blockImages = collectPublishedGalleryImages(opts.galleryData, limit, { warn: false });
  const collectionIds = collectFeaturedCollectionIds(opts.galleryData);
  const collectionImages =
    collectionIds.length > 0
      ? await collectCollectionImages({ workspaceId: opts.workspaceId, collectionIds, limit })
      : [];
  return capPublishedImages([...blockImages, ...collectionImages], limit);
}
