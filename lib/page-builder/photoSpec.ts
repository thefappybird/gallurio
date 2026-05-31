/**
 * Shared photo validation spec for portfolio uploads.
 * Used by the gallery picker and the wizard step.
 * Pure functions — no side effects, no imports.
 */

export const PHOTO_SPEC = {
  /** Accepted MIME types. */
  acceptedTypes: ["image/jpeg", "image/png", "image/webp", "image/avif"] as const,
  /** Maximum file size in bytes (10 MB). */
  maxBytes: 10 * 1024 * 1024,
  /** Minimum dimension on the shorter side in pixels. */
  minShortSide: 600,
} as const;

export type PhotoValidationResult = { ok: true } | { ok: false; reason: PhotoRejectionReason };

export type PhotoRejectionReason =
  | "type_not_accepted"
  | "file_too_large"
  | "dimension_too_small";

/**
 * Pre-upload: validates file type and size.
 * Call this before fetching a Cloudinary signature.
 */
export function validatePhotoFile(file: File): PhotoValidationResult {
  const accepted = (PHOTO_SPEC.acceptedTypes as readonly string[]).includes(file.type);
  if (!accepted) return { ok: false, reason: "type_not_accepted" };
  if (file.size > PHOTO_SPEC.maxBytes) return { ok: false, reason: "file_too_large" };
  return { ok: true };
}

/**
 * Post-upload: validates dimensions from the Cloudinary response.
 * width and height are in pixels as returned by the API.
 */
export function validatePhotoDimensions(
  width: number | null | undefined,
  height: number | null | undefined
): PhotoValidationResult {
  // If Cloudinary didn't return dimensions, skip — not our constraint to enforce.
  if (!width || !height) return { ok: true };
  const shortSide = Math.min(width, height);
  if (shortSide < PHOTO_SPEC.minShortSide) {
    return { ok: false, reason: "dimension_too_small" };
  }
  return { ok: true };
}
