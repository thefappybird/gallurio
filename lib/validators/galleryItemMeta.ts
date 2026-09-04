import { z } from "zod";

/**
 * Shared Zod fragments for the extended GalleryItem metadata fields
 * (title/date/location/client/tags/meta). Used by every write path that
 * creates or patches a GalleryItem: POST items, POST collections (starter
 * items), and PATCH items/[id]. Kept here once so the three routes can't
 * silently drift on caps/regex.
 */

// "" (unset) or a plain YYYY-MM-DD calendar date. Deliberately a string, not
// coerced to Date, so "" round-trips and no timezone shifting occurs.
export const GALLERY_DATE_RE = /^$|^\d{4}-\d{2}-\d{2}$/;

export const galleryMetaRowSchema = z.object({
  label: z.string().trim().max(120),
  value: z.string().trim().max(120),
});

export const galleryItemMetaFields = {
  title: z.string().trim().max(300).optional(),
  date: z.string().trim().regex(GALLERY_DATE_RE, "invalid_date").optional(),
  location: z.string().trim().max(300).optional(),
  client: z.string().trim().max(300).optional(),
  tags: z.array(z.string().trim().max(40)).max(20).optional(),
  meta: z.array(galleryMetaRowSchema).max(20).optional(),
} as const;
