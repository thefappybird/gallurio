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

/** Props keys holding image records, never nested blocks — never recurse into these. */
const NON_BLOCK_ARRAY_PROPS = new Set(["images", "backgroundImages"]);

/** Recursion depth cap while walking untrusted persisted Puck JSON. */
const MAX_WALK_DEPTH = 10;

function isPuckData(data: unknown): data is PuckData {
  return (
    !!data &&
    typeof data === "object" &&
    Array.isArray((data as { content?: unknown }).content)
  );
}

function isBlockEntry(value: unknown): value is PuckBlockEntry {
  if (!value || typeof value !== "object") return false;
  const v = value as { type?: unknown; props?: unknown };
  return typeof v.type === "string" && !!v.props && typeof v.props === "object" && !Array.isArray(v.props);
}

/**
 * Every block reachable from a Puck data tree: root content, every `zones`
 * array, and recursively any prop value shaped like a nested block array
 * (Puck slot fields — `props.content` is the common one, but any prop whose
 * array holds `{ type, props }` entries counts). Also recurses one level
 * into arrays-of-arrays defensively. Guards cycles/pathological depth with a
 * visited-set + depth cap so a malformed tree can't hang or throw.
 */
function collectAllBlocks(data: PuckData): PuckBlockEntry[] {
  const out: PuckBlockEntry[] = [];
  const visitedArrays = new WeakSet<object>();
  const visitedBlocks = new WeakSet<object>();

  function walk(arr: unknown, depth: number): void {
    if (depth > MAX_WALK_DEPTH || !Array.isArray(arr) || visitedArrays.has(arr)) return;
    visitedArrays.add(arr);
    for (const item of arr) {
      if (isBlockEntry(item)) {
        if (visitedBlocks.has(item)) continue;
        visitedBlocks.add(item);
        out.push(item);
        for (const [key, value] of Object.entries(item.props)) {
          if (NON_BLOCK_ARRAY_PROPS.has(key)) continue;
          if (Array.isArray(value)) walk(value, depth + 1);
        }
      } else if (Array.isArray(item)) {
        walk(item, depth + 1);
      }
    }
  }

  walk(data.content, 0);
  if (data.zones) {
    for (const key of Object.keys(data.zones)) {
      walk(data.zones[key], 0);
    }
  }
  return out;
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
  for (const block of collectAllBlocks(data)) {
    if (!GALLERY_IMAGE_BLOCK_TYPES.has(block.type)) continue;
    const images = block.props?.images;
    if (!Array.isArray(images)) continue;
    for (const img of images as StoredImage[]) {
      const pub = toPublishedImage(img.publicId, img.alt);
      if (pub) raw.push(pub);
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
  for (const block of collectAllBlocks(data)) {
    if (block.type !== "FeaturedWork") continue;
    const cols = block.props?.collections;
    if (!Array.isArray(cols)) continue;
    for (const col of cols as StoredCollectionRef[]) {
      if (typeof col.id === "string" && col.id) ids.add(col.id);
    }
  }
  return [...ids];
}
