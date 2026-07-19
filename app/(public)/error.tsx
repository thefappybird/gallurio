"use client";

import { useEffect } from "react";

/**
 * Catches errors thrown by app/(public)/w/[orgSlug]/layout.tsx and any nested
 * page (a segment's error.tsx does not catch its own-level layout, only pages
 * and deeper children -- this boundary sits one level up so it also covers
 * layout.tsx's findPublishedWorkspaceBySlug() failing, e.g. on a DB timeout).
 *
 * No workspace/locale context is available here (the very fetch that would
 * supply it may be what failed), so this stays plain, hardcoded English --
 * same reasoning already used by w/[orgSlug]/not-found.tsx.
 */
export default function PublicPortfolioError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[public-portfolio-error-boundary]", error);
  }, [error]);

  return (
    <main className="flex min-h-svh flex-col items-center justify-center gap-4 bg-background px-6 text-center text-foreground">
      <p className="text-sm font-semibold tracking-widest uppercase text-muted-foreground">
        Error
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
