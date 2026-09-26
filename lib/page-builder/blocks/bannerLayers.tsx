/**
 * Shared background-image "banner" helpers for blocks that still support a
 * background-image banner. Photo Grid and Masonry dropped background images
 * (see docs/portfolio/navigation-block-plan.md, Workstream A) — this module
 * now serves FeaturedWork only, but stays block-agnostic so it can be reused.
 */

import Image from "next/image";
import { imageDeliveryUrl } from "@/lib/storage/imageDelivery.client";
import { cfImageLoader } from "@/lib/storage/cfImageLoader";
import type { GalleryImage } from "./GalleryGridBlock";
import type { ContainerHeight } from "./manualBlocks";
import { ContainerBackgroundSlideshow } from "./ContainerBackgroundSlideshow";

export const GALLERY_MIN_HEIGHT: Record<ContainerHeight, string | undefined> = {
  auto: undefined,
  short: "40vh",
  medium: "60vh",
  tall: "80vh",
  custom: undefined,
};

/** Resolve the CSS min-height value for a gallery-family block.
 *  When minHeight is "custom", uses minHeightValue (undefined = no constraint). */
export function resolveGalleryMinHeight(
  minHeight: ContainerHeight | undefined,
  minHeightValue?: string
): string | undefined {
  if ((minHeight ?? "auto") === "custom") return minHeightValue || undefined;
  return GALLERY_MIN_HEIGHT[minHeight ?? "auto"];
}

/** Resolve a background image public ID to a full-bleed cover URL (client-safe). */
export function bgImageUrl(publicId: string): string | null {
  return imageDeliveryUrl(publicId, { width: 2000, height: 8000, fit: "scale-down" });
}

/** Shared banner layer resolution — filters out blank/unresolvable entries. */
export function resolveBannerLayers(backgroundImages: GalleryImage[] | undefined): { id: string; src: string }[] {
  return (Array.isArray(backgroundImages) ? backgroundImages : [])
    .map((img) => ({ id: img.id, src: bgImageUrl(img.publicId) }))
    .filter((l): l is { id: string; src: string } => Boolean(l.src));
}

export function GalleryBannerLayers({
  layers,
  bgAnimation,
  bgSpeed,
  overlayAlpha,
}: {
  layers: { id: string; src: string }[];
  bgAnimation?: "crossfade" | "kenburns" | "slide";
  bgSpeed?: "slow" | "medium" | "fast";
  overlayAlpha: number;
}) {
  return (
    <>
      {overlayAlpha > 0 && (
        <div
          aria-hidden="true"
          style={{ position: "absolute", inset: 0, zIndex: 1, backgroundColor: `rgba(0,0,0,${overlayAlpha})` }}
        />
      )}
      {layers.length === 1 && (
        <Image
          src={layers[0].src}
          alt=""
          aria-hidden="true"
          loader={cfImageLoader}
          fill
          sizes="100vw"
          priority
          style={{ objectFit: "cover" }}
        />
      )}
      {layers.length >= 2 && (
        <ContainerBackgroundSlideshow
          images={layers}
          animation={bgAnimation ?? "crossfade"}
          speed={bgSpeed ?? "medium"}
        />
      )}
    </>
  );
}
