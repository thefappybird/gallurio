/**
 * WorkOS OAuth callback route.
 *
 * Receives the authorization code from WorkOS after the user authenticates via
 * Google OAuth (or any configured social provider). Exchanges the code for a
 * session, JIT-provisions the User, processes the signed state param, then
 * redirects to the appropriate destination.
 *
 * This is a public route — no auth middleware gating.
 * Node runtime required: uses crypto + Mongoose.
 */
export const runtime = "nodejs";

import { type NextRequest, NextResponse } from "next/server";
import { getWorkOS, saveSession } from "@workos-inc/authkit-nextjs";
import { ensureUser } from "@/lib/auth/ensureUser";
import { verifyOAuthState } from "@/lib/auth/oauthState";
import type { AuthUser } from "@/lib/auth/session";
import { routing } from "@/lib/i18n/routing";

function localizedDashboard(locale: string): string {
  return locale === routing.defaultLocale ? "/dashboard" : `/${locale}/dashboard`;
}

function localizedSignIn(locale: string): string {
  return locale === routing.defaultLocale ? "/sign-in" : `/${locale}/sign-in`;
}

export async function GET(request: NextRequest): Promise<NextResponse> {
  const { searchParams, origin } = request.nextUrl;
  const code = searchParams.get("code");
  const rawState = searchParams.get("state") ?? "";

  // Verify our HMAC-signed state (ignore tampered/expired state, use defaults).
  const statePayload = verifyOAuthState(rawState);
  const locale = statePayload?.locale ?? routing.defaultLocale;
  const returnTo = statePayload?.returnTo;

  // The invite token is never placed in the OAuth state — it travels via a
  // short-lived httpOnly cookie set by the accept route before the OAuth
  // round-trip. Check for it here so we know where to send the user after auth.
  const hasInviteCookie =
    request.cookies.get("gw_invite_token")?.value != null;

  if (!code) {
    // WorkOS returned an error or the code is missing — redirect to sign-in.
    return NextResponse.redirect(new URL(localizedSignIn(locale), origin));
  }

  try {
    // Exchange the authorization code for a session.
    const workos = getWorkOS();
    const authResponse = await workos.userManagement.authenticateWithCode({
      code,
      session: {
        sealSession: true,
        cookiePassword: process.env.WORKOS_COOKIE_PASSWORD!,
      },
    });

    // Persist the sealed session cookie.
    await saveSession(authResponse, request);

    // JIT-provision or sync the User document.
    const firstName = authResponse.user.firstName ?? "";
    const lastName = authResponse.user.lastName ?? "";
    const name = [firstName, lastName].filter(Boolean).join(" ");

    const authUser: AuthUser = {
      workosUserId: authResponse.user.id,
      email: authResponse.user.email,
      name,
      avatarUrl: authResponse.user.profilePictureUrl ?? null,
    };

    await ensureUser(authUser);

    // Determine redirect destination.
    // Priority: invite cookie > returnTo > localized /dashboard
    let destination: string;
    if (hasInviteCookie) {
      // The invite token is in the httpOnly cookie; send the user back to the
      // accept route with no token in the URL — the route reads the cookie.
      destination = new URL("/invite/accept", origin).toString();
    } else if (returnTo) {
      // Validate returnTo is a local path only (prevent open redirect).
      // Second char must not be "/" or "\" — browsers normalize "/\evil.com"
      // in Location headers to protocol-relative "//evil.com".
      const fallback = new URL(localizedDashboard(locale), origin).toString();
      if (/^\/[^/\\]/.test(returnTo)) {
        const resolved = new URL(returnTo, origin);
        destination = resolved.origin === origin ? resolved.toString() : fallback;
      } else {
        destination = fallback;
      }
    } else {
      destination = new URL(localizedDashboard(locale), origin).toString();
    }

    return NextResponse.redirect(destination);
  } catch {
    // Authentication failure — redirect to localized sign-in.
    return NextResponse.redirect(new URL(localizedSignIn(locale), origin));
  }
}
