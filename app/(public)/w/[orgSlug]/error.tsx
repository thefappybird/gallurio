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
 *
 * `generateMetadata` in page.tsx resolves `robots` BEFORE the render that
 * throws, so a crashed page still ships whatever indexable robots value the
 * happy path computed — this boundary can't export its own `generateMetadata`
 * (client component), so it renders the noindex meta tag directly. React 19
 * hoists `<title>`/`<meta>`/`<link>` rendered anywhere in the component tree
 * into `<head>` automatically (https://react.dev/blog/2024/12/05/react-19 —
 * "Support for Document Metadata"), so this survives even though it renders
 * inside `<main>`, not `<head>`.
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
    <>
      {/* Hoisted into <head> by React 19 — see the header comment above. */}
      <meta name="robots" content="noindex" />
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
    </>
  );
}
