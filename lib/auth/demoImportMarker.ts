import "server-only";
import { cookies } from "next/headers";

/**
 * Carries the "this signup came from the Portfolio Maker demo" marker through
 * the WorkOS auth round trip and onboarding. Set client-side (document.cookie,
 * not httpOnly — the marker only steers a post-onboarding redirect, so JS
 * readability is not a security concern) when the demo's sign-up CTA is
 * clicked. sameSite=lax + path=/ survive the top-level cross-origin redirect
 * through WorkOS's hosted OAuth flow, mirroring how gw_invite_token survives
 * the same round trip (see app/api/invites/accept/route.ts).
 */
export const DEMO_IMPORT_COOKIE = "gw_demo_import";

/**
 * Read-only check — safe to call during a plain Server Component render.
 * Does NOT clear the cookie; use consumeDemoImportMarker for that.
 */
export async function hasDemoImportMarker(): Promise<boolean> {
  const jar = await cookies();
  return jar.get(DEMO_IMPORT_COOKIE)?.value === "1";
}

/**
 * Reads and clears the marker in one step. Only callable from a Server Action
 * or Route Handler — cookies().delete() throws when called during a plain
 * Server Component render.
 */
export async function consumeDemoImportMarker(): Promise<boolean> {
  const jar = await cookies();
  const present = jar.get(DEMO_IMPORT_COOKIE)?.value === "1";
  if (present) jar.delete(DEMO_IMPORT_COOKIE);
  return present;
}
