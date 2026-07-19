"use client";

import { useEffect } from "react";

/**
 * Testable content, split from the default export because global-error.tsx
 * must render its own <html>/<body> per Next.js convention (it replaces the
 * root layout entirely when triggered), which is awkward to mount in jsdom.
 * Root-level catch-all -- no providers, no app CSS classes are guaranteed to
 * be loaded (the failure may be in the root layout itself), so this stays
 * inline-styled and plain English only.
 */
export function GlobalErrorContent({ reset }: { reset: () => void }) {
  return (
    <div
      style={{
        display: "flex",
        minHeight: "100vh",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: "1rem",
        padding: "2rem",
        textAlign: "center",
        fontFamily: "sans-serif",
      }}
    >
      <h1 style={{ fontSize: "1.5rem", fontWeight: 700, margin: 0 }}>Something went wrong</h1>
      <p style={{ maxWidth: "24rem", margin: 0, color: "#666" }}>
        An unexpected error occurred. Please try again.
      </p>
      <button
        type="button"
        onClick={reset}
        style={{
          display: "inline-flex",
          height: "44px",
          alignItems: "center",
          justifyContent: "center",
          padding: "0 1.5rem",
          border: "1px solid #ccc",
          background: "#fff",
          fontSize: "0.875rem",
          fontWeight: 500,
          cursor: "pointer",
        }}
      >
        Try again
      </button>
    </div>
  );
}

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[global-error-boundary]", error);
  }, [error]);

  return (
    <html lang="en">
      <body>
        <GlobalErrorContent reset={reset} />
      </body>
    </html>
  );
}
