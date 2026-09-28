# Public surfaces — GSC indexing fixes + first-load perf (2026-09-28)

Branch `fix/seo-indexing-issues`. Source: the GSC coverage export in this
folder (`Chart.csv`, `Critical issues.csv`, `Metadata.csv`,
`Non-critical issues.csv`; snapshot 2026-07-18 → 2026-09-14). The export has
counts only, no URLs, so every cause below was traced against the live site
and the code.

## GSC issues — causes and fixes

| GSC reason | pages | cause (verified live) | fix |
|---|---|---|---|
| Page with redirect | 8 | (a) `localeUrl(locale, "/")` built `https://gallurio.com/fil/` for every localized home's canonical **and** hreflang; `/fil/` 308s to `/fil`. (b) Localized header/footer/compare-teaser linked `/fil/compare`, `/fil/resources` (next-intl `Link`), which 308 to the English-only editorial URLs. (c) next-intl's middleware also emitted an HTTP `Link` hreflang header listing `/fil/compare` etc. `http://`, `www.` and `/w/<slug>` → subdomain redirects are correct and stay. | `lib/seo/metadata.ts` no trailing slash on prefixed homes; editorial links are plain `next/link`; `alternateLinks: false` in `lib/i18n/routing.ts` (the HTML head already carries hreflang) |
| Blocked by robots.txt | 1 | `Disallow: /fil/portfolio` prefix-matched `/fil/portfolio-maker-demo` (linked from every localized page, and `noindex` — Google must crawl it to see that). `/sign-in`, `/sign-up` stay disallowed on purpose. | `app/robots.ts` re-opens the demo under every locale prefix |
| Crawled – currently not indexed | 4 | Most likely the localized homes whose canonical pointed at a redirecting URL (row 1a). Otherwise a quality call by Google. | Covered by row 1; verify after deploy |

Found in review, fixed on the same branch: **redirect loop on the editorial
pages** for any visitor with a non-English `NEXT_LOCALE` cookie or
`accept-language` (`/compare` → next-intl → `/fil/compare` → proxy 308 →
`/compare` …). `proxy.ts` now rewrites unprefixed `/resources`, `/blog`,
`/compare` straight to the `en` route without locale detection and never
touches the cookie.

## First-load perf — what was slow and what changed

Live Lighthouse (mobile, prod, before this branch; `origin/prod` predates the
PR #109 perf wave): home score 63, LCP 4.9 s, TBT 650 ms; tenant home score
52, LCP 8.7 s, 1.9 MB.

**Marketing**
- The root `[locale]` layout's `NextIntlClientProvider` shipped the **whole
  195 KB catalog** into every page's RSC payload. Now `lib/i18n/clientMessages.ts`
  (`pickMessages` + key lists): root ships nothing, `(marketing)` ships only
  what its client components read (~8 KB), every other branch keeps the full
  catalog via its own bare provider. Guard tests: a static namespace scan of
  marketing client files, and "every `app/[locale]/*` branch picks its catalog".
- Logo `gallurio-sq.svg` was 260 KB (embedded rasters), preloaded on every
  marketing **and tenant** page (via `app/not-found.tsx`) → `gallurio-sq-128.png`, 8.9 KB.
- `AmbientBackground`: `motion/react` → CSS keyframes, server component, no
  `priority`, so only the active theme's SVG downloads.
- `ThemedShot`: client swap after hydration → server component with both
  variants toggled by `dark:`; dark visitors no longer fetch both screenshots.
- Pre-existing overflow found by the sweep, fixed with owner approval: the
  desktop header row needs up to ~1108 px (fil), so it now shows from `xl`
  (hamburger below); hero trust row wraps when a locale's items don't fit.

**Tenant (`/w/[orgSlug]`)**
- `ContainerBackgroundSlideshow` mounted every slide (hidden layers are in the
  viewport, so `loading="lazy"` fetched them all) → mounts prev + active + next.
- `Lightbox` / `CollectionPopup` (with the imageModal/popupLayouts variants,
  `ImmersiveViewer`, `@tanstack/react-virtual`) now load on first open
  (`dynamic`, `ssr: false`, warmed on pointerenter/focus).

**Virtualization / code splitting — answer:** no further virtualization (the
PR #109 wave already windowed the modal filmstrips; gallery DOM is ~229
nodes; windowing the grid would hurt crawlability). Code splitting pays by
*interaction* (modals), not by section — marketing sections are already
Server Components, so `next/dynamic` on them buys nothing.

## Numbers

Dev mode (`pnpm dev`, Turbopack, unminified) on the dev box — comparable only
with each other. Probes: `e2e/public-perf-probes.spec.ts` (anonymous, 375 px).

| page | metric | before | after |
|---|---|---|---|
| `/` | HTML / RSC payload | 312 KB (anonymous GET) | 174 KB / 93 KB |
| `/` | logo bytes | 192 KB | 8.9 KB |
| `/fil` | HTML | 334 KB (anonymous GET) | 176 KB |
| `/pricing` | HTML / RSC payload | 213 KB / 190 KB | 58 KB / 34 KB |
| `/w/seed-owner-demo` | JS transferred | 1,626,628 B | 1,589,036 B |
| `/w/seed-owner-demo` | image bytes (logo leak) | 192 KB | 8.9 KB |
| `/` mobile | Lighthouse LCP / TBT / SI / weight (median of 3) | 10,979 ms / 4,368 ms / 4,184 ms / 1,760 KiB | 7,818 ms / 2,563 ms / 2,905 ms / 1,294 KiB |
| `/` desktop | Lighthouse LCP / TBT | 2,421 ms / 277 ms | 1,775 ms / 359 ms (n=1 — the run was reaped for memory) |
| `/w/seed-owner-demo` mobile | Lighthouse LCP / TBT | 2,741 ms / 2,684 ms | not captured (reaped) |

## Verification

- Scoped vitest + eslint per commit; `tsc --noEmit` after every task.
- `e2e/public-surfaces-sweep.spec.ts`: 5 locales × light/dark × 375/768/1280
  on `/`, `/pricing`, `/book-demo` (no overflow, no raw keys, no
  MISSING_MESSAGE/hydration errors, only the active scheme's assets fetched,
  old logo never requested); SEO head (`/fil` canonical, hreflang, unprefixed
  editorial links, robots allow rules, no redirect loop with a `fil` cookie, no
  hreflang `Link` header); tenant collection popup + lightbox open on first use
  (keyboard included). `e2e/marketing-landing.spec.ts` now reads its copy from
  the catalogs. All green.

## After deploy (owner)

1. Deploy, then Lighthouse on live `gallurio.com/` and a tenant page (mobile)
   against the "before" line above.
2. GSC → Pages → "Validate fix" on all three reasons; export the URL lists to
   confirm the causes above.
3. Re-check coverage and impressions in 2–4 weeks.

Follow-up, not in this branch: the home page renders per request (auth
redirect + `cf-ipcountry` geo pricing in `app/[locale]/(marketing)/page.tsx`);
moving the redirect into `proxy.ts` and streaming the pricing would cut TTFB.
