import { PHOTO_SPEC, type PhotoRejectionReason } from "@/lib/page-builder/photoSpec";
import type { UploadErrorDetail } from "@/lib/uploads/uploadError";

/**
 * Builds the actionable UploadErrorDetail for a photoSpec rejection reason,
 * from the raw metadata the server route already has in scope. Shared by
 * every route that calls `validatePhotoMeta` so the JSON error body always
 * carries the same fields for the same reason.
 */
export function photoCheckDetail(
  reason: PhotoRejectionReason,
  meta: { format?: string | null; sizeBytes?: number | null; width?: number | null; height?: number | null },
  maxBytes: number,
): UploadErrorDetail {
  switch (reason) {
    case "format_not_accepted":
      return { code: "format_not_accepted", format: meta.format ?? undefined, acceptedTypes: PHOTO_SPEC.acceptedFormats };
    case "file_too_large":
      return { code: "file_too_large", actualBytes: meta.sizeBytes ?? undefined, maxBytes };
    case "dimension_too_small":
      return {
        code: "dimension_too_small",
        actualWidth: meta.width ?? undefined,
        actualHeight: meta.height ?? undefined,
        minShortSide: PHOTO_SPEC.minShortSide,
      };
    default:
      return { code: "type_not_accepted", acceptedTypes: PHOTO_SPEC.acceptedFormats };
  }
}
