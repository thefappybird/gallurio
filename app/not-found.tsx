import Link from "next/link";

/**
 * Testable content, split from the default export because this file must
 * render its own <html>/<body> per Next.js convention when no locale segment
 * matches (root-level catch-all — no `app/layout.tsx` exists), which is
 * awkward to mount in jsdom. No providers, no app CSS classes are guaranteed
 * to be loaded, so this stays inline-styled and plain English only.
 */
export function NotFoundContent() {
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
      {/* eslint-disable-next-line @next/next/no-img-element -- root catch-all has no app CSS/Image loader guaranteed */}
      <img src="/brand/gallurio-sq.svg" alt="Gallurio" width={48} height={48} />
      <h1 style={{ fontSize: "1.5rem", fontWeight: 700, margin: 0 }}>Page not found</h1>
      <Link
        href="/"
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
          textDecoration: "none",
          color: "#111",
        }}
      >
        Home
      </Link>
    </div>
  );
}

export default function NotFound() {
  return (
    <html lang="en">
      <body>
        <NotFoundContent />
      </body>
    </html>
  );
}
