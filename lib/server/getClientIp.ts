import "server-only";

// Resolves the real visitor IP for rate-limiting / abuse control.
//
// Launch decision: Cloudflare sits in front of the origin (proxied), and the
// origin is firewalled to Cloudflare's IP ranges only. `CF-Connecting-IP` is
// set by Cloudflare itself from the raw TCP connection and cannot be spoofed
// by the client — it is checked first and is the only header trustworthy for
// abuse control once the origin is locked down this way.
//
// The X-Forwarded-For / X-Real-IP fallbacks below only matter for local/direct
// (non-Cloudflare) access — e.g. dev, or hitting the origin's IP directly if
// the firewall lapses — and are NOT safe to trust for abuse control on the
// public internet (a client can set them to anything).
export function getClientIp(headers: Headers): string {
  const cf = headers.get("cf-connecting-ip");
  if (cf) return cf.trim() || "unknown";

  const vercel = headers.get("x-vercel-forwarded-for");
  if (vercel) return vercel.split(",")[0]?.trim() || "unknown";

  const xff = headers.get("x-forwarded-for");
  if (xff) return xff.split(",")[0]?.trim() || "unknown";

  return headers.get("x-real-ip")?.trim() || "unknown";
}
