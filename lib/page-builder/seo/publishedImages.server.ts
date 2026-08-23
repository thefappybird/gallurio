import "server-only";

import { Types } from "mongoose";
import { connectDB } from "@/lib/db/mongoose";
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
 */
export async function collectCollectionImages(opts: {
  workspaceId: string;
  collectionIds: string[];
  limit: number;
}): Promise<PublishedImage[]> {
  const { workspaceId, limit } = opts;
  const collectionIds = opts.collectionIds.filter((id) => Types.ObjectId.isValid(id));
  if (!workspaceId || collectionIds.length === 0) return [];

  await connectDB();
  const docs = (await GalleryItem.find({ workspaceId, collectionId: { $in: collectionIds } })
    .select({ assetId: 1, altText: 1, caption: 1 })
    .lean()) as Array<{ assetId?: string; altText?: string; caption?: string }>;

  const images: PublishedImage[] = [];
  for (const d of docs) {
    if (typeof d.assetId !== "string" || !d.assetId.trim()) continue;
    const url = imageDeliveryUrl(d.assetId);
    if (!url) continue;
    images.push({ url, alt: d.altText || d.caption || "" });
  }
  return capPublishedImages(images, limit);
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
  const blockImages = collectPublishedGalleryImages(opts.galleryData, limit);
  const collectionIds = collectFeaturedCollectionIds(opts.galleryData);
  const collectionImages =
    collectionIds.length > 0
      ? await collectCollectionImages({ workspaceId: opts.workspaceId, collectionIds, limit })
      : [];
  return capPublishedImages([...blockImages, ...collectionImages], limit);
}
