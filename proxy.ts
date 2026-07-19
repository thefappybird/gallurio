import { authkitMiddleware } from "@workos-inc/authkit-nextjs";
import type { NextMiddleware } from "next/server";
import { NextRequest, NextResponse } from "next/server";

// NextMiddlewareResult is the resolved return type of a NextMiddleware function.
type NextMiddlewareResult = Awaited<ReturnType<NextMiddleware>>;
import createIntlMiddleware from "next-intl/middleware";
import { routing } from "@/lib/i18n/routing";
import { LOCALE_PREFIX_RE, stripLocale } from "@/lib/auth/memberAccess";

// ---------------------------------------------------------------------------
// NOTE: Role-based redirects (non-owner to /bookings, root to role landing)
// have been REMOVED from middleware. Middleware cannot query Mongo, and
// WorkOS session claims do not carry workspace role. These redirects now live
// in:
//   - requireOrg() / ownerContext() for server-action / page access control
//   - app/[locale]/(app)/layout.tsx for the root authenticated landing redirect
// ---------------------------------------------------------------------------

const intlMiddleware = createIntlMiddleware(routing);

// Routes that never require authentication.
// Patterns use the same path-to-regexp-style that authkitMiddleware accepts.
const UNAUTHENTICATED_PATHS = [
  // Marketing / public
  "/",
  // Platform social card. Scrapers do not have an AuthKit session.
  "/opengraph-image",
  // Locale-prefixed roots ("/en", "/ar", "/fil", ...). The root is routed
  // through authkit (so the landing page can read the session and redirect
  // signed-in visitors), so authkit must see these as public — otherwise it
  // would force anonymous visitors on a locale root to sign in. Every locale is
  // listed, including the default: stripLocale() treats "/en" as a root too, and
  // next-intl normalizes the redundant default-locale prefix to "/".
  ...routing.locales.map((l) => `/${l}`),
  "/pricing",
  "/terms",
  "/privacy",
  "/refunds",
  "/contact",
  "/about",
  // Auth UI (our first-party forms)
  "/sign-in",
  "/sign-in/(.*)",
  "/sign-up",
  "/sign-up/(.*)",
  "/forgot-password",
  "/reset-password",
  "/verify-email",
  // WorkOS OAuth code-exchange callback — must be public
  "/api/auth/callback",
  // Invite acceptance landing (auth resolved inside the page/action)
  "/invite",
  "/invite/(.*)",
  "/api/invites/accept",
  // Webhooks — verified by HMAC inside the handler
  "/api/webhooks/(.*)",
  // Public inquiry submission (portfolio contact form)
  "/api/inquiries(.*)",
  // Public portfolio data + analytics endpoints resolve tenancy by org slug.
  "/api/public/(.*)",
  // External liveness/readiness probe; returns non-sensitive status only.
  "/api/health",
  // Scheduled jobs authenticate with Authorization: Bearer CRON_SECRET.
  "/api/cron/(.*)",
  // Public portfolio pages live outside the [locale] segment
  "/w/(.*)",
];

// ---------------------------------------------------------------------------
// Fast public-route matcher used for our own branching logic below.
// authkitMiddleware also receives UNAUTHENTICATED_PATHS so it won't gate
// these routes; we need the matcher separately to decide whether to run intl.
// ---------------------------------------------------------------------------
function buildPublicMatcher(paths: string[]): (pathname: string) => boolean {
  const exact = new Set<string>();
  const patterns: RegExp[] = [];

  for (const p of paths) {
    if (p.includes("(.*)") || p.includes("(.*")) {
      const re = new RegExp(`^${p.replace(/\(\.\*\)/g, ".*")}$`);
      patterns.push(re);
    } else {
      exact.add(p);
    }
  }

  return (pathname: string): boolean => {
    if (exact.has(pathname)) return true;
    return patterns.some((re) => re.test(pathname));
  };
}

const matchesPublicBase = buildPublicMatcher(UNAUTHENTICATED_PATHS);

function isPublicRoute(req: NextRequest): boolean {
  const original = req.nextUrl.pathname;
  if (matchesPublicBase(original)) return true;
  // Also check locale-stripped version (handles /fil/sign-in etc.)
  const stripped = stripLocale(original);
  if (stripped === original) return false;
  return matchesPublicBase(stripped);
}

/**
 * The server can receive an internal origin (for example localhost behind a
 * tunnel or reverse proxy). Browser-facing redirects must use the configured
 * public application origin instead.
 */
