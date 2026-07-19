/**
 * Shared photo validation spec for portfolio uploads.
 * Used by the gallery picker, the wizard step, and server-side route handlers.
 * Pure functions — no side effects, no imports.
 */

export const PHOTO_SPEC = {
  /** Accepted MIME types (used in <input accept> and client pre-validation). */
  acceptedTypes: ["image/jpeg", "image/jpg", "image/png", "image/webp", "image/avif"] as const,
  /** Accepted format strings (used in server-side format validation). */
  acceptedFormats: ["jpg", "jpeg", "png", "webp", "avif"] as const,
  /** Maximum file size in bytes (10 MB). */
  maxBytes: 10 * 1024 * 1024,
  /** Minimum dimension on the shorter side in pixels. */
  minShortSide: 600,
} as const;

/**
 * Portfolio gallery uploads get a higher limit (15 MB) than the shared
 * default (10 MB, used by user/team avatar uploads via the same helpers).
 */
export const PORTFOLIO_PHOTO_MAX_BYTES = 15 * 1024 * 1024;

/** Convenience alias — the MIME list as plain strings for <input accept>. */
export const ACCEPTED_MIME = PHOTO_SPEC.acceptedTypes as readonly string[];

/** Format strings accepted by the upload API for server-side format validation. */
export const ACCEPTED_FORMATS = PHOTO_SPEC.acceptedFormats as readonly string[];

export type PhotoValidationResult = { ok: true } | { ok: false; reason: PhotoRejectionReason };

export type PhotoRejectionReason =
  | "type_not_accepted"
  | "file_too_large"
  | "dimension_too_small"
  | "format_not_accepted";

/** Pre-upload: validates file type and size. */
export function validatePhotoFile(
  file: File,
  maxBytes: number = PHOTO_SPEC.maxBytes
): PhotoValidationResult {
  const accepted = (PHOTO_SPEC.acceptedTypes as readonly string[]).includes(file.type);
  if (!accepted) return { ok: false, reason: "type_not_accepted" };
  if (file.size > maxBytes) return { ok: false, reason: "file_too_large" };
  return { ok: true };
}

/** Post-upload: validates dimensions returned by the upload API (pixels). */
export function validatePhotoDimensions(
  width: number | null | undefined,
  height: number | null | undefined
): PhotoValidationResult {
  // If dimensions are absent in the upload response, skip — not our constraint to enforce.
  if (!width || !height) return { ok: true };
  const shortSide = Math.min(width, height);
  if (shortSide < PHOTO_SPEC.minShortSide) {
    return { ok: false, reason: "dimension_too_small" };
  }
  return { ok: true };
}

/**
 * Server-side validation of photo metadata forwarded by the client to create routes.
 *
 * Checks (in order):
 *   1. format — must be in ACCEPTED_FORMATS
 *   2. sizeBytes — must be ≤ maxBytes
 *   3. dimensions — short side must be ≥ minShortSide (if both present)
 *
 * All fields are optional; missing values skip that check.
 */
export function validatePhotoMeta(
  meta: {
    format?: string | null;
    sizeBytes?: number | null;
    width?: number | null;
    height?: number | null;
  },
  maxBytes: number = PHOTO_SPEC.maxBytes
): PhotoValidationResult {
  if (
    meta.format != null &&
    !(PHOTO_SPEC.acceptedFormats as readonly string[]).includes(meta.format.toLowerCase())
  ) {
    return { ok: false, reason: "format_not_accepted" };
  }

  if (meta.sizeBytes != null && meta.sizeBytes > maxBytes) {
    return { ok: false, reason: "file_too_large" };
  }

  if (meta.width != null && meta.height != null) {
    const shortSide = Math.min(meta.width, meta.height);
    if (shortSide < PHOTO_SPEC.minShortSide) {
      return { ok: false, reason: "dimension_too_small" };
    }
  }

  return { ok: true };
}
