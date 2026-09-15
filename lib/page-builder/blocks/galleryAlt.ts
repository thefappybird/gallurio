/**
 * Shared alt-text fallback for gallery render blocks (Grid, Masonry). An
 * owner who never set alt text should never publish `alt=""` — it's an
 * accessibility gap and (see `lib/page-builder/seo/publishedImages.ts`) it
 * silently drops the image from `ImageGallery` JSON-LD too.
 */

export function galleryAltFallback(
  fallbackTemplate: string,
  workspaceName: string | undefined,
  alt: string | undefined,
  index: number
): string {
  const trimmed = alt?.trim();
  if (trimmed) return trimmed;
  const numbered = fallbackTemplate.replace("{n}", String(index + 1));
  return workspaceName ? `${workspaceName} — ${numbered}` : numbered;
}
