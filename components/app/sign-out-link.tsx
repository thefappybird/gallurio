"use client";

import { signOutAction } from "@/lib/auth/signOut";

/**
 * Thin client wrapper around the WorkOS sign-out server action.
 * Renders a styled button; children are rendered inside it.
 *
 * Usage:
 *   <SignOutLink>
 *     <LogOutIcon /> {t("logOut")}
 *   </SignOutLink>
 */
export function SignOutLink({ children }: { children: React.ReactNode }) {
  return (
    <form action={signOutAction}>
      <button
        type="submit"
        className="inline-flex min-h-9 items-center gap-1.5 px-2 py-1 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground focus-visible:text-foreground focus-visible:outline-none"
      >
        {children}
      </button>
    </form>
  );
}
