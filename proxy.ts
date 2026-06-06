import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";
import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import createIntlMiddleware from "next-intl/middleware";
import { routing } from "@/lib/i18n/routing";
import {
  LOCALE_PREFIX_RE,
  isMemberBlocked,
  landingPathForRole,
  stripLocale,
} from "@/lib/auth/memberAccess";

const intlMiddleware = createIntlMiddleware(routing);

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

function isPublicRoute(req: NextRequest): boolean {
  const original = req.nextUrl.pathname;
  if (isPublicBase(req)) return true;
  const stripped = original.replace(LOCALE_PREFIX_RE, "") || "/";
  if (stripped === original) return false;
  const url = req.nextUrl.clone();
  url.pathname = stripped;
  return isPublicBase({ nextUrl: url } as NextRequest);
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

  // The public portfolio at /w/[orgSlug] lives OUTSIDE the [locale] segment
  // (app/(public)/w/...). It must NOT run the intl middleware: with
  // localePrefix "as-needed", next-intl rewrites the unprefixed path toward
  // /[locale]/w/... — a route that does not exist — which 404s the live page.
  // The route is already public (no auth.protect) and picks its locale from the
  // workspace country, not the URL, so skipping intl here is correct.
  if (req.nextUrl.pathname === "/w" || req.nextUrl.pathname.startsWith("/w/")) {
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
      const orgRole = session.sessionClaims?.org_role ?? session.orgRole;
      const dest = landingPathForRole(orgRole);
      url.pathname = `${localeMatch ? localeMatch[0] : ""}${dest}`;
      url.search = "";
      return NextResponse.redirect(url);
    }
  }

  return intlMiddleware(req);
});

export const config = {
  matcher: [
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    "/(api|trpc)(.*)",
  ],
};
