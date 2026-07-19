import type mongoose from "mongoose";

type SeedGalleryItemInput = {
  workspaceId: mongoose.Types.ObjectId;
  collectionId?: mongoose.Types.ObjectId | null;
  assetId: string;
  url: string;
  width?: number | null;
  height?: number | null;
  format?: string | null;
  sizeBytes?: number;
  caption?: string;
  altText?: string;
  order: number;
  tags?: string[];
};

/**
 * Build a gallery-item fixture that matches the Cloudflare Images schema while
 * keeping the caller in control of the demo URL source.
 */
export function buildSeedGalleryItem(input: SeedGalleryItemInput) {
  return {
    workspaceId: input.workspaceId,
    collectionId: input.collectionId ?? null,
    assetId: input.assetId,
    assetProvider: "cloudflare" as const,
    url: input.url,
    width: input.width ?? null,
    height: input.height ?? null,
    format: input.format ?? null,
    sizeBytes: input.sizeBytes ?? 0,
    caption: input.caption ?? "",
    altText: input.altText ?? "",
    order: input.order,
    tags: input.tags ?? [],
  };
}
