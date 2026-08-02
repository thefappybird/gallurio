"use client";

import { imageDeliveryUrl } from "@/lib/storage/imageDelivery.client";

export type UploadedAsset = {
  assetId: string;
  url: string;
  width?: number;
  height?: number;
};

export type AssetValidationConstraints = {
  acceptedTypes: readonly string[];
  maxBytes: number;
};

export type AssetValidationError =
  | "type_not_accepted"
  | "file_too_large"
  | "dimensions_too_large"
  | "invalid_image";

type DirectUploadResponse = {
  imageId: string;
  uploadURL: string;
};

function getImageDimensions(file: File): Promise<{ width: number; height: number }> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve({ width: img.naturalWidth, height: img.naturalHeight });
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("invalid_image"));
    };
    img.src = url;
  });
}

/**
 * Validates and uploads an asset (logo, icon, etc.) directly to Cloudflare Images.
 *
 * Only type and size are checked here — correct framing/dimensions are
 * guaranteed upstream by the crop dialog (see lib/media/useImageCropper).
 *
 * Returns { error: AssetValidationError } if validation fails (caller handles UI feedback),
 * or { asset: UploadedAsset } on success.
 */
export async function uploadAsset(
  file: File,
  constraints: AssetValidationConstraints,
  opts: {
    subfolder?: string;
    delivery?: { width?: number; height?: number; fit?: "scale-down" | "contain" | "cover" | "crop" | "pad" };
  } = {},
): Promise<{ error: AssetValidationError } | { asset: UploadedAsset }> {
  if (!constraints.acceptedTypes.includes(file.type)) {
    return { error: "type_not_accepted" };
  }
  if (file.size > constraints.maxBytes) {
    return { error: "file_too_large" };
  }

  let dims: { width: number; height: number };
  try {
    dims = await getImageDimensions(file);
  } catch {
    return { error: "invalid_image" };
  }

  const directRes = await fetch("/api/images/direct-upload", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ subfolder: opts.subfolder ?? "assets" }),
  });
  if (!directRes.ok) throw new Error("direct_upload_request_failed");
  const { imageId, uploadURL } = (await directRes.json()) as DirectUploadResponse;

  const form = new FormData();
  form.append("file", file);
  const uploadRes = await fetch(uploadURL, { method: "POST", body: form });
  if (!uploadRes.ok) throw new Error("upload_failed");

  return {
    asset: {
      assetId: imageId,
      url: (opts.delivery ? imageDeliveryUrl(imageId, opts.delivery) : "") || imageDeliveryUrl(imageId),
      width: dims.width,
      height: dims.height,
    },
  };
}
