"use client";

import { useTranslations } from "next-intl";
import { usePathname } from "@/lib/i18n/navigation";

type BrandPaneKey =
  | "signIn"
  | "signUp"
  | "mfa"
  | "forgotPassword"
  | "resetPassword"
  | "verifyEmail";

// Locale-agnostic pathname (usePathname from lib/i18n/navigation strips the
// /[locale] segment), so plain route-name matching works for every locale.
function resolveBrandPaneKey(pathname: string): BrandPaneKey {
  if (pathname.startsWith("/sign-in/mfa")) return "mfa";
  if (pathname.startsWith("/sign-in")) return "signIn";
  if (pathname.startsWith("/sign-up")) return "signUp";
  if (pathname.startsWith("/forgot-password")) return "forgotPassword";
  if (pathname.startsWith("/reset-password")) return "resetPassword";
  if (pathname.startsWith("/verify-email")) return "verifyEmail";
  return "signIn";
}

/**
 * Ledger-themed brand pane copy, keyed off the active auth route. Lives in a
 * client component (not the Server Component layout) because picking the
 * right copy needs the pathname, which the shared (auth) layout never sees
 * as a param -- sign-in/sign-up/mfa/etc. are static segments, not [slug]s.
 */
export function AuthBrandPane() {
  const pathname = usePathname();
  const key = resolveBrandPaneKey(pathname);
  const t = useTranslations("auth.brandPane");

  return (
    <div className="relative hidden flex-1 flex-col justify-end gap-3 md:flex">
      <BookedRingMotif className="pointer-events-none absolute -bottom-16 -end-16 size-64 text-primary-foreground/15" />
      <h2 className="relative max-w-xs text-balance font-heading text-2xl font-semibold tracking-tight text-primary-foreground">
        {t(`${key}.headline`)}
      </h2>
      <p className="relative max-w-xs text-pretty text-sm leading-6 text-primary-foreground/70">
        {t(`${key}.body`)}
      </p>
    </div>
  );
}

// Subtle decorative motif -- concentric "booked" rings with tick-marks around
// the rim, evoking a calendar/clock face rather than a stock photo. Purely
// decorative (aria-hidden); color/opacity are controlled by the caller via
// currentColor + a text-* className.
function BookedRingMotif({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 200 200" className={className} aria-hidden="true" focusable="false">
      <circle cx="100" cy="100" r="90" fill="none" stroke="currentColor" strokeWidth="1" />
      <circle cx="100" cy="100" r="62" fill="none" stroke="currentColor" strokeWidth="1" />
      <circle cx="100" cy="100" r="34" fill="none" stroke="currentColor" strokeWidth="1" />
      <circle cx="100" cy="18" r="3" fill="currentColor" />
      <circle cx="165" cy="60" r="3" fill="currentColor" />
      <circle cx="165" cy="140" r="3" fill="currentColor" />
      <circle cx="100" cy="182" r="3" fill="currentColor" />
      <circle cx="35" cy="140" r="3" fill="currentColor" />
      <circle cx="35" cy="60" r="3" fill="currentColor" />
    </svg>
  );
}
