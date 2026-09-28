import type { NextRequest } from "next/server";

/**
 * Browser-facing origin for a redirect/callback URL. The server can receive
 * an internal origin (e.g. localhost behind a tunnel/reverse proxy, or an
 * upstream port behind Caddy) — browser-facing redirects must use the
 * configured public application origin instead of the request's own.
 *
 * No "server-only" guard: this is consumed by proxy.ts (the app's
 * middleware), which must stay free of that import.
 */
export function publicOrigin(req: NextRequest): string {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "");
  if (appUrl) {
    try {
      return new URL(appUrl).origin;
    } catch {
      // Keep local development usable when the optional value is malformed.
    }
  }
  return req.nextUrl.origin;
}
