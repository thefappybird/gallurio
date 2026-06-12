/**
 * Client-safe Cloudinary delivery URL builder.
 *
 * Mirrors the server `cloudinaryThumbnailUrl` (lib/storage/cloudinary.ts) transform
 * EXACTLY (`c_${crop},w_${w},h_${h},q_auto,f_auto`) so a block rendered on the
 * server (SSR of a client component) and the same block rendered on the editor
 * canvas produce identical URLs. Reads only the PUBLIC cloud name — NO cloudinary
 * Node SDK import, NO server-only env — so it is safe in the client bundle.
 */
export function cloudinaryImageUrl(
  publicId: string,
  opts: { width: number; height?: number; crop?: "fill" | "fit" | "limit" }
): string {
  const cloud = process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME;
  if (!cloud || !publicId) return "";
  const width = opts.width;
  const height = opts.height ?? width;
  const crop = opts.crop ?? "fill";
  const transform = `c_${crop},w_${width},h_${height},q_auto,f_auto`;
  return `https://res.cloudinary.com/${cloud}/image/upload/${transform}/${publicId}`;
}