function publicOrigin(req: NextRequest): string {
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

/**
 * Reconstruct the request that AuthKit passes downstream via Next's internal
 * middleware-header protocol. Passing this enriched request to next-intl is
 * essential: next-intl creates a new `NextResponse.next({ request })`, and
 * doing that from the original request drops AuthKit's `x-workos-middleware`
 * marker. `withAuth()` then rejects the rendered page even though AuthKit did
 * run in this proxy.
 */
function requestWithAuthkitHeaders(
  req: NextRequest,
  authResponse: Response | NextMiddlewareResult,
): NextRequest {
  const headers = new Headers(req.headers);
  const overridden = (authResponse as Response).headers.get(
    "x-middleware-override-headers",
  );

  if (overridden) {
    for (const name of overridden.split(",").map((value) => value.trim()).filter(Boolean)) {
      const value = (authResponse as Response).headers.get(
        `x-middleware-request-${name}`,
      );
      if (value === null) headers.delete(name);
      else headers.set(name, value);
    }
  }

  return new NextRequest(req, { headers });
}

// ---------------------------------------------------------------------------
// authkitMiddleware composition approach
//
// authkitMiddleware(options) returns a NextMiddleware directly (verified
// against installed @workos-inc/authkit-nextjs v4.x types). It does NOT
// accept a callback function. We therefore run it as a sub-middleware and
// compose intl ourselves:
//   - For API routes: run authkit only (no intl).
//   - For /w/ routes: skip both (portfolio uses workspace country locale).
//   - For protected pages: run authkit, localize any /sign-in redirect, then
//     run intl and merge session-refresh headers from authkit.
//   - For public pages: skip authkit, run intl only.
// ---------------------------------------------------------------------------
const authMiddleware: NextMiddleware = authkitMiddleware({
  // Set AUTHKIT_DEBUG=true to log the session branch taken per request
  // ("No session found from cookie" / "Session invalid" / "Failed to refresh.
  // Deleting cookie." / "Session successfully refreshed") to the server console.
  debug: process.env.AUTHKIT_DEBUG === "true",
  middlewareAuth: {
    enabled: true,
    unauthenticatedPaths: UNAUTHENTICATED_PATHS,
  },
});

export async function proxy(req: NextRequest): Promise<NextMiddlewareResult> {
  const { pathname } = req.nextUrl;

  // -------------------------------------------------------------------------
  // 1. API routes — auth-gate non-public ones, no intl middleware.
  // -------------------------------------------------------------------------
  if (pathname.startsWith("/api")) {
    const authResponse = await (authMiddleware(req, {} as never) as Promise<Response | NextMiddlewareResult>);

    // Browser fetches must never be redirected to the hosted authentication
    // UI. Following that cross-origin redirect surfaces as a misleading CORS
    // error and hides the real condition from the caller. Navigation routes
    // still use the localized sign-in redirect below; API callers receive an
    // in-band JSON response they can handle explicitly.
    if (authResponse && (authResponse as Response).status >= 300 && (authResponse as Response).status < 400) {
      const response = NextResponse.json(
        { error: "not_authenticated" },
        { status: 401, headers: { "cache-control": "no-store" } },
      );

      // AuthKit may clear an invalid/expired session cookie on its redirect.
      // Preserve every Set-Cookie header while intentionally dropping Location.
      for (const cookie of (authResponse as Response).headers.getSetCookie()) {
        response.headers.append("set-cookie", cookie);
      }

      return response;
    }

    return authResponse as NextMiddlewareResult;
  }

  // -------------------------------------------------------------------------
  // 2. Public portfolio routes — no auth, no intl.
  //    /w/[orgSlug] lives outside the [locale] segment. Running next-intl here
  //    would rewrite /w/... to /[locale]/w/... (a non-existent route) and 404.
  // -------------------------------------------------------------------------
  if (pathname === "/w" || pathname.startsWith("/w/")) {
    return NextResponse.next();
  }

  // -------------------------------------------------------------------------
  // 3. Public routes — skip auth check, run intl for locale routing.
  //
  //    EXCEPTION: the marketing root ("/" for any locale) needs authkit session
  //    context so the page can read the session and redirect an already-signed-in
  //    visitor to their app landing (owner -> /dashboard, member -> /bookings).
  //    It stays in UNAUTHENTICATED_PATHS, so authkit refreshes the session for
  //    logged-in users but never forces an anonymous visitor to sign in — they
  //    fall through to the protected branch, authkit returns no redirect, and the
  //    landing page renders normally.
  // -------------------------------------------------------------------------
  const isRoot = stripLocale(pathname) === "/";
  // These public pages call getAuthUser() in a server action or error state.
  // Invite acceptance needs an existing session when present. Email
  // verification is different: WorkOS deliberately has not issued a session
  // yet, and the page verifies the short-lived pending token in its action.
  const isInviteAccept = stripLocale(pathname) === "/invite/accept";
  if (isPublicRoute(req) && !isRoot && !isInviteAccept) {
    return intlMiddleware(req);
  }

  // -------------------------------------------------------------------------
  // 4. Protected routes — run authkit for session refresh / unauthn redirect,
  //    then run intl so next-intl locale routing works on authenticated pages.
  //
  //    authkitMiddleware may return a redirect (to /sign-in) or a response
  //    with session-refresh headers set. Redirects to /sign-in are localized
  //    so they land on /{locale}/sign-in. Non-redirect responses get intl
  //    applied on top with authkit headers merged in.
  // -------------------------------------------------------------------------
  const authResponse = await (authMiddleware(req, {} as never) as Promise<Response | NextMiddlewareResult>);

  if (authResponse && (authResponse as Response).status >= 300 && (authResponse as Response).status < 400) {
    const location = (authResponse as Response).headers.get("location");
    if (location) {
      try {
        const locUrl = new URL(location, req.nextUrl.origin);
        // Intercept two cases where authkitMiddleware signals "unauthenticated":
        //   a) A redirect to the local /sign-in path (test/mock environments).
        //   b) A redirect to the external WorkOS hosted AuthKit UI (real usage:
        //      authkitMiddleware calls workos.userManagement.getAuthorizationUrl
        //      and returns an authkit.app redirect directly — it never routes
        //      through the local /sign-in page).
        // In both cases we redirect to the local sign-in page with ?returnTo so
        // the user lands back on their original deep-linked page after auth.
        const isLocalSignIn = locUrl.origin === req.nextUrl.origin && locUrl.pathname === "/sign-in";
        // authkitMiddleware redirects unauthenticated users to the WorkOS-hosted
        // authorization endpoint (api.workos.com or *.authkit.app). Intercept any
        // redirect that leaves the app origin so we can route via the local
        // sign-in page with returnTo instead of passing the user off to WorkOS directly.
        const isWorkOsHostedAuth =
          locUrl.hostname.endsWith(".authkit.app") ||
          locUrl.hostname === "api.workos.com" ||
          locUrl.hostname.endsWith(".workos.com");
        if (isLocalSignIn || isWorkOsHostedAuth) {
          // Localize the sign-in redirect based on the incoming request locale.
          const localeMatch = pathname.match(LOCALE_PREFIX_RE);
          const prefix = localeMatch ? localeMatch[0] : "";
          const redirectUrl = new URL(publicOrigin(req));
          redirectUrl.pathname = `${prefix}/sign-in`;
          redirectUrl.search = "";
          // Preserve the originally-requested destination so email deep links /
          // bookmarks return the user to the right page+modal after sign-in. This is a
          // local path; signInAction (sanitizeReturnTo) and the OAuth callback both
          // re-validate it before redirecting, so it cannot be an open redirect.
          redirectUrl.searchParams.set("returnTo", `${pathname}${req.nextUrl.search}`);
          return NextResponse.redirect(redirectUrl);
        }
      } catch {
        // Malformed location header — pass through as-is.
      }
    }
    return authResponse as NextMiddlewareResult;
  }

  // Run next-intl with AuthKit's enriched request. Calling it with `req`
  // would rebuild the internal request-header manifest without AuthKit's
  // context, causing getAuthUser()/withAuth() to fail in the rendered page.
  const intlResponse = intlMiddleware(
    authResponse ? requestWithAuthkitHeaders(req, authResponse) : req,
  );

  // Merge any session-refresh headers from authkit into the intl response.
  //
  // Both middlewares inject *request* headers via Next.js's internal protocol:
  // `x-middleware-override-headers` is a comma-separated manifest of header
  // names to override, paired with one `x-middleware-request-<name>` value each.
  // authkit uses this for its session headers (read by withAuth); next-intl uses
  // it for `x-next-intl-locale` (read by getRequestConfig). A blind `set()` of
  // authkit's manifest would clobber next-intl's, dropping the locale header and
  // making hard-reloaded /{locale}/* pages fall back to the default locale.
  // So we UNION the manifest and copy every other header through unchanged.
  if (authResponse) {
    const authHeaders = (authResponse as Response).headers;
    authHeaders.forEach((value, key) => {
      if (key.toLowerCase() === "x-middleware-override-headers") {
        const merged = new Set(
          [intlResponse.headers.get(key), value]
            .filter((v): v is string => Boolean(v))
            .flatMap((v) => v.split(",").map((s) => s.trim()))
            .filter(Boolean),
        );
        intlResponse.headers.set(key, [...merged].join(","));
      } else {
        intlResponse.headers.set(key, value);
      }
    });
  }

  return intlResponse;
}

export default proxy;

export const config = {
  matcher: [
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    "/(api|trpc)(.*)",
  ],
};
