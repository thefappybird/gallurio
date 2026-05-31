import localFont from "next/font/local";

/**
 * Self-hosted portfolio brand-kit fonts.
 *
 * Bundled locally (woff2 in app/fonts/) exactly like the app-shell Merriweather,
 * so builds never depend on a runtime Google Fonts fetch and stay reproducible
 * offline. These back the curated brand-kit font pairings (lib/page-builder).
 *
 * `preload: false` — the app shell is Merriweather-only, so we don't want a
 * <link rel=preload> for these on every authenticated page. The @font-face
 * rules are cheap to ship; the actual woff2 is fetched lazily only when a
 * surface that references the family renders (the public portfolio or the
 * in-editor preview). `display: "swap"` keeps text visible during that fetch.
 *
 * Six families use a single variable woff2 (full weight axis in one file); DM
 * Serif Display ships static 400 normal + italic only.
 */

const playfair = localFont({
  variable: "--font-playfair",
  display: "swap",
  preload: false,
  src: [{ path: "../../app/fonts/playfair-display-latin-wght-normal.woff2", weight: "400 900", style: "normal" }],
});

const inter = localFont({
  variable: "--font-inter",
  display: "swap",
  preload: false,
  src: [{ path: "../../app/fonts/inter-latin-wght-normal.woff2", weight: "100 900", style: "normal" }],
});

const dmSans = localFont({
  variable: "--font-dm-sans",
  display: "swap",
  preload: false,
  src: [{ path: "../../app/fonts/dm-sans-latin-wght-normal.woff2", weight: "100 1000", style: "normal" }],
});

const cormorant = localFont({
  variable: "--font-cormorant",
  display: "swap",
  preload: false,
  src: [{ path: "../../app/fonts/cormorant-garamond-latin-wght-normal.woff2", weight: "300 700", style: "normal" }],
});

const montserrat = localFont({
  variable: "--font-montserrat",
  display: "swap",
  preload: false,
  src: [{ path: "../../app/fonts/montserrat-latin-wght-normal.woff2", weight: "100 900", style: "normal" }],
});

const fraunces = localFont({
  variable: "--font-fraunces",
  display: "swap",
  preload: false,
  src: [{ path: "../../app/fonts/fraunces-latin-wght-normal.woff2", weight: "100 900", style: "normal" }],
});

const dmSerif = localFont({
  variable: "--font-dm-serif",
  display: "swap",
  preload: false,
  src: [
    { path: "../../app/fonts/dm-serif-display-latin-400-normal.woff2", weight: "400", style: "normal" },
    { path: "../../app/fonts/dm-serif-display-latin-400-italic.woff2", weight: "400", style: "italic" },
  ],
});

/**
 * Space-separated className exposing every portfolio font's CSS variable
 * (`--font-playfair`, `--font-inter`, …). Apply to an ancestor of any subtree
 * that renders brand-kit typography (the public portfolio root and the
 * authenticated app root, so the in-editor preview resolves the same families).
 */
export const portfolioFontVariables = [
  playfair.variable,
  inter.variable,
  dmSans.variable,
  cormorant.variable,
  montserrat.variable,
  fraunces.variable,
  dmSerif.variable,
].join(" ");
