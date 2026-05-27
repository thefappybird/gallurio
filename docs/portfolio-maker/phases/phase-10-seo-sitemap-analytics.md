# Phase 10 — SEO, sitemap, JSON-LD, basic analytics, dashboard tile

> Parent: `../master-plan.md`
> Branch: `feat/page-builder-seo-and-analytics` cut from `dev` (post-Phase-9).
> Closes out MVP — makes portfolios discoverable + measurable.

---

## Context

By Phase 9 the full editor + public site + lead loop work. Phase 10 is the **polish + measurement** layer that makes the feature ship-ready:

1. Sitemap / robots so Google can find published portfolios.
2. JSON-LD LocalBusiness so rich snippets show in search.
3. A minimal `AnalyticsEvent` model + ingestion endpoint for view / cta-click / form-open / form-submit.
4. A dashboard tile showing views + inquiries + conversion rate per workspace.

We deliberately defer this to the end because the simpler the analytics layer, the easier it is to add later — and we wanted real submission and editor data flowing before deciding what's worth measuring.

---

## Acceptance criteria

- `app/sitemap.ts` produces a sitemap including:
  - The marketing landing page.
  - For each workspace where `publicPage.publishedAt !== null`: `/w/<slug>` and `/w/<slug>/gallery`. Use `lastPublishedAt` (or `updatedAt` fallback) as `lastmod`.
  - Unpublished workspaces are excluded.
  - Returns appropriate caching headers (revalidate every hour is fine).
- `app/robots.ts` allows the marketing root and `/w/*`; blocks `/api`, `/dashboard`, `/page-builder`, `/inquiries`, `/settings`, `/onboarding`, `/sign-in`, `/sign-up`.
- Public Home (`/w/[orgSlug]`) emits `<script type="application/ld+json">` with a `LocalBusiness` JSON-LD object using:
  - `@type` from `workspace.businessType` mapping (photographer → `Photograph`, venue → `EventVenue`, planner → `EventPlanner`, etc.).
  - `name`, `description` from workspace + branding + SEO.
  - `logo`, `image` from branding.
  - `address`, `areaServed`, `telephone`, `email` if present.
  - `url` = canonical public URL.
  - `sameAs` = social links if collected (not yet — defer if not in branding model).
- Gallery page emits a minimal JSON-LD `ImageGallery` with the items.
- `AnalyticsEvent` Mongo model:
  ```ts
  {
    workspaceId: ObjectId,
    event: "view" | "cta_click" | "form_open" | "form_submit",
    path: string,                  // "/w/<slug>" or "/w/<slug>/gallery"
    sessionId: string,             // client-generated, persisted in localStorage
    deviceClass: "mobile" | "tablet" | "desktop",
    utm: { source?, medium?, campaign? },
    referrer: string | null,
    createdAt: Date,
  }
  ```
  Indexes: `{ workspaceId: 1, createdAt: -1 }`, `{ workspaceId: 1, event: 1, createdAt: -1 }`.
- `POST /api/analytics/event` accepts `{ workspaceSlug, event, path, sessionId, deviceClass, utm, referrer }`:
  - Resolves slug → workspace ID server-side.
  - Drops obvious bots (UA matches `bot|crawler|spider|preview`).
  - Rate-limits per IP per minute to prevent spam.
  - Writes the event; returns 204.
  - **No PII** — sessionId is opaque, no IPs stored.
- Public pages emit:
  - `view` on initial load (debounced per session per path).
  - `cta_click` when any `[data-cta="contact"]` element is clicked.
  - `form_open` when the contact modal opens.
  - `form_submit` after a successful POST to `/api/inquiries`.
- Dashboard tile on `/dashboard`: shows last-7-day **views**, **inquiries**, and **conversion rate** (inquiries / views).
- Inquiry list page (Phase 7) gets a small per-day sparkline of view + submission counts.
- Tests:
  - `analyticsEvent.test.ts`: bot UAs rejected, rate limit enforced, cross-workspace isolation.
  - `dashboardMetrics.test.ts`: counts and conversion math correct with fixed seed data.
  - `sitemap.test.ts`: unpublished workspaces excluded; published included with correct lastmod.
  - JSON-LD includes required fields and validates via `schema-dts` (or a manual schema check) for at least the LocalBusiness case.
- `pnpm test --run analytics sitemap dashboard-metrics` passes.

---

## File map

