import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";
import type { NextRequest } from "next/server";
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

function isPublicRoute(req: NextRequest): boolean {
  const original = req.nextUrl.pathname;
  if (isPublicBase(req)) return true;
  const stripped = original.replace(LOCALE_PREFIX_RE, "") || "/";
  if (stripped === original) return false;
  const url = req.nextUrl.clone();
  url.pathname = stripped;
  return isPublicBase({ nextUrl: url } as NextRequest);
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
  }

  return intlMiddleware(req);
});

export const config = {
  matcher: [
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    "/(api|trpc)(.*)",
  ],
};
