"use server";

import { headers } from "next/headers";
import { signOut as workosSignOut } from "@workos-inc/authkit-nextjs";
import { clearActiveWorkspace } from "./activeWorkspace";

/**
 * Best-effort absolute origin for the current request (e.g. https://app.example
 * or http://localhost:3000), used to build an absolute post-logout return URL.
 * Falls back to the configured redirect URI's origin.
 */
async function requestOrigin(): Promise<string | null> {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL;
  if (appUrl) {
    try {
      return new URL(appUrl).origin;
    } catch {
      // Fall through to the request-derived origin.
    }
  }
  try {
    const h = await headers();
    const host = h.get("host");
    if (host) {
      const proto =
        h.get("x-forwarded-proto")?.split(",")[0]?.trim() ??
        (/^(localhost|127\.0\.0\.1|\[::1\])(:\d+)?$/.test(host)
          ? "http"
          : "https");
      return `${proto}://${host}`;
    }
  } catch {
    // Not in a request scope — fall through to the env-based origin.
  }
  const uri = process.env.NEXT_PUBLIC_WORKOS_REDIRECT_URI;
  if (uri) {
    try {
      return new URL(uri).origin;
    } catch {
      // Unparseable — give up; caller falls back to a relative path.
    }
  }
  return null;
}

/**
 * Signs the current user out. Clears both the WorkOS session cookie and the
 * active-workspace cookie, then redirects to /sign-in.
 *
 * `returnTo` must be an ABSOLUTE URL: WorkOS's logout endpoint ignores relative
 * paths and falls back to the (often unconfigured) app homepage URL, which
 * surfaces as `app-homepage-url-not-found`. The absolute URL must also be listed
 * under the WorkOS dashboard's Logout redirect URIs.
 */
export async function signOutAction(): Promise<void> {
  await clearActiveWorkspace();
  const origin = await requestOrigin();
  const returnTo = origin ? `${origin}/sign-in` : "/sign-in";
  // workosSignOut() deletes the wos-session cookie and redirects — it does
  // not return to the caller.
  await workosSignOut({ returnTo });
}
