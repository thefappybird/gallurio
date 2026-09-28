import "server-only";
import { NextRequest, NextResponse } from "next/server";
import { hasLocale } from "next-intl";
import { routing } from "@/lib/i18n/routing";
import { getAuthUser } from "@/lib/auth/session";
import { connectDB } from "@/lib/db/mongoose";
import { User } from "@/lib/db/models";
import { defaultPostAuthPath } from "@/lib/auth/postAuthLanding";

// Resolves the signed-in landing redirect that the marketing root ("/") used
// to compute on every request (getAuthUser + a User lookup), so that page can
// become a static shell. proxy.ts now redirects here only when a request to
// "/" carries a WorkOS session cookie — see proxy.ts's root branch.
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Browser-facing origin (mirrors proxy.ts's publicOrigin): prefer the
 * configured public app URL over the request's own origin, which can be an
 * internal upstream address behind Caddy.
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

function localizedPath(path: string, locale: string): string {
  return locale === routing.defaultLocale ? path : `/${locale}${path}`;
}

export async function GET(req: NextRequest): Promise<Response> {
  const requestedLocale = req.nextUrl.searchParams.get("locale");
  const locale =
    requestedLocale && hasLocale(routing.locales, requestedLocale)
      ? requestedLocale
      : routing.defaultLocale;
  const origin = publicOrigin(req);

  const authUser = await getAuthUser();
  if (!authUser) {
    // No session — never loop back to "/" (proxy only sends session-bearing
    // requests here). Land on sign-in instead.
    const redirectUrl = new URL(localizedPath("/sign-in", locale), origin);
    return NextResponse.redirect(redirectUrl, {
      status: 307,
      headers: { "cache-control": "no-store" },
    });
  }

  await connectDB();
  const user = await User.findOne({ workosUserId: authUser.workosUserId })
    .select("memberships onboardingCompletedAt")
    .lean();

  // A missing User doc is effectively "no memberships" -> onboarding.
  const target = defaultPostAuthPath(user ?? { memberships: [] }, locale);
  const redirectUrl = new URL(target, origin);
  return NextResponse.redirect(redirectUrl, {
    status: 307,
    headers: { "cache-control": "no-store" },
  });
}
