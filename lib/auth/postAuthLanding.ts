import "server-only";
import { routing } from "@/lib/i18n/routing";

type LandingMembership = {
  role: "owner" | "staff";
};

type LandingUser = {
  memberships: LandingMembership[];
  onboardingCompletedAt?: Date | null;
};

function localized(
  href: "/dashboard" | "/bookings" | "/onboarding" | "/portfolio",
  locale: string,
): string {
  return locale === routing.defaultLocale ? href : `/${locale}${href}`;
}

/**
 * A demo-import marker only overrides the normal landing page once the user
 * already owns a fully-onboarded workspace. New owners still need onboarding,
 * and staff members must keep their role-appropriate landing page.
 */
export function demoImportPostAuthPath(
  user: LandingUser,
  locale: string,
): string | null {
  const isOwner = user.memberships.some((membership) => membership.role === "owner");
  return isOwner && user.onboardingCompletedAt
    ? localized("/portfolio", locale)
    : null;
}

export function defaultPostAuthPath(user: LandingUser, locale: string): string {
  const isOwner = user.memberships.some((membership) => membership.role === "owner");

  if (isOwner) {
    return user.onboardingCompletedAt
      ? localized("/dashboard", locale)
      : localized("/onboarding", locale);
  }

  if (user.memberships.length > 0) {
    return localized("/bookings", locale);
  }

  return localized("/onboarding", locale);
}
