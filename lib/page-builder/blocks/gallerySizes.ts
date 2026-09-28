import type { GalleryColumns } from "@/lib/page-builder/styleToolkit";

/**
 * `sizes` attribute for a gallery tile, derived from the block's configured
 * column count. Approximates the actual container-query grid breakpoints
 * (see lib/page-builder/responsive.ts) with standard viewport-width
 * descriptors — `sizes` only needs to be a reasonable upper bound for the
 * browser's image-request selection, not pixel-exact.
 */
export function galleryImageSizes(columns: GalleryColumns): string {
  const desktopVw = Math.round(100 / columns);
  if (columns === 2) {
    return "(min-width: 768px) 50vw, 100vw";
  }
  return `(min-width: 1024px) ${desktopVw}vw, (min-width: 640px) 50vw, 100vw`;
}
