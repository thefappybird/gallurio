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
import { getWorkOS } from "@workos-inc/authkit-nextjs";
import { ensureUser } from "@/lib/auth/ensureUser";
import { verifyOAuthState } from "@/lib/auth/oauthState";
import { authCookieSecure } from "@/lib/auth/cookies";
import { defaultPostAuthPath } from "@/lib/auth/postAuthLanding";
import type { AuthUser } from "@/lib/auth/session";
import { routing } from "@/lib/i18n/routing";

const CSRF_COOKIE = "oauth_csrf";
// Matches @workos-inc/authkit-nextjs's session cookie name (WORKOS_COOKIE_NAME
// or the "wos-session" default) so its middleware can read what we set here.
const SESSION_COOKIE = process.env.WORKOS_COOKIE_NAME || "wos-session";
// 400 days — the max Chrome allows; the access/refresh tokens are the real
// time-limited part of the session. Mirrors authkit's getCookieOptions().
const SESSION_COOKIE_MAX_AGE = 60 * 60 * 24 * 400;

/** Gated debug logging for the OAuth callback. Enable with AUTHKIT_DEBUG=true. */
function debug(...args: unknown[]): void {
  if (process.env.AUTHKIT_DEBUG === "true") {
    console.log("[auth/callback]", ...args);
  }
}

function localizedSignIn(locale: string): string {
  return locale === routing.defaultLocale ? "/sign-in" : `/${locale}/sign-in`;
}

/**
 * Persists the sealed WorkOS session DIRECTLY on the response.
 *
 * We cannot rely on authkit's saveSession() here: it writes via the next/headers
 * cookies() store, and in a Route Handler that returns a manually-constructed
 * NextResponse those writes are NOT merged into the response — so the session
 * cookie silently never reaches the browser. Setting it on the response object
 * (the same mechanism as clearCsrfCookie) is what actually ships the cookie.
 */
function setSessionCookie(
  res: NextResponse,
  sealedSession: string,
  secure: boolean,
): NextResponse {
  res.cookies.set(SESSION_COOKIE, sealedSession, {
    httpOnly: true,
    secure,
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_COOKIE_MAX_AGE,
  });
  return res;
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

    const sealedSession = (authResponse as { sealedSession?: string })
      .sealedSession;
    if (!sealedSession) {
      // sealSession:true was requested, so this should always be present.
      throw new Error("authenticateWithCode returned no sealedSession");
    }

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

    const user = await ensureUser(authUser);
    debug("code exchanged + session sealed", {
      userId: authResponse.user.id,
    });

    // Determine redirect destination.
    // Priority: invite cookie > returnTo > role-aware default landing
    let destination: string;
    const fallback = new URL(defaultPostAuthPath(user, locale), origin).toString();
    if (hasInviteCookie) {
      // The invite token is in the httpOnly cookie; send the user back to the
      // accept route with no token in the URL — the route reads the cookie.
      destination = new URL("/invite/accept", origin).toString();
    } else if (returnTo) {
      // Validate returnTo is a local path only (prevent open redirect).
      // Second char must not be "/" or "\" — browsers normalize "/\evil.com"
      // in Location headers to protocol-relative "//evil.com".
      if (/^\/[^/\\]/.test(returnTo)) {
        const resolved = new URL(returnTo, origin);
        destination = resolved.origin === origin ? resolved.toString() : fallback;
      } else {
        destination = fallback;
      }
    } else {
      destination = fallback;
    }

    // Set the session cookie on the response itself, then clear the single-use
    // CSRF nonce cookie now that the flow completed.
    debug("redirect -> destination", { destination });
    const res = NextResponse.redirect(destination);
    setSessionCookie(res, sealedSession, secure);
    return clearCsrfCookie(res, secure);
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
