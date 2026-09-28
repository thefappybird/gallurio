# Google Search Console coverage — plan of action

Source: exported GSC coverage report snapshot, 2026-07-18 to 2026-09-14 (`Chart.csv`, `Critical issues.csv`, `Metadata.csv`, `Non-critical issues.csv` in this folder). This is a plan for a future session — no fixes applied yet.

## Current state
- 48 indexed pages, 13 not-indexed as of the last date in the export (2026-09-14). Both counts jumped sharply on 2026-09-05 (indexed 4→48, not-indexed 4→13) — consistent with a broader public-page rollout landing around that date rather than a regression.
- Impressions are near-zero across the whole 2-month window (mostly 0-3/day, several 0-days). Expected for a new, low-authority domain, but this is the metric to actually watch going forward, not the raw indexed count.
- `Non-critical issues.csv` is empty — no non-critical issues reported.
- `Metadata.csv` confirms a single sitemap submitted covering "All known pages".

## The 3 reported issues (13 pages total, all "Not Started" validation)

### 1. Page with redirect — 8 pages (source: Website)
Likely cause, from the codebase: `lib/i18n/routing.ts` uses `localePrefix: "as-needed"`, so locale-prefixed URLs (`/en/...`, `/fil/...`, etc.) exist purely as redirect targets to the canonical unprefixed page — `app/robots.ts:28-31` documents this directly ("both forms are emitted ... the prefixed ones cover the redirect URLs that still get linked and crawled"). `app/sitemap.ts` itself only submits canonical unprefixed URLs (marketing pages + published tenant home/gallery), so these 8 were surfaced by Google crawling internal links/hreflang annotations, not the sitemap. Likely benign, but confirm rather than assume:
- Pull the actual 8 URLs from GSC (Search Console UI → Pages report → this reason; this CSV export only has the aggregate count).
- Confirm each is a single 301/308 straight to its canonical target, not a redirect chain or one that eventually 404s.
- Confirm none of them are stale/renamed routes unrelated to the locale-prefix pattern.

### 2. Blocked by robots.txt — 1 page (source: Website)
Two robots sources exist in this repo — check both against the actual blocked URL:
- `app/robots.ts` — disallows `PRIVATE_SEGMENTS` (dashboard, bookings, clients, etc.) across every locale prefix, plus `/api/`; allows `/` and `/w/`, with `/portfolio-maker-demo` carved out of the `/portfolio` disallow via `ALLOW_OVERRIDES`.
- `app/(public)/w/[orgSlug]/robots.txt/route.ts` — per-tenant robots for custom-domain mode; returns a full `Disallow: /` when that workspace's `publicPage.seo.noindex` is `true`.

Steps:
- Pull the specific blocked URL from GSC.
- If it's a `/w/[orgSlug]` page: check whether that workspace's `seo.noindex` is intentionally set, or a bug.
- If it's a root-level path: check whether it should fall under `ALLOW`/`ALLOW_OVERRIDES` in `app/robots.ts` — same class of prefix-matching issue the code already works around for `/portfolio-maker-demo`.

### 3. Crawled – currently not indexed — 4 pages (source: Google systems)
This is Google's own quality/relevance call, not a technical block — needs a content pass, not a config fix:
- Identify the 4 URLs via GSC.
- Check for thin content, near-duplicate content across tenant portfolios, weak metadata, or missing canonical tags.
- This is `senior-seo-auditor` agent territory (metadata, structured data, canonical URLs, heading structure on public surfaces) — dispatch it once the URLs are known.
- Improve internal linking to these pages if they're legitimately low-authority/orphaned.

## Next session checklist
1. Open GSC → Pages report → filter by each of the 3 reasons above, export the actual URL lists (this export only has aggregate counts, not URLs).
2. Cross-reference each URL against `app/robots.ts`, `app/sitemap.ts`, and `lib/i18n/routing.ts` to classify as expected-and-benign vs. a real bug.
3. For the 4 "crawled – not indexed" pages, dispatch `senior-seo-auditor` once URLs are known.
4. Re-check the coverage trend in 2-4 weeks after any fix — GSC re-crawl/re-index lag is typically days to weeks, and impressions (not indexed count) are the real health signal here.
5. Update or close this doc once GSC reflects the fix.

---

# Approved plan (2026-09-28, branch `fix/seo-indexing-issues`)


