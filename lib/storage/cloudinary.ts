import { v2 as cloudinary } from "cloudinary";
import { ACCEPTED_FORMATS } from "@/lib/page-builder/photoSpec";

const cloud_name = process.env.CLOUDINARY_CLOUD_NAME;
const api_key = process.env.CLOUDINARY_API_KEY;
const api_secret = process.env.CLOUDINARY_API_SECRET;

if (!cloud_name || !api_key || !api_secret) {
  if (process.env.NODE_ENV !== "production") {
    console.warn("[cloudinary] missing CLOUDINARY_* env vars — uploads will fail");
  }
}

cloudinary.config({
  cloud_name,
  api_key,
  api_secret,
  secure: true,
});

export { cloudinary };

export type SignedUploadParams = {
  signature: string;
  timestamp: number;
  apiKey: string;
  cloudName: string;
  folder: string;
  /** Comma-separated list of formats Cloudinary will allow; included in the signature. */
  allowedFormats: string;
  uploadUrl: string;
};

export function signUpload(params: {
  folder: string;
  publicId?: string;
}): SignedUploadParams {
  const timestamp = Math.floor(Date.now() / 1000);
  const allowedFormats = ACCEPTED_FORMATS.join(",");

  // allowed_formats MUST be included in the signed params so Cloudinary
  // validates the signature and rejects uploads of other formats.
  const toSign: Record<string, string | number> = {
    allowed_formats: allowedFormats,
    folder: params.folder,
    timestamp,
  };
  if (params.publicId) toSign.public_id = params.publicId;

  const signature = cloudinary.utils.api_sign_request(toSign, api_secret!);

  return {
    signature,
    timestamp,
    apiKey: api_key!,
    cloudName: cloud_name!,
    folder: params.folder,
    allowedFormats,
    uploadUrl: `https://api.cloudinary.com/v1_1/${cloud_name}/auto/upload`,
  };
}

export function workspaceFolder(workspaceId: string, subfolder: string): string {
  const safe = subfolder.replace(/[^a-z0-9_-]/gi, "");
  return `gallurio/${workspaceId}${safe ? `/${safe}` : ""}`;
}

export function cloudinaryThumbnailUrl(
  publicId: string,
  opts: { width?: number; height?: number; crop?: "fill" | "fit" | "limit" } = {}
): string {
  if (!cloud_name) return "";
  const width = opts.width ?? 400;
  const height = opts.height ?? width;
  const crop = opts.crop ?? "fill";
  const transform = `c_${crop},w_${width},h_${height},q_auto,f_auto`;
  return `https://res.cloudinary.com/${cloud_name}/image/upload/${transform}/${publicId}`;
}

export async function destroyAsset(publicId: string): Promise<void> {
  if (!publicId) return;
  await cloudinary.uploader.destroy(publicId, { invalidate: true });
}
