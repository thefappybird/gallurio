"use client";

// Browser-side direct upload to Cloudinary. The server never receives the bytes:
// we ask /api/uploads/sign for a signature, then POST the file straight to
// Cloudinary. Returns the fields our gallery models store.

export type UploadedImage = {
  cloudinaryPublicId: string;
  url: string;
  width?: number;
  height?: number;
  format?: string;
  sizeBytes?: number;
};

type SignResponse = {
  signature: string;
  timestamp: number;
  apiKey: string;
  cloudName: string;
  folder: string;
  uploadUrl: string;
};

export async function uploadImageToCloudinary(
  file: File,
  opts: { subfolder?: string } = {}
): Promise<UploadedImage> {
  const signRes = await fetch("/api/uploads/sign", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ subfolder: opts.subfolder ?? "portfolio" }),
  });
  if (!signRes.ok) throw new Error("sign_failed");
  const sign = (await signRes.json()) as SignResponse;

  const form = new FormData();
  form.append("file", file);
  form.append("api_key", sign.apiKey);
  form.append("timestamp", String(sign.timestamp));
  form.append("signature", sign.signature);
  form.append("folder", sign.folder);

  const uploadRes = await fetch(sign.uploadUrl, { method: "POST", body: form });
  if (!uploadRes.ok) throw new Error("upload_failed");
  const json = (await uploadRes.json()) as {
    secure_url: string;
    public_id: string;
    width?: number;
    height?: number;
    format?: string;
    bytes?: number;
  };

  return {
    cloudinaryPublicId: json.public_id,
    url: json.secure_url,
    width: json.width,
    height: json.height,
    format: json.format,
    sizeBytes: json.bytes,
  };
}