Branch: `fix/seo-indexing-issues` (currently == `dev` after PR #109 merge). One PR to `dev`.

## Context

`docs/gallurio.com-Coverage-2026-09-17/` (GSC export) reports 8 "Page with redirect", 1 "Blocked by robots.txt", 4 "Crawled – currently not indexed". The export has counts only, no URLs — so causes were traced against the **live site** + code. The user also suspects the marketing home is slow and asked whether public pages need virtualization / code splitting.

**Live evidence (prod, 2026-09-28; `origin/prod` is 2026-09-15, i.e. BEFORE the PR #109 perf wave):**
- Lighthouse mobile `gallurio.com/`: score 63 · FCP 2.0 s · **LCP 4.9 s** · TBT 650 ms · 899 KiB. Slowness is confirmed.
- Lighthouse mobile tenant `dasig-studios.gallurio.com/`: score 52 · **LCP 8.7 s** · TBT 750 ms · 1.9 MB (7 background-slideshow images preloaded at `w=2000`, all pre-wave code).

### Root causes found

GSC:
1. **Redirect (8)** — `lib/seo/metadata.ts:11` `localeUrl(locale, "/")` → `https://gallurio.com/fil/`; canonical AND hreflang of every localized home point at `/fil/ /id/ /ar/ /th/`, which 308 → `/fil` etc. Plus the localized header/footer link to `/fil/compare`, `/fil/resources` (next-intl `Link`, `marketing-header.tsx:80,86,143,146`, `marketing-footer.tsx:55,58`) which 308 to the English-only editorial URLs. Remaining redirects (`http://`, `www.`, `/w/<slug>` → subdomain) are correct and benign.
2. **Blocked by robots (1)** — `app/robots.ts:42` re-opens only unprefixed `/portfolio-maker-demo`; `Disallow: /fil/portfolio` (prefix match) blocks `/fil/portfolio-maker-demo`, which every localized page links to. The page is `noindex` — Google must be allowed to crawl it to see that. (`/sign-in`, `/sign-up` are also disallowed and linked; intentional, left as is.)
3. **Crawled – not indexed (4)** — likely the localized homes whose canonical points at a redirecting URL (fixed by 1); otherwise Google's quality call — no code fix; verify via GSC after deploy.

Marketing perf:
- `app/[locale]/layout.tsx:76` mounts `<NextIntlClientProvider>` without `messages` → the **entire 195 KB `en.json` catalog** (`app` namespace alone 97 KB) is serialized into every marketing page. Home HTML = 293 KB, of which 226 KB is RSC payload. Marketing client components need only `marketing.{nav,appInfo,footer,pricingTeaser,pricing,bookDemo,…}` + `plans` + a few shared keys (~5–10 KB).
- `/brand/gallurio-sq.svg` is **260 KB** (a raster embedded in SVG), preloaded with `priority`, displayed at 24–48 px — the single largest resource on the home page (188 KB transferred).
- `components/app/ambient-background.tsx` pulls `motion/react` for a slow infinite drift, and preloads BOTH light and dark 51 KB SVGs (`priority`) regardless of theme.
- `_components/themed-shot.tsx` is a client component that SSRs the light screenshot then swaps to dark after mount → dark visitors download both, and ~9 client islands hydrate just to pick an image.

Tenant perf (on `dev`, post-wave):
- `ContainerBackgroundSlideshow.tsx:117` mounts every slide; `loading="lazy"` does not help because the hidden layers are in the viewport → all slides download at first paint, competing with LCP.
- `GalleryLightboxTrigger.tsx:11` and `FeaturedCollectionsClient.tsx:6` statically import `Lightbox` / `CollectionPopup`, so the whole modal chain (4 `imageModal` + 4 `popupLayouts` variants, `ImmersiveViewer`, `@tanstack/react-virtual`) ships at hydration although it only renders when a visitor opens an image.

### Answer to "do we need virtualization / code splitting?"
- **Virtualization: no further.** The wave already windowed the lightbox/popup filmstrips; gallery DOM is 229 nodes. Windowing the grid itself would hurt crawlability for no measurable gain.
- **Code splitting: yes, but by *interaction*, not by section.** Marketing sections are already Server Components — `next/dynamic` on them buys nothing. The wins are removing client JS (motion, ThemedShot) and the message catalog, and loading the tenant image modals on first open.

## Decisions taken (amend at approval if wrong)
- Keep `/sign-in` and `/sign-up` disallowed in robots (intended; GSC flags it informationally).
- Home stays per-request rendered (auth-redirect + `cf-ipcountry` geo pricing in `page.tsx:39,52`). Moving the redirect into `proxy.ts` + streaming pricing is a separate TTFB follow-up, not in this PR.
- Screenshot PNGs untouched — `/_next/image` already serves them as ~35 KB WebP.
- Seeded `/w/[orgSlug]` pages are the tenant measurement surface; prod numbers get re-measured after deploy (the box can't `next build`; branch numbers are dev-mode per the existing recipe in `docs/portfolio/puck-023-followups.md` item 13).

## Tasks (serialized implementers — tdd-guard shared state; one commit each; orchestrator `tsc --noEmit` after each)

**T0 — probe spec (before any code change).** New `e2e/public-perf-probes.spec.ts` reusing `measureFirstLoadJs` (`e2e/helpers.ts`): per page record HTML bytes, RSC-payload bytes (`self.__next_f` text), transferred JS, image request count + bytes. Pages: `/`, `/fil`, `/pricing`, `/w/seed-owner-demo`, `/w/seed-owner-demo/gallery`. Records only.

**T1 — SEO (backend seat).**
- `lib/seo/metadata.ts` `localeUrl`: root path yields no trailing slash for prefixed locales (`/fil`, not `/fil/`). Tests in `lib/seo/metadata.test.ts` for home canonical + every hreflang entry.
- `app/robots.ts`: `ALLOW_OVERRIDES` expanded across `PATH_PREFIXES` (`/fil/portfolio-maker-demo`, …). Test asserts every localized override is present and still longer than its matching disallow.

**T2 — scope the client message catalog (frontend seat).**
- Root `app/[locale]/layout.tsx`: provider gets `messages={pick(allMessages, ROOT_CLIENT_KEYS)}` (only what root-level client UI needs, e.g. `common`, `notFound`).
- `(marketing)/layout.tsx`: nested provider with `MARKETING_CLIENT_KEYS` (dotted sub-keys, so `marketing.privacy`/`terms` bodies — 19 KB — stay server-only; only the strings footer uses).
- Every non-marketing branch keeps today's behaviour via a bare `<NextIntlClientProvider>` (inherits full catalog): existing layouts `(app)`, `(auth)`, `(onboarding)`; thin new `layout.tsx` for `billing`, `inquiry-redirect`, `invite`, `portfolio-maker-demo`, `portfolio-preview`, `subscribe`.
- Key lists live in one module (e.g. `lib/i18n/clientMessages.ts`); register in `REUSABLE_CODE.md`.
- Guard test: static scan of `"use client"` files under `(marketing)` + the shared components they import (explicit list) → every `useTranslations("ns")` namespace is covered by `MARKETING_CLIENT_KEYS`.

**T3 — marketing client weight (frontend seat).**
- Logo: generate a small transparent raster (`public/brand/gallurio-sq-128.png`, via sharp from the existing SVG) and repoint the 6 usages (`marketing-header.tsx:41`, `marketing-footer.tsx:34`, `(auth)/layout.tsx:33`, `step-shell.tsx:78`, `StoryPromptDialog.tsx:478`, `app/not-found.tsx:26` + its test). Keep the SVG file. Confirm the tenant page no longer references it on `dev`.
- `AmbientBackground`: drop `motion/react`; same drift as a CSS keyframe in `globals.css` with `motion-reduce:` fallback; Server Component; light/dark via `dark:hidden` / `hidden dark:block` without `priority` (hidden image never loads). Shared with auth/onboarding — same visual.
- `ThemedShot`: Server Component rendering both variants with `dark:hidden` / `hidden dark:block`, lazy — only the visible one downloads, no post-mount swap/flash. Update any test pinning the old swap.
- Editorial links in header (desktop + mobile) and footer → plain `next/link` to `/resources`, `/compare` (English-only targets; no locale prefix → no redirect).

**T4 — tenant first load (frontend seat).**
- `ContainerBackgroundSlideshow`: mount only the active and next slide (cross-fade still has both layers); first slide `fetchPriority="high"`. Test: N-image slideshow renders ≤ 2 `<img>` and advances.
- `lib/page-builder/blocks/lazy.ts`: add `LazyLightbox` and `LazyCollectionPopup` (`ssr: false` — they only render when open). Use them in `GalleryLightboxTrigger.tsx` and `FeaturedCollectionsClient.tsx`; warm the chunk on tile `pointerenter`/`focus` via the same `import()`. Update tests that expected the modal synchronously (`findBy…`). Canvas/preview/publish parity: `blockSweep.test.tsx` must stay green.
- Portfolio template impact: none expected (no block props/defaults change) — executor confirms.

**T5 — review.** `senior-reviewer` over the full diff (SEO correctness, missing-message risk, parity, tests). Fixes dispatched to an executor.

**T6 — docs.** Rewrite `docs/gallurio.com-Coverage-2026-09-17/plan-of-action.md` into the single summary: causes, fixes, before/after table, post-deploy GSC checklist. Only changed doc besides `REUSABLE_CODE.md`.

## Verification

Static, per task: scoped `pnpm test --run <fragment>` + eslint by the executor; `tsc --noEmit` by the orchestrator, one at a time.

Browser (orchestrator only, dev server alone on the box, 3 runs max):
1. **Run 1 — baseline** (after T0, before T1): probe spec + dev-mode Lighthouse `/` and `/w/seed-owner-demo`, mobile + desktop, median of 3.
2. **Run 2 — after** (after T5): same probes/Lighthouse; plus the public-surface sweep on `/`, `/pricing`, `/book-demo`, `/fil`: 375/768/1280 × 5 locales × light/dark — no `MISSING_MESSAGE` console errors, no raw keys, rendered strings match catalogs, `ar` RTL in-bounds, dark shows dark screenshot with no light request, ambient art present. Tenant: slideshow advances, lightbox + collection popup open and navigate. `curl`-style checks on the dev server: `/fil` canonical = `/fil`, hreflang has no trailing slash, `/robots.txt` allows `/fil/portfolio-maker-demo`, localized header links hit `/compare` directly.
3. Run 3 reserved for a single retry.

Expected movement: home HTML −200 KB+ (RSC payload), −188 KB logo, −1 SVG bg, motion chunk gone from marketing; tenant first-load JS drops by the modal chain; tenant LCP competition reduced to ≤ 2 slide images.

**After merge + deploy (user):** Lighthouse on live `gallurio.com/` and a tenant page; GSC → Pages → "Validate fix" on all three reasons; re-check in 2–4 weeks.
