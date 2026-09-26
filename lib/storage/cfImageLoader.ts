/**
 * next/image `loader` prop for Cloudflare Images — thin wrapper over
 * `imageDeliveryUrl`. Client-safe, no server-only import (reads only the
 * public account hash env var, same as imageDelivery.client.ts).
 *
 * Same loader used on canvas/preview/public so all three surfaces request
 * the same bytes (parity — see docs/portfolio/puck-023-followups.md item 3).
 */

import { imageDeliveryUrl } from "./imageDelivery.client";

const IMAGEDELIVERY_HOST = "imagedelivery.net";

export function cfImageLoader({
  src,
  width,
  quality,
}: {
  src: string;
  width: number;
  quality?: number;
}): string {
  if (!src) return src;
  const q = quality ?? 85;

  // Bare Cloudflare image id (no scheme, no path separator) — build fresh.
  if (!src.includes("://") && !src.includes("/")) {
    return imageDeliveryUrl(src, { width }) || src;
  }

  let url: URL;
  try {
    url = new URL(src);
  } catch {
    return src;
  }
  if (url.hostname !== IMAGEDELIVERY_HOST) return src;

  // [hash, ...idSegments, variant] — the image id itself may contain slashes
  // (Cloudflare allows folder-like ids), so the variant is always the LAST
  // segment and the hash is always the FIRST; everything between is the id.
  const segments = url.pathname.split("/").filter(Boolean);
  if (segments.length < 3) return src;
  const hash = segments[0];
  const variant = segments[segments.length - 1];
  const id = segments.slice(1, -1).join("/");
  const existing = variant === "public" ? [] : variant.split(",");
  const h = existing.find((p) => p.startsWith("h="));
  const fit = existing.find((p) => p.startsWith("fit="));

  const parts: string[] = [`w=${width}`];
  if (h) parts.push(h);
  if (fit) parts.push(fit);
  parts.push(`q=${q}`, "f=auto");

  return `https://${IMAGEDELIVERY_HOST}/${hash}/${id}/${parts.join(",")}${url.search}`;
}
