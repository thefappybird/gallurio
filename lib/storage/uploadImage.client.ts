"use client";

import { validatePhotoFile, validatePhotoDimensions } from "@/lib/page-builder/photoSpec";
import { imageDeliveryUrl } from "@/lib/storage/imageDelivery.client";

export type UploadedImage = {
  assetId: string;
  url: string;
  width?: number;
  height?: number;
  format?: string;
  sizeBytes?: number;
};

type DirectUploadResponse = {
  imageId: string;
  uploadURL: string;
};

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

export async function uploadImage(
  file: File,
  opts: { subfolder?: string; maxBytes?: number; validateDimensions?: boolean } = {}
): Promise<UploadedImage> {
  const fileCheck = validatePhotoFile(file, opts.maxBytes);
  if (!fileCheck.ok) throw new Error(fileCheck.reason);

  // Capture dimensions from the file before upload — CF does not return them.
  const dims = await getFileDimensions(file);
  if (opts.validateDimensions ?? true) {
    const dimCheck = validatePhotoDimensions(dims.width, dims.height);
    if (!dimCheck.ok) throw new Error(dimCheck.reason);
  }

  const directRes = await fetch("/api/images/direct-upload", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ subfolder: opts.subfolder ?? "gallery" }),
  });
  if (!directRes.ok) throw new Error("direct_upload_request_failed");
  const { imageId, uploadURL } = (await directRes.json()) as DirectUploadResponse;

  const form = new FormData();
  form.append("file", file);
  const uploadRes = await fetch(uploadURL, { method: "POST", body: form });
  if (!uploadRes.ok) throw new Error("upload_failed");

  return {
    assetId: imageId,
    url: imageDeliveryUrl(imageId),
    width: dims.width,
    height: dims.height,
    format: file.type.replace("image/", ""),
    sizeBytes: file.size,
  };
}
