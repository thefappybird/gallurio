import "server-only";
import { headers } from "next/headers";

/**
 * Whether the current request is being served over a plaintext-HTTP origin that
 * cannot carry `Secure` cookies — i.e. localhost / 127.0.0.1 / a bare LAN IP
 * over http. This is the case that breaks `pnpm build && pnpm start` locally:
 * NODE_ENV is "production" but the origin is http, so a `Secure` cookie is
 * silently discarded by the browser and the session never persists.
 */
function isInsecureLocalHost(proto: string | null, hostname: string): boolean {
  // Behind a proxy (Vercel etc.) x-forwarded-proto is authoritative.
  if (proto) return proto.split(",")[0].trim() !== "https";
  return (
    hostname === "localhost" ||
    hostname === "127.0.0.1" ||
    hostname === "::1" ||
    hostname === "0.0.0.0"
  );
}

/**
 * Whether auth-related cookies should carry the `Secure` attribute.
 *
 * Derives the flag from the ACTUAL request (forwarded protocol, else host),
 * never from NODE_ENV. authkit-nextjs's own cookies follow the request/redirect
 * protocol the same way, so keeping this in lockstep guarantees our hand-rolled
 * session/CSRF cookies and authkit's cookies agree on `Secure`.
 *
 *   https request          -> Secure   (real deployments)
 *   http://localhost & co. -> not Secure (local prod build / HTTP dev)
 *
 * Falls back to the NEXT_PUBLIC_WORKOS_REDIRECT_URI protocol and finally to
 * NODE_ENV when no request context is available (e.g. outside a request).
 */
export async function authCookieSecure(): Promise<boolean> {
  try {
    const h = await headers();
    const proto = h.get("x-forwarded-proto");
    const hostname = (h.get("host") ?? "").split(":")[0];
    if (proto || hostname) {
      return !isInsecureLocalHost(proto, hostname);
    }
  } catch {
    // Not in a request scope — fall through to env-based defaults.
  }

  const uri = process.env.NEXT_PUBLIC_WORKOS_REDIRECT_URI;
  if (uri) {
    try {
      return new URL(uri).protocol === "https:";
    } catch {
      // Unparseable URI — fall through to the NODE_ENV default.
    }
  }
  return process.env.NODE_ENV === "production";
}
