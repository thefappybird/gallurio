import type { Metadata } from "next";
import type { ReactNode } from "react";
import { headers } from "next/headers";
import { portfolioFontVariables } from "@/lib/fonts/portfolio";
import { findPublishedWorkspaceBySlug } from "@/lib/db/queries/publicPage";
import { resolvePublicChromeLocale } from "@/lib/i18n/localeForCountry";
import { resolveEffectiveDir } from "@/lib/i18n/rtl";
import { PORTFOLIO_SLUG_HEADER } from "@/proxy";
import "../globals.css";

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000"),
  icons: {
    icon: "/brand/gallurio-sq-white.png",
    shortcut: "/brand/gallurio-sq-white.png",
    apple: "/brand/gallurio-sq-white.png",
  },
};

/**
 * Root layout for the public, non-localized routes (the portfolio at
 * `/w/[orgSlug]`). These live OUTSIDE the `[locale]` segment, so they don't
 * inherit `app/[locale]/layout.tsx` — without a root layout here the route has
 * no <html>/<body> and Next.js can't render it. (There is no top-level
 * `app/layout.tsx`; with next-intl this is the documented "multiple root
 * layouts" setup — one per top-level branch.)
 *
 * `lang`/`dir` on <html> must be correct in the initial server HTML for
 * crawlers and assistive tech. A root layout cannot read the `[orgSlug]`
 * child segment's `params`, so proxy.ts resolves the slug (from the Host
 * header or the `/w/{slug}` path) and forwards it via PORTFOLIO_SLUG_HEADER;
 * this layout re-resolves the workspace from that slug to derive locale/dir.
 * Falls back to en/ltr when the header is missing or the slug doesn't
 * resolve to a published workspace — not-found.tsx renders through this
 * layout too and must still get a valid shell.
 *
 * Intentionally minimal otherwise: no app ThemeProvider (portfolios are
 * styled by their own brand kit via `--pf-*` vars on the inner wrapper) and
 * no NextIntlClientProvider (public components receive their copy as props,
 * resolved server-side from the workspace's country locale). It loads the
 * self-hosted brand-kit fonts so the chosen pairing actually renders.
 */
export default async function PublicRootLayout({ children }: { children: ReactNode }) {
  const slug = (await headers()).get(PORTFOLIO_SLUG_HEADER);
  const workspace = slug ? await findPublishedWorkspaceBySlug(slug) : null;
  const locale = workspace ? resolvePublicChromeLocale(workspace) : "en";
  const dir = workspace
    ? resolveEffectiveDir(workspace.publicPage?.formDir as "ltr" | "rtl" | "" | undefined, locale)
    : "ltr";

  return (
    <html
      lang={locale}
      dir={dir}
      className={`${portfolioFontVariables} h-full antialiased`}
      suppressHydrationWarning
    >
      <body className="min-h-full">{children}</body>
    </html>
  );
}
