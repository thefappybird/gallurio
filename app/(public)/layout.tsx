import type { ReactNode } from "react";
import { portfolioFontVariables } from "@/lib/fonts/portfolio";
import "../globals.css";

/**
 * Root layout for the public, non-localized routes (the portfolio at
 * `/w/[orgSlug]`). These live OUTSIDE the `[locale]` segment, so they don't
 * inherit `app/[locale]/layout.tsx` — without a root layout here the route has
 * no <html>/<body> and Next.js can't render it. (There is no top-level
 * `app/layout.tsx`; with next-intl this is the documented "multiple root
 * layouts" setup — one per top-level branch.)
 *
 * Intentionally minimal: no app ThemeProvider (portfolios are styled by their
 * own brand kit via `--pf-*` vars on the inner wrapper) and no
 * NextIntlClientProvider (public components receive their copy as props,
 * resolved server-side from the workspace's country locale). It loads the
 * self-hosted brand-kit fonts so the chosen pairing actually renders.
 */
export default function PublicRootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" className={`${portfolioFontVariables} h-full antialiased`} suppressHydrationWarning>
      <body className="min-h-full">{children}</body>
    </html>
  );
}
