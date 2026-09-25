"use client";

import { useEffect } from "react";

/**
 * Catches a page-level crash under /w/[orgSlug] (page.tsx, gallery/page.tsx,
 * etc.) while the segment's own layout.tsx keeps rendering above it. That
 * layout resolves the workspace's locale via getTranslations() (a Server
 * Component call) but never mounts a NextIntlClientProvider -- confirmed by
 * reading both app/(public)/layout.tsx ("no NextIntlClientProvider") and
 * app/(public)/w/[orgSlug]/layout.tsx, neither of which wraps children in
 * one -- so an error.tsx here (client component) has no intl context to read
 * with useTranslations(). Stays plain, hardcoded English, same as
 * app/(public)/error.tsx and w/[orgSlug]/not-found.tsx.
 */
export default function PublicWorkspaceError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[public-workspace-error-boundary]", error);
  }, [error]);

  return (
    <main
      style={{ fontFamily: "'Merriweather', serif" }}
      className="flex min-h-screen flex-col items-center justify-center gap-4 bg-background px-6 text-center text-foreground"
    >
      <p className="text-sm font-semibold tracking-widest uppercase text-muted-foreground">
        Gallurio
      </p>
      <h1 className="text-2xl font-bold">This page is temporarily unavailable</h1>
      <p className="max-w-sm text-base text-muted-foreground">
        Something went wrong loading this page. Please try again in a moment.
      </p>
      <button
        type="button"
        onClick={reset}
        className="inline-flex h-11 items-center justify-center border border-border bg-background px-6 text-sm font-medium text-foreground transition-colors hover:bg-accent hover:text-accent-foreground focus-visible:bg-accent focus-visible:text-accent-foreground focus-visible:outline-none"
      >
        Try again
      </button>
    </main>
  );
}
