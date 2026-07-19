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
  href: "/dashboard" | "/bookings" | "/onboarding",
  locale: string,
): string {
  return locale === routing.defaultLocale ? href : `/${locale}${href}`;
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
