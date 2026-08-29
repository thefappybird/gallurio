/**
 * Shared upload-error contract, used by every upload site in the app
 * (portfolio gallery, brand assets, avatars, the public demo).
 *
 * Pure, framework-agnostic — importable from client components, client-only
 * upload wrappers, and server route handlers alike. No side effects.
 *
 * The contract: a validation/upload failure is a `code` (a stable,
 * discriminated reason) plus the *actionable detail* available at the point
 * of failure (rejected MIME type, actual size vs. limit, actual dimensions
 * vs. limit, accepted-formats list). Callers translate `code` + detail into
 * copy via `uploadErrorTranslation`, which maps onto the existing
 * `app.errors.*` catalog consumed by `useActionError()` (lib/i18n/actionError.ts)
 * — no new i18n mechanism, just new codes in the same one.
 */

export type UploadErrorCode =
  | "type_not_accepted"
  | "format_not_accepted"
  | "file_too_large"
  | "dimension_too_small"
  | "invalid_image"
  | "quota_exceeded"
  | "rate_limited"
  | "auth_required"
  | "network_error"
  | "unknown";

export type UploadErrorDetail = {
  code: UploadErrorCode;
  /** Rejected MIME type (client-side type_not_accepted). */
  mimeType?: string;
  /** Rejected format string (server-side format_not_accepted). */
  format?: string;
  /** The accepted MIME types or format strings, for the "instead" hint. */
  acceptedTypes?: readonly string[];
  actualBytes?: number;
  maxBytes?: number;
  actualWidth?: number;
  actualHeight?: number;
  minShortSide?: number;
};

/**
 * Thrown by client upload wrappers for validation failures. `.message` is
 * always exactly `detail.code` (never a formatted sentence) so existing
 * `err.message === "file_too_large"`-style checks keep working unchanged;
 * `.detail` carries the actionable extras for callers that want them.
 */
export class UploadError extends Error {
  readonly detail: UploadErrorDetail;
  constructor(detail: UploadErrorDetail) {
    super(detail.code);
    this.name = "UploadError";
    this.detail = detail;
  }
}

/** Formats a byte count as a one-decimal MB string, e.g. 19267584 -> "18.4". */
export function formatMB(bytes: number | undefined): string {
  if (bytes == null) return "?";
  return (bytes / (1024 * 1024)).toFixed(1);
}

function formatAccepted(types: readonly string[] | undefined): string {
  if (!types || types.length === 0) return "";
  return types.map((t) => t.replace(/^image\//, "").toUpperCase()).join(", ");
}

/**
 * Plain-English fallback for the handful of Puck editor chrome components
 * that are deliberately unlocalized (see CreateCollectionDialog.tsx /
 * CollectionPicker.tsx). Centralizes the copy so it stays consistent with
 * the localized `app.errors.upload_*` strings without duplicating the
 * mapping logic in every call site.
 */
export function describeUploadErrorEnglish(detail: UploadErrorDetail): string {
  switch (detail.code) {
    case "type_not_accepted":
    case "format_not_accepted": {
      const type = (detail.mimeType ?? detail.format ?? "?").replace(/^image\//, "").toUpperCase();
      const accepted = formatAccepted(detail.acceptedTypes);
      return accepted ? `"${type}" isn't a supported format. Upload ${accepted} instead.` : `"${type}" isn't a supported format.`;
    }
    case "file_too_large":
      return `That file is ${formatMB(detail.actualBytes)} MB. The limit is ${formatMB(detail.maxBytes)} MB.`;
    case "dimension_too_small":
      return `That image is ${detail.actualWidth ?? "?"}×${detail.actualHeight ?? "?"}px. It needs to be at least ${detail.minShortSide ?? "?"}px on the shorter side.`;
    case "invalid_image":
      return "That file couldn't be read as an image. Try a different file.";
    case "quota_exceeded":
      return "You've reached your photo limit. Remove some photos and try again.";
    case "rate_limited":
      return "Too many uploads — wait a moment and try again.";
    case "auth_required":
      return "You're not signed in. Please sign in and try again.";
    case "network_error":
      return "Couldn't reach the server. Check your connection and try again.";
    default:
      return "Something went wrong. Please try again.";
  }
}

/**
 * Maps a rich UploadErrorDetail to the `app.errors.*` i18n code + ICU params
 * consumed by `useActionError()`. Every code that carries actionable detail
 * gets a specific `upload_*` message; codes with an existing equivalent
 * (`auth_required`, `unknown`) reuse it instead of duplicating a catalog key.
 */
export function uploadErrorTranslation(
  detail: UploadErrorDetail,
): { code: string; params?: Record<string, string | number> } {
  switch (detail.code) {
    case "type_not_accepted":
    case "format_not_accepted":
      return {
        code: "upload_type_not_accepted",
        params: {
          type: (detail.mimeType ?? detail.format ?? "?").replace(/^image\//, "").toUpperCase(),
          accepted: formatAccepted(detail.acceptedTypes),
        },
      };
    case "file_too_large":
      return {
        code: "upload_file_too_large",
        params: { actual: formatMB(detail.actualBytes), limit: formatMB(detail.maxBytes) },
      };
    case "dimension_too_small":
      return {
        code: "upload_dimension_too_small",
        params: {
          width: detail.actualWidth ?? 0,
          height: detail.actualHeight ?? 0,
          min: detail.minShortSide ?? 0,
        },
      };
    case "invalid_image":
      return { code: "upload_invalid_image" };
    case "quota_exceeded":
      return { code: "upload_quota_exceeded" };
    case "rate_limited":
      return { code: "upload_rate_limited" };
    case "auth_required":
      return { code: "not_authenticated" };
    case "network_error":
      return { code: "upload_network_error" };
    default:
      return { code: "generic" };
  }
}
