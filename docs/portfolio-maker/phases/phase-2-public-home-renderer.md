# Phase 2 — Public Home renderer

> Parent: `../master-plan.md`
> Branch: `feat/page-builder-public-home` cut from `dev` (post-Phase-1).
> First public surface. No blocks yet — renders a "Coming soon" fallback with workspace branding when `data.home` is null.

---

## Context

Phase 1 established the Puck config and brand-kit context with an **empty** block registry. Phase 2 stands up the public route that consumes that scaffolding. Until Phase 3 ships real blocks, the renderer still has to:

- Resolve `orgSlug` → `Workspace` safely (no client-supplied IDs).
- Block unpublished workspaces (`publishedAt === null` → 404).
- Apply brand kit CSS variables to the page wrapper.
- Render a graceful fallback when no Puck data exists yet.
- Produce correct metadata (SEO title/description, OG, canonical) using workspace branding as fallback.
- Pick the correct locale from `workspace.country` via the existing `localeForCountry` helper.

This phase also extends the `Workspace` schema to the canonical Phase-2+ shape so later phases don't need to thrash it.

---

## Acceptance criteria

- `app/(public)/w/[orgSlug]/layout.tsx` and `page.tsx` exist and pass typecheck.
- Visiting `/w/<slug>` for a workspace with `publishedAt === null` returns 404.
- Visiting `/w/<slug>` for a published workspace with `data.home === null` renders a branded "Coming soon" fallback — workspace name, logo, primary color applied.
- Visiting `/w/<slug>` for a published workspace with `data.home` populated calls Puck's `<Render data={data.home} config={puckConfig} />`. Since Phase 1 has no blocks, this is verified via unit test using a mocked block until Phase 3 ships.
- Metadata: `title = publicPage.seoTitle || workspace.name`, `description = publicPage.seoDescription || branding.tagline`, OG image = `branding.logoUrl` (if set), canonical = absolute URL to `/w/<slug>`.
- Brand kit CSS variables applied to the outer wrapper only — no leak into app chrome (verified by visual inspection: open `/dashboard` in the same browser and confirm no theme drift).
- Locale picked from `workspace.country` via `localeForCountry`, not from `Accept-Language`.
- **Tenant isolation test** with `mongodb-memory-server`: workspace A's slug never resolves to workspace B's data; mismatched casing handled by existing `lowercase: true` slug normalization.
- `pnpm typecheck`, `pnpm test --run public/w`, `pnpm build` all pass.

---

## Schema changes

### Extend `Workspace.publicPage` (`lib/db/models/Workspace.ts`)

Replace the current `data: Mixed` with the typed two-zone shape and add the `brandKit` subdocument. Add `latestVersion` and `lastPublishedAt` for future use by Phase 9.

```ts
publicPage: {
  templateId: { type: String, enum: PUBLIC_PAGE_TEMPLATES, default: "default" },
  data: {
    home: { type: Schema.Types.Mixed, default: null },
    gallery: { type: Schema.Types.Mixed, default: null },
  },
  brandKit: {
    themePreset: { type: String, enum: BRAND_KIT_THEME_PRESETS, default: "minimal" },
    fontPair: { type: String, enum: BRAND_KIT_FONT_PAIRS, default: "merriweather-only" },
    primaryColor: { type: String, default: "#111111" },
    secondaryColor: { type: String, default: "#f5f5f5" },
    accentColor: { type: String, default: "#2f5d56" },
    backgroundColor: { type: String, default: "#ffffff" },
    foregroundColor: { type: String, default: "#111111" },
    radius: { type: String, enum: BRAND_KIT_RADII, default: "sharp" },
    buttonStyle: { type: String, enum: BRAND_KIT_BUTTON_STYLES, default: "solid" },
  },
  publishedAt: { type: Date, default: null },
  lastPublishedAt: { type: Date, default: null },
  latestVersion: { type: Number, default: 0 },
  seoTitle: { type: String, default: "" },
  seoDescription: { type: String, default: "" },
  inquiryRecipientEmail: { type: String, default: "" },
  // legacy `blocks` removed — see migration note below
},
```

### Migration

Write a one-shot script `lib/db/migrations/2026-05-portfolio-page-shape.ts`:

1. For each workspace where `publicPage.data` is an object (old `Mixed`), wrap it: `data = { home: data, gallery: null }`.
2. For each workspace where `publicPage.data` is null, set `data = { home: null, gallery: null }`.
3. Drop the legacy `blocks` array (it was never populated in production).
4. Initialize `brandKit` from `workspace.branding.primaryColor` / `secondaryColor` and defaults for the rest.

