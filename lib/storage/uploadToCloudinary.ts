export type CloudinaryUploadResult = {
  secure_url: string;
  public_id: string;
  width: number;
  height: number;
  bytes: number;
  format: string;
  resource_type: string;
};

export async function uploadToCloudinary(
  file: File,
  opts: { subfolder?: string; publicId?: string } = {}
): Promise<CloudinaryUploadResult> {
  const signRes = await fetch("/api/uploads/sign", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(opts),
  });
  if (!signRes.ok) {
    throw new Error(`Failed to get upload signature (${signRes.status})`);
  }
  const sig = (await signRes.json()) as {
    signature: string;
    timestamp: number;
    apiKey: string;
    cloudName: string;
    folder: string;
    uploadUrl: string;
  };

  const form = new FormData();
  form.append("file", file);
  form.append("api_key", sig.apiKey);
  form.append("timestamp", String(sig.timestamp));
  form.append("signature", sig.signature);
  form.append("folder", sig.folder);
  if (opts.publicId) form.append("public_id", opts.publicId);

  const uploadRes = await fetch(sig.uploadUrl, { method: "POST", body: form });
  if (!uploadRes.ok) {
    const text = await uploadRes.text().catch(() => "");
    throw new Error(`Cloudinary upload failed (${uploadRes.status}): ${text}`);
  }
  return (await uploadRes.json()) as CloudinaryUploadResult;
}
