/**
 * Client-safe Cloudflare Images delivery URL builder.
 * Reads only the public account hash — no API token, no server-only import.
 */

type FitMode = "scale-down" | "contain" | "cover" | "crop" | "pad";

export function imageDeliveryUrl(
  imageId: string,
  opts: { width?: number; height?: number; fit?: FitMode } = {}
): string {
  const hash = process.env.NEXT_PUBLIC_CF_IMAGES_ACCOUNT_HASH;
  if (!hash || !imageId) return "";
  if (!opts.width && !opts.height) {
    return `https://imagedelivery.net/${hash}/${imageId}/public`;
  }
  const parts: string[] = [];
  if (opts.width) parts.push(`w=${opts.width}`);
  if (opts.height) parts.push(`h=${opts.height}`);
  if (opts.fit) parts.push(`fit=${opts.fit}`);
  parts.push("q=85", "f=auto");
  return `https://imagedelivery.net/${hash}/${imageId}/${parts.join(",")}`;
}