```
app/sitemap.ts
app/sitemap.test.ts
app/robots.ts

app/(public)/w/[orgSlug]/_components/
  LocalBusinessJsonLd.tsx
  ImageGalleryJsonLd.tsx
  AnalyticsClient.tsx                       # initializes sessionId + sends view event
  CtaClickTracker.tsx                       # delegates [data-cta="contact"] click events

app/api/analytics/event/
  route.ts
  route.test.ts

lib/db/models/AnalyticsEvent.ts
lib/db/models/AnalyticsEvent.test.ts

lib/db/queries/analytics.ts                 # countByWorkspace, conversionRate, dailySeries
lib/db/queries/analytics.test.ts

app/[locale]/(app)/dashboard/
  _components/
    PortfolioPerformanceTile.tsx
    PortfolioPerformanceTile.test.tsx
```

---

## JSON-LD example (LocalBusiness)

```tsx
// app/(public)/w/[orgSlug]/_components/LocalBusinessJsonLd.tsx
const TYPE_MAP: Record<BusinessType, string> = {
  photographer: "PhotographyBusiness",
  venue: "EventVenue",
  planner: "EventPlanner",
  stylist: "BeautySalon",
  catering: "FoodEstablishment",
  entertainer: "MusicGroup",
  other: "LocalBusiness",
};

export function LocalBusinessJsonLd({ workspace, baseUrl }: Props) {
  const data = {
    "@context": "https://schema.org",
    "@type": TYPE_MAP[workspace.businessType] ?? "LocalBusiness",
    name: workspace.name,
    description: workspace.branding.description || undefined,
    image: workspace.branding.logoUrl || undefined,
    url: `${baseUrl}/w/${workspace.slug}`,
    logo: workspace.branding.logoUrl || undefined,
    // address: workspace.branding.address ? { ... } : undefined,
    telephone: workspace.branding.phone || undefined,
    email: workspace.branding.email || undefined,
  };
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(data) }}
    />
  );
}
```

Embed in `app/(public)/w/[orgSlug]/page.tsx` and the gallery `page.tsx` (with the gallery variant).

---

## Analytics client setup

Mount `<AnalyticsClient workspaceSlug={...} path={...} />` once in the public layout. It:

1. Reads / generates a `sessionId` in `localStorage` (UUID, no PII).
2. Reads `?utm_*` from `window.location.search`.
3. POSTs a `view` event on mount.
4. Sets up the `CtaClickTracker` delegate for `[data-cta="contact"]` clicks.
5. The contact modal Phase 5 fires `form_open` on open and `form_submit` after a successful POST — wire those in by importing a tiny `track(event, payload)` helper.

Helper API:

```ts
// lib/analytics/track.ts (public-page-only client helper)
export function track(event: "view" | "cta_click" | "form_open" | "form_submit", path: string, workspaceSlug: string) {
  // POST to /api/analytics/event with sessionId/deviceClass/utm/referrer
  // Best-effort: catch and swallow errors, never block UX
}
```

---

## Dashboard tile

`PortfolioPerformanceTile` queries `AnalyticsEvent` for the active workspace, last 7 days. Shows three numbers:

- **Views** (count of `view` events, unique by `sessionId+path`)
- **Inquiries** (count of `Inquiry` documents created in the same window)
- **Conversion rate** (`inquiries / views * 100`)

Plus a 7-day sparkline of views.

Use the existing dashboard card layout. The tile is hidden for workspaces with `publicPage.publishedAt === null` (replaced by a "Publish your portfolio to start tracking" prompt with a link to `/page-builder`).

---

## Verification

```bash
pnpm test --run analytics sitemap dashboard-metrics
pnpm typecheck
pnpm build
pnpm dev
# Visit /w/<slug> in two browsers, verify:
#   - sitemap.xml lists the slug
#   - robots.txt blocks /dashboard
#   - View source: <script type="application/ld+json"> present
#   - AnalyticsEvent docs created
#   - Dashboard tile updates after a few minutes (no caching beyond Mongo)
```

Final pre-merge sweep (per CLAUDE.md merge policy):

```bash
pnpm test       # full sweep
pnpm typecheck
pnpm build
# Then spin Opus agent for code review of the full feature delta
```

---

## Out of scope

- A/B testing infrastructure.
- Conversion attribution to specific blocks/CTAs (could be a v1.1 enhancement once we have enough data to know what's interesting).
- Geographic/heatmap visualizations.
- Email open / click tracking.
- Third-party analytics integration (Plausible/PostHog/GA) — `AnalyticsEvent` model is the only store in MVP.
- Performance budgets / Core Web Vitals monitoring — out of scope; check Lighthouse manually pre-merge.

---

## Branch & merge

```
git checkout dev
git checkout -b feat/page-builder-seo-and-analytics
```

After this lands and the full feature passes:
- Full locale catalogue consolidation pass.
- `pnpm test`, `pnpm typecheck`, `pnpm build`.
- Opus code review.
- Merge `dev` → decide together when to merge to `master`.
