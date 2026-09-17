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