Run via `pnpm tsx lib/db/migrations/2026-05-portfolio-page-shape.ts` once on dev DB. Include a `--dry-run` flag.

---

## Critical files

```
app/(public)/w/[orgSlug]/
  layout.tsx               # locale boundary, brand-kit wrapper, metadata
  page.tsx                 # Home renderer
  _components/
    PublicPageShell.tsx    # client wrapper if needed (contact modal trigger comes Phase 5)
    ComingSoonFallback.tsx # branded fallback for unpopulated `data.home`
  not-found.tsx            # 404 page

lib/db/queries/publicPage.ts        # findPublishedWorkspaceBySlug(slug) — single safe query
lib/db/queries/publicPage.test.ts
lib/db/migrations/2026-05-portfolio-page-shape.ts

lib/db/models/Workspace.ts          # schema update
```

---

## Query helper

```ts
// lib/db/queries/publicPage.ts
export async function findPublishedWorkspaceBySlug(slug: string) {
  await connectMongoose();
  const normalized = slug.trim().toLowerCase();
  if (!normalized) return null;
  const workspace = await Workspace.findOne({
    slug: normalized,
    "publicPage.publishedAt": { $ne: null },
  }).lean();
  return workspace ?? null;
}
```

Tested for: empty slug, mismatched case, unpublished workspace, cross-tenant isolation.

---

## Page implementation outline

```tsx
// app/(public)/w/[orgSlug]/page.tsx
import { Render } from "@measured/puck";
import { puckConfig, resolveBrandKit, DEFAULT_BRAND_KIT } from "@/lib/page-builder";
import { findPublishedWorkspaceBySlug } from "@/lib/db/queries/publicPage";
import { ComingSoonFallback } from "./_components/ComingSoonFallback";
import { notFound } from "next/navigation";

export default async function PortfolioHomePage({
  params,
}: { params: Promise<{ orgSlug: string }> }) {
  const { orgSlug } = await params;
  const workspace = await findPublishedWorkspaceBySlug(orgSlug);
  if (!workspace) notFound();

  const brandKit = workspace.publicPage.brandKit ?? DEFAULT_BRAND_KIT;
  const { cssVars, className } = resolveBrandKit(brandKit);
  const homeData = workspace.publicPage.data?.home ?? null;

  return (
    <div style={cssVars} className={className}>
      {homeData
        ? <Render data={homeData} config={puckConfig} />
        : <ComingSoonFallback workspace={workspace} />}
    </div>
  );
}

export async function generateMetadata({ params }: { params: Promise<{ orgSlug: string }> }) {
  const { orgSlug } = await params;
  const workspace = await findPublishedWorkspaceBySlug(orgSlug);
  if (!workspace) return {};
  const { publicPage, branding, name } = workspace;
  return {
    title: publicPage.seoTitle || name,
    description: publicPage.seoDescription || branding.tagline || undefined,
    openGraph: {
      title: publicPage.seoTitle || name,
      description: publicPage.seoDescription || branding.tagline,
      images: branding.logoUrl ? [{ url: branding.logoUrl }] : undefined,
    },
    alternates: { canonical: `/w/${workspace.slug}` },
  };
}
```

---

## Tests

- `publicPage.test.ts`:
  - returns null for empty/whitespace slug
  - returns null for unpublished workspace
  - returns workspace for published + lowercased slug
  - cross-tenant: workspace A's slug never returns workspace B
- `app/(public)/w/[orgSlug]/page.test.tsx` (using `@testing-library/react`):
  - renders `ComingSoonFallback` when `data.home` is null
  - applies brand-kit CSS variables to the outer wrapper
  - metadata function produces fallback title/description from workspace name/tagline

---

## Verification

```bash
pnpm test --run public
pnpm typecheck
pnpm dev
# Visit http://localhost:3000/w/<seed-slug> with a published workspace
# Confirm: branding, no theme bleed into /dashboard
```

---

## Out of scope

- Real blocks (Phase 3).
- Gallery page (Phase 4).
- Contact modal (Phase 5).
- Sitemap/robots (Phase 10).

---

## Branch & merge

```
git checkout dev
git checkout -b feat/page-builder-public-home
# … work …
git commit -m "feat(public-page): renderer, schema migration, brand-kit wrapper"
```
