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

import { timingSafeEqual } from "crypto";
import { type NextRequest, NextResponse } from "next/server";
import { getWorkOS, saveSession } from "@workos-inc/authkit-nextjs";
import { ensureUser } from "@/lib/auth/ensureUser";
import { verifyOAuthState } from "@/lib/auth/oauthState";
import { authCookieSecure } from "@/lib/auth/cookies";
import type { AuthUser } from "@/lib/auth/session";
import { routing } from "@/lib/i18n/routing";

const CSRF_COOKIE = "oauth_csrf";

/** Gated debug logging for the OAuth callback. Enable with AUTHKIT_DEBUG=true. */
function debug(...args: unknown[]): void {
  if (process.env.AUTHKIT_DEBUG === "true") {
    console.log("[auth/callback]", ...args);
  }
}

function localizedDashboard(locale: string): string {
  return locale === routing.defaultLocale ? "/dashboard" : `/${locale}/dashboard`;
}

function localizedSignIn(locale: string): string {
  return locale === routing.defaultLocale ? "/sign-in" : `/${locale}/sign-in`;
}

/** Expires the single-use CSRF nonce cookie on the given response. */
function clearCsrfCookie(res: NextResponse, secure: boolean): NextResponse {
  res.cookies.set(CSRF_COOKIE, "", {
    httpOnly: true,
    secure,
    sameSite: "lax",
    path: "/",
    maxAge: 0,
  });
  return res;
}

/** Timing-safe equality for the state nonce vs the cookie nonce. */
function nonceMatches(a: string | undefined, b: string | undefined): boolean {
  if (!a || !b || a.length !== b.length) return false;
  return timingSafeEqual(Buffer.from(a), Buffer.from(b));
}

export async function GET(request: NextRequest): Promise<NextResponse> {
  const { searchParams, origin } = request.nextUrl;
  const code = searchParams.get("code");
  const rawState = searchParams.get("state") ?? "";

  // Verify our HMAC-signed state (ignore tampered/expired state, use defaults).
  const statePayload = verifyOAuthState(rawState);
  const locale = statePayload?.locale ?? routing.defaultLocale;
  const returnTo = statePayload?.returnTo;
  const secure = await authCookieSecure();

  // The invite token is never placed in the OAuth state — it travels via a
  // short-lived httpOnly cookie set by the accept route before the OAuth
  // round-trip. Check for it here so we know where to send the user after auth.
  const hasInviteCookie =
    request.cookies.get("gw_invite_token")?.value != null;

  debug("incoming", {
    hasCode: Boolean(code),
    stateVerified: Boolean(statePayload),
    statHasNonce: Boolean(statePayload?.nonce),
    hasCsrfCookie: Boolean(request.cookies.get(CSRF_COOKIE)?.value),
    secure,
    origin,
    error: searchParams.get("error"),
    errorDescription: searchParams.get("error_description"),
  });

  if (!code) {
    // WorkOS returned an error or the code is missing — redirect to sign-in.
    debug("redirect -> sign-in: missing code");
    return NextResponse.redirect(new URL(localizedSignIn(locale), origin));
  }

  // CSRF: the OAuth state must be bound to the browser that initiated the flow.
  // googleSignInAction set the oauth_csrf cookie and embedded the same nonce in
  // the signed state. Reject (without exchanging the code) when the nonce is
  // missing or does not match — this blocks login-CSRF / session-fixation via a
  // replayed (code, state) pair. The state itself is already integrity-checked
  // by verifyOAuthState (HMAC + TTL); the nonce adds the browser binding.
  if (!nonceMatches(request.cookies.get(CSRF_COOKIE)?.value, statePayload?.nonce)) {
    debug("redirect -> sign-in: CSRF nonce mismatch", {
      hasCsrfCookie: Boolean(request.cookies.get(CSRF_COOKIE)?.value),
      hasStateNonce: Boolean(statePayload?.nonce),
    });
    return clearCsrfCookie(
      NextResponse.redirect(new URL(localizedSignIn(locale), origin)),
      secure,
    );
  }

  try {
    // Exchange the authorization code for a session.
    const workos = getWorkOS();
    const authResponse = await workos.userManagement.authenticateWithCode({
      clientId: process.env.WORKOS_CLIENT_ID!,
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
    debug("code exchanged + session saved", {
      userId: authResponse.user.id,
      hasSealedSession: Boolean(
        (authResponse as { sealedSession?: string }).sealedSession,
      ),
    });

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

    // Single-use: clear the CSRF nonce cookie now that the flow completed.
    debug("redirect -> destination", { destination });
    return clearCsrfCookie(NextResponse.redirect(destination), secure);
  } catch (err) {
    // Authentication failure — redirect to localized sign-in.
    debug("redirect -> sign-in: exchange/ensureUser threw", {
      message: err instanceof Error ? err.message : String(err),
    });
    return clearCsrfCookie(
      NextResponse.redirect(new URL(localizedSignIn(locale), origin)),
      secure,
    );
  }
}
