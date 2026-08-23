/**
 * Pure collectors for the images published portfolio pages actually contain,
 * used to feed structured-data ImageObjects and the sitemap's <image:image>
 * extension. No server-only import here — the DB-backed collection collector
 * lives in the `.server.ts` sibling so this module stays trivially testable.
 */

import { imageDeliveryUrl } from "@/lib/storage/cloudflareImages";
import type { PuckData, PuckBlockEntry } from "@/lib/page-builder/types";

export type PublishedImage = { url: string; alt: string };

export const PUBLISHED_IMAGE_CAP = 100;

/** Gallery block types whose `images[]` are real published photos. */
const GALLERY_IMAGE_BLOCK_TYPES = new Set(["GalleryGrid", "GalleryMasonry", "GalleryCarousel"]);

type StoredImage = { publicId?: unknown; alt?: unknown };
type StoredCollectionRef = { id?: unknown };

function isPuckData(data: unknown): data is PuckData {
  return (
    !!data &&
    typeof data === "object" &&
    Array.isArray((data as { content?: unknown }).content)
  );
}

/** All block arrays in a Puck data tree: root content + every zone array. */
function blockArrays(data: PuckData): PuckBlockEntry[][] {
  const arrays: PuckBlockEntry[][] = [data.content];
  if (data.zones) {
    for (const key of Object.keys(data.zones)) {
      const arr = data.zones[key];
      if (Array.isArray(arr)) arrays.push(arr);
    }
  }
  return arrays;
}

function toPublishedImage(publicId: unknown, alt: unknown): PublishedImage | null {
  if (typeof publicId !== "string" || !publicId.trim()) return null;
  const url = imageDeliveryUrl(publicId);
  if (!url) return null;
  return { url, alt: typeof alt === "string" ? alt : "" };
}

/**
 * De-dupes by URL and truncates to `limit`, warning with the dropped count
 * so a silent truncation never masquerades as full coverage.
 */
export function capPublishedImages(
  images: PublishedImage[],
  limit: number = PUBLISHED_IMAGE_CAP
): PublishedImage[] {
  const seen = new Set<string>();
  const out: PublishedImage[] = [];
  let dropped = 0;
  for (const img of images) {
    if (seen.has(img.url)) continue;
    seen.add(img.url);
    if (out.length >= limit) {
      dropped++;
      continue;
    }
    out.push(img);
  }
  if (dropped > 0) {
    console.warn(`[publishedImages] dropped ${dropped} image(s) over the ${limit}-image cap`);
  }
  return out;
}

/**
 * Meaningful gallery-block images from published Puck data (content + every
 * zone). Decorative `backgroundImages` (Container / *Preset blocks) are
 * deliberately excluded — they carry no editorial meaning for SEO.
 */
export function collectPublishedGalleryImages(
  data: unknown,
  limit: number = PUBLISHED_IMAGE_CAP
): PublishedImage[] {
  if (!isPuckData(data)) return [];
  const raw: PublishedImage[] = [];
  for (const arr of blockArrays(data)) {
    for (const block of arr) {
      if (!GALLERY_IMAGE_BLOCK_TYPES.has(block.type)) continue;
      const images = block.props?.images;
      if (!Array.isArray(images)) continue;
      for (const img of images as StoredImage[]) {
        const pub = toPublishedImage(img.publicId, img.alt);
        if (pub) raw.push(pub);
      }
    }
  }
  return capPublishedImages(raw, limit);
}

/**
 * Collection ids referenced by FeaturedWork blocks. Their photos are only
 * fetched client-side by the collection popup, so they never appear in
 * server HTML unless resolved separately (see `collectCollectionImages` in
 * the `.server.ts` sibling).
 */
export function collectFeaturedCollectionIds(data: unknown): string[] {
  if (!isPuckData(data)) return [];
  const ids = new Set<string>();
  for (const arr of blockArrays(data)) {
    for (const block of arr) {
      if (block.type !== "FeaturedWork") continue;
      const cols = block.props?.collections;
      if (!Array.isArray(cols)) continue;
      for (const col of cols as StoredCollectionRef[]) {
        if (typeof col.id === "string" && col.id) ids.add(col.id);
      }
    }
  }
  return [...ids];
}
