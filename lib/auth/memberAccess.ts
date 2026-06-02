import { routing } from "@/lib/i18n/routing";

// Clerk's createRouteMatcher uses path-to-regexp v6 which doesn't accept raw
// regex `(?:...)?` groups, so we match against the locale-stripped pathname
// rather than baking the optional prefix into every pattern.
export const LOCALE_PREFIX_RE = new RegExp(
  `^/(?:${routing.locales.join("|")})(?=/|$)`,
);

// Owner-only app surfaces. Non-owner members get bounced to /bookings.
// /clients and /settings are tab-gated at the page level so members can
// enter; block only surfaces that are fully owner-exclusive.
export const MEMBER_BLOCKED_PREFIXES = [
  "/dashboard",
  "/teams",
  "/gallery",       // future
  "/page-builder",  // future
] as const;

export function stripLocale(pathname: string): string {
  return pathname.replace(LOCALE_PREFIX_RE, "") || "/";
}

export function isMemberBlocked(pathname: string): boolean {
  const stripped = stripLocale(pathname);
  return MEMBER_BLOCKED_PREFIXES.some(
    (prefix) => stripped === prefix || stripped.startsWith(prefix + "/"),
  );
}

/**
 * Returns the post-login landing route for the given Clerk org role.
 * Owners (org:admin) land on /dashboard; everyone else lands on /bookings.
 */
export function landingPathForRole(
  orgRole: string | null | undefined,
): "/dashboard" | "/bookings" {
  return orgRole === "org:admin" ? "/dashboard" : "/bookings";
}
