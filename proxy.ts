import { authkitMiddleware } from "@workos-inc/authkit-nextjs";
import type { NextRequest, NextMiddleware } from "next/server";
import { NextResponse } from "next/server";

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
  "/pricing",
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
  // 1. Workflow DevKit internal endpoints — skip everything.
  // -------------------------------------------------------------------------
  if (pathname.startsWith("/.well-known/workflow")) {
    return NextResponse.next();
  }

  // -------------------------------------------------------------------------
  // 2. API routes — auth-gate non-public ones, no intl middleware.
  // -------------------------------------------------------------------------
  if (pathname.startsWith("/api")) {
    return authMiddleware(req, {} as never) as Promise<NextMiddlewareResult>;
  }

  // -------------------------------------------------------------------------
  // 3. Public portfolio routes — no auth, no intl.
  //    /w/[orgSlug] lives outside the [locale] segment. Running next-intl here
  //    would rewrite /w/... to /[locale]/w/... (a non-existent route) and 404.
  // -------------------------------------------------------------------------
  if (pathname === "/w" || pathname.startsWith("/w/")) {
    return NextResponse.next();
  }

  // -------------------------------------------------------------------------
  // 4. Public routes — skip auth check, run intl for locale routing.
  // -------------------------------------------------------------------------
  if (isPublicRoute(req)) {
    return intlMiddleware(req);
  }

  // -------------------------------------------------------------------------
  // 5. Protected routes — run authkit for session refresh / unauthn redirect,
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
          const redirectUrl = req.nextUrl.clone();
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

  // Authenticated — run intl middleware for locale routing.
  const intlResponse = intlMiddleware(req);

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
    // Exclude the Workflow DevKit's internal endpoints (.well-known/workflow/*)
    // so neither authkit nor next-intl middleware intercepts workflow resumption
    // traffic — Next.js 16 + proxy.ts makes this easy to miss.
    "/((?!_next|\\.well-known/workflow|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    "/(api|trpc)(.*)",
  ],
};
