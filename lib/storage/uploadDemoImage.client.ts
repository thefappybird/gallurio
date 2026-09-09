"use client";

// Demo-only sibling to uploadImage.client.ts — posts to the public, unauthenticated
// portfolio-maker-demo upload route instead of /api/images/direct-upload. Never
// used by the real (authenticated) editor.

import { PHOTO_SPEC, PORTFOLIO_PHOTO_MAX_BYTES, validatePhotoFile } from "@/lib/page-builder/photoSpec";
import { imageDeliveryUrl } from "@/lib/storage/imageDelivery.client";
import type { UploadedImage } from "@/lib/storage/uploadImage.client";
import type { UploadErrorDetail } from "@/lib/uploads/uploadError";

export type UploadDemoImageResult =
  | { ok: true; image: UploadedImage }
  | {
      ok: false;
      error: "image_cap_reached" | "rate_limited" | "upload_failed" | "invalid_file";
      detail?: UploadErrorDetail;
    };

type DirectUploadResponse = { imageId: string; uploadURL: string };

function getFileDimensions(file: File): Promise<{ width: number; height: number }> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve({ width: img.naturalWidth, height: img.naturalHeight });
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("Failed to load image dimensions"));
    };
    img.src = url;
  });
}

export async function uploadDemoImage(file: File, demoSessionId: string): Promise<UploadDemoImageResult> {
  const fileCheck = validatePhotoFile(file, PORTFOLIO_PHOTO_MAX_BYTES);
  if (!fileCheck.ok) {
    const detail: UploadErrorDetail =
      fileCheck.reason === "type_not_accepted"
        ? { code: "type_not_accepted", mimeType: file.type, acceptedTypes: PHOTO_SPEC.acceptedTypes }
        : { code: "file_too_large", actualBytes: file.size, maxBytes: PORTFOLIO_PHOTO_MAX_BYTES };
    return { ok: false, error: "invalid_file", detail };
  }

  try {
    const dims = await getFileDimensions(file);

    const directRes = await fetch("/api/portfolio-maker-demo/upload", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ demoSessionId }),
    });

    if (!directRes.ok) {
      const body = await directRes.json().catch(() => ({}));
      if (directRes.status === 429 || body.error === "rate_limited") {
        return { ok: false, error: "rate_limited" };
      }
      if (body.error === "image_cap_reached") {
        return { ok: false, error: "image_cap_reached" };
      }
      return { ok: false, error: "upload_failed" };
    }

    const { imageId, uploadURL } = (await directRes.json()) as DirectUploadResponse;

    const form = new FormData();
    form.append("file", file);
    const uploadRes = await fetch(uploadURL, { method: "POST", body: form });
    if (!uploadRes.ok) return { ok: false, error: "upload_failed" };

    return {
      ok: true,
      image: {
        assetId: imageId,
        url: imageDeliveryUrl(imageId),
        width: dims.width,
        height: dims.height,
        format: file.type.replace("image/", ""),
        sizeBytes: file.size,
      },
    };
  } catch {
    return { ok: false, error: "upload_failed" };
  }
}
