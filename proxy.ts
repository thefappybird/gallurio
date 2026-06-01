import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";
import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import createIntlMiddleware from "next-intl/middleware";
import { routing } from "@/lib/i18n/routing";

const intlMiddleware = createIntlMiddleware(routing);

// Clerk's createRouteMatcher uses path-to-regexp v6 which doesn't accept raw
// regex `(?:...)?` groups, so we match against the locale-stripped pathname
// rather than baking the optional prefix into every pattern.
const LOCALE_PREFIX_RE = new RegExp(`^/(?:${routing.locales.join("|")})(?=/|$)`);

const isPublicBase = createRouteMatcher([
  "/",
  "/pricing",
  "/about",
  "/sign-in(.*)",
  "/sign-up(.*)",
  "/api/webhooks/(.*)",
  "/api/inquiries(.*)",
  "/w/(.*)",
]);

// Owner-only app surfaces. Non-owner members get bounced to /bookings, except
// for /settings/account which is Clerk's own user profile area.
const MEMBER_BLOCKED_PREFIXES = [
  "/dashboard",
  "/clients",
  "/inquiries",
  "/gallery",
  "/teams",
  "/settings",
];

const MEMBER_ALLOWED_SETTINGS = ["/settings/account"];

function isPublicRoute(req: NextRequest): boolean {
  const original = req.nextUrl.pathname;
  if (isPublicBase(req)) return true;
  const stripped = original.replace(LOCALE_PREFIX_RE, "") || "/";
  if (stripped === original) return false;
  const url = req.nextUrl.clone();
  url.pathname = stripped;
  return isPublicBase({ nextUrl: url } as NextRequest);
}

function stripLocale(pathname: string): string {
  return pathname.replace(LOCALE_PREFIX_RE, "") || "/";
}

function isMemberBlocked(pathname: string): boolean {
  const stripped = stripLocale(pathname);
  if (MEMBER_ALLOWED_SETTINGS.some((p) => stripped === p || stripped.startsWith(p + "/"))) {
    return false;
  }
  return MEMBER_BLOCKED_PREFIXES.some(
    (prefix) => stripped === prefix || stripped.startsWith(prefix + "/"),
  );
}

function redirectToBookings(req: NextRequest): NextResponse {
  const url = req.nextUrl.clone();
  const localeMatch = req.nextUrl.pathname.match(LOCALE_PREFIX_RE);
  url.pathname = `${localeMatch ? localeMatch[0] : ""}/bookings`;
  url.search = "";
  return NextResponse.redirect(url);
}

export default clerkMiddleware(async (auth, req) => {
  // API routes do not participate in locale routing — return early without
  // running the intl middleware so the route handler resolves at its bare path.
  if (req.nextUrl.pathname.startsWith("/api")) {
    if (!isPublicRoute(req)) {
      await auth.protect();
    }
    return;
  }

  if (!isPublicRoute(req)) {
    await auth.protect();

    // Non-owner members can only see /bookings + their Clerk profile area.
    // The DB-aware ownerContext() still runs in server actions; this is a
    // cheap UX gate to keep members out of UI they shouldn't see.
    const session = await auth();
    const orgRole = session.sessionClaims?.org_role ?? session.orgRole;
    if (
      session.userId &&
      session.orgId &&
      orgRole &&
      orgRole !== "org:admin" &&
      isMemberBlocked(req.nextUrl.pathname)
    ) {
      return redirectToBookings(req);
    }
  }

  // Redirect authenticated users away from the marketing root.
  if (stripLocale(req.nextUrl.pathname) === "/") {
    const session = await auth();
    if (session.userId && session.orgId) {
      const url = req.nextUrl.clone();
      const localeMatch = req.nextUrl.pathname.match(LOCALE_PREFIX_RE);
      url.pathname = `${localeMatch ? localeMatch[0] : ""}/dashboard`;
      url.search = "";
      return NextResponse.redirect(url);
    }
  }

  return intlMiddleware(req);
});

export const config = {
  matcher: [
    // Exclude the Workflow DevKit's internal endpoints (.well-known/workflow/*)
    // so neither Clerk nor next-intl middleware intercepts workflow resumption
    // traffic — Next.js 16 + proxy.ts makes this easy to miss.
    "/((?!_next|\\.well-known/workflow|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    "/(api|trpc)(.*)",
  ],
};
