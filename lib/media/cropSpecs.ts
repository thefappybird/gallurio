import { ACCEPTED_MIME } from "@/lib/page-builder/photoSpec";

export type CropSpec = {
  /** width / height. null = no fixed ratio; the dialog locks to the image's own aspect. */
  aspect: number | null;
  /** Show a circular crop overlay (surfaces that render the result in a circle). */
  round?: boolean;
  /** Output pixel caps — the crop is downscaled to fit, never upscaled. */
  maxWidth: number;
  maxHeight: number;
  /** Validated against the INPUT file before the dialog opens. */
  maxBytes: number;
  acceptedTypes: readonly string[];
};

export const CROP_SPECS = {
  avatar: {
    aspect: 1,
    round: true,
    maxWidth: 512,
    maxHeight: 512,
    maxBytes: 10 * 1024 * 1024,
    acceptedTypes: ACCEPTED_MIME,
  },
  workspaceLogo: {
    aspect: 1,
    maxWidth: 512,
    maxHeight: 512,
    maxBytes: 250 * 1024,
    acceptedTypes: ["image/png", "image/jpeg", "image/webp", "image/svg+xml"],
  },
  siteIcon: {
    aspect: 1,
    maxWidth: 512,
    maxHeight: 512,
    maxBytes: 1024 * 1024,
    acceptedTypes: ["image/png", "image/jpeg", "image/jpg", "image/webp", "image/avif"],
  },
  headerLogo: {
    aspect: null,
    maxWidth: 1024,
    maxHeight: 512,
    maxBytes: 250 * 1024,
    acceptedTypes: ["image/png", "image/jpeg", "image/jpg", "image/webp"],
  },
  ogImage: {
    aspect: 1200 / 630,
    maxWidth: 1200,
    maxHeight: 630,
    maxBytes: 10 * 1024 * 1024,
    acceptedTypes: ACCEPTED_MIME,
  },
} as const satisfies Record<string, CropSpec>;

/**
 * Ceiling for the file actually sent to Cloudflare. A spec's `maxBytes` is a
 * validation on the file the user picked; the re-encoded crop is a different
 * artifact whose size nobody controls, so it is bounded only by this.
 */
export const UPLOAD_MAX_BYTES = 10 * 1024 * 1024;

export function aspectLabel(aspect: number): string {
  return `${Number(aspect.toFixed(2))}:1`;
}
