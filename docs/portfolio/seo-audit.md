# SEO Audit — Public Portfolio Surfaces (`/w/[orgSlug]`)

**Date:** 2026-06-28  
**Scope:** `app/(public)/w/[orgSlug]/` — Home, Gallery, Contact modal  
**Branch:** `finalize/portfolio-page`

---

## 1. Current State

### Files audited

| File | Role |
|------|------|
| `app/(public)/layout.tsx` | Public root layout — `<html>`/`<body>` shell |
| `app/(public)/w/[orgSlug]/layout.tsx` | Per-workspace shell — brand kit, header, contact modal |
| `app/(public)/w/[orgSlug]/page.tsx` | Home `generateMetadata` + render |
| `app/(public)/w/[orgSlug]/gallery/page.tsx` | Gallery `generateMetadata` + render |
| `lib/db/models/Workspace.ts` | Schema — `publicPage.seoTitle`, `.seoDescription`, `.siteIcon` |
| `lib/db/queries/publicPage.ts` | `findPublishedWorkspaceBySlug` |
| `lib/page-builder/blocks/GalleryGridBlock.tsx` | Photo grid — `<img>` rendering |
| `lib/page-builder/blocks/GalleryMasonryBlock.tsx` | Masonry layout — `<img>` rendering |
| `lib/storage/imageDelivery.client.ts` | Cloudflare Images URL builder |
| `lib/fonts/portfolio.ts` | Font loading — `display: "swap"`, `preload: false` |
| `lib/i18n/localeForCountry.ts` | Locale resolution for public chrome |

### Owner-editable SEO fields today

`Workspace.publicPage` exposes exactly two SEO fields and a site icon:

| Field | Schema | Validator | Used in |
|-------|--------|-----------|---------|
| `seoTitle` | `String, default: ""` | max 70 chars (`lib/validators/workspace.ts:122`) | Home `<title>`, OG title |
| `seoDescription` | `String, default: ""` | max 160 chars (`lib/validators/workspace.ts:123`) | Home and Gallery `<meta description>`, OG description |
| `siteIcon.url` | `String, default: ""` | valid URL | `<link rel="icon">` |

No other SEO-oriented owner inputs exist.

---

## 2. Findings by Area

### 2.1 Metadata — Title, Description, Template, Canonical, Robots

#### Critical

**C1 — No `metadataBase` in public root layout**  
File: `app/(public)/layout.tsx` (no export at all)  
Next.js resolves `alternates.canonical` values relative to `metadataBase`. Without it, both Home and Gallery emit `<link rel="canonical" href="/w/slug">` — a path-only relative canonical that browsers and crawlers interpret differently (typically treated as invalid). The OG `og:url` is also never set, so social scrapers get no authoritative URL.  
Fix: export `metadataBase: new URL(process.env.NEXT_PUBLIC_APP_URL ?? "https://example.com")` from the public root layout, or set it in each `generateMetadata`.

**C2 — `<html lang>` hardcoded `"en"` regardless of workspace locale**  
File: `app/(public)/layout.tsx:21` — `<html lang="en">`  
The per-workspace locale (fil, ms, id, ar) is resolved in `resolvePublicChromeLocale` and applied only to a `<div lang={locale}>` inside the slug layout (`app/(public)/w/[orgSlug]/layout.tsx:59`). Search engines read the `<html lang>` attribute for language detection. A Filipino-market workspace will be indexed as English content.  
Fix: the public root layout does not know the workspace locale. The slug layout must set `<html lang>` dynamically — this requires either a slot/portal approach or moving the `<html>` shell into the slug layout and making the root layout a passthrough `<>` fragment.

**C3 — No `dir` attribute on `<html>` — Arabic workspaces render LTR**  
File: `app/(public)/layout.tsx:21` — no `dir` attribute  
Arabic (`ar`) is a supported locale and RTL by design. The app shell sets `dir={isRtl(locale) ? "rtl" : "ltr"}` on its `<html>` (`app/[locale]/layout.tsx:44`) but the public root layout never sets `dir`. Arabic portfolio pages will render entirely LTR, breaking visual layout and crawler language signal.

> **C2 + C3 DEFERRED (2026-06-29, owner decision) — NOT implemented.** The public page is intentionally isolated from CRM
> language and stays hardcoded `<html lang="en">`; per-tenant public-page language + RTL chrome flip are a future spec. The
> owner builds their own DnD content in whatever language/direction they choose. Do NOT implement the `<html lang/dir>`
> restructuring. See memory `project_public_page_language_isolation`. (I4 localized gallery title is likewise left English.)

**C4 — No `og:image` — zero social share previews**  
Files: `app/(public)/w/[orgSlug]/page.tsx:38-43`, `app/(public)/w/[orgSlug]/gallery/page.tsx:29-34`  
Both `generateMetadata` functions return an `openGraph` object with `title` and `description` only. `og:image` is absent. When the portfolio URL is shared on Facebook, LinkedIn, WhatsApp, or iMessage, the platform renders a plain text card with no photo — the single most damaging omission for a photography advertising channel.

**C5 — No `twitter:*` / X card — zero Twitter/X previews**  
Both pages have no `twitter` key in their `Metadata` return. Twitter/X falls back to OG tags for the description but requires `twitter:card` and `twitter:image` for a visual card. Without these, shares are plain links.

**C6 — No `sitemap.xml`**  
No `app/sitemap.ts` and no `public/sitemap.xml` found. Google has no machine-readable list of published portfolio pages. In multi-tenant context this is especially damaging — each workspace slug is a unique URL that crawlers must discover organically (via links) rather than via the sitemap.

**C7 — No `robots.txt`**  
No `app/robots.ts` and no `public/robots.txt` found. Without it, no Sitemap directive can be served to crawlers. Also, app-shell routes (`/en/`, `/fil/`, etc.) and internal routes should be disallowed; currently there is nothing to enforce this.

#### Important

**I1 — Gallery description reuses home `seoDescription` — no per-page override**  
File: `app/(public)/w/[orgSlug]/gallery/page.tsx:23`  
`const description = publicPage?.seoDescription || undefined` — identical field as home. There is no `seoGalleryDescription` or similar. The Gallery page's meta description will always be the same as the home page, which is a duplicate-content signal to Google.

**I2 — `og:type`, `og:url`, `og:site_name` never set**  
Both `generateMetadata` functions set `openGraph.title` and `openGraph.description` but not `type` (defaults to `"website"` per OG spec — tolerable), `url` (distinct from canonical — should be the full absolute URL), or `site_name`. `og:url` is especially important: without it, some platforms use the page's referrer URL which may include utm parameters.

**I3 — No `robots` directive — pages not explicitly marked indexable**  
Neither page exports a `robots` field. Currently all published pages will be indexed (correct default), but there is no way for an owner to mark their page `noindex` while keeping it accessible, and no guard against development/staging environments accidentally being indexed (since there is no env-based override).

**I4 — Gallery page `<title>` hardcoded in English**  
File: `app/(public)/w/[orgSlug]/gallery/page.tsx:22`  
`const title = \`${name} — Gallery\`` — "Gallery" is hardcoded in English regardless of the workspace locale. A workspace with locale `fil` will have a title like "Studio Name — Gallery" (English word) instead of a localized equivalent. Minor SEO signal but inconsistent with i18n architecture.

**I5 — No JSON-LD structured data anywhere**  
Confirmed by grep: no `application/ld+json` script tags exist in any public page. For a photography/event-business portfolio this omits:
- `LocalBusiness` / `PhotographyBusiness` — the primary rich-result type for local search  
- `ImageGallery` — enables image indexing context on gallery page  
- `BreadcrumbList` — breadcrumb display in SERPs for gallery page  
- `WebSite` + `SearchAction` — site-name display in SERPs (home page)  

This is the largest single gap for structured-data rich results.

**I6 — `GalleryMasonryBlock` images cause CLS (no reserved height)**  
File: `lib/page-builder/blocks/GalleryMasonryBlock.tsx:193-198`  
Images render as `style={{ width: "100%", height: "auto" }}` with no `width`/`height` attributes and no `aspect-ratio` CSS. The browser cannot reserve vertical space before the image loads, so each image causes a layout shift. `GalleryGridBlock` avoids this with `aspectRatio: "1 / 1"` but masonry images do not have a fixed ratio.  
Fix: persist `width`/`height` alongside each `GalleryImage` from the Cloudflare upload response, then emit `width` and `height` HTML attributes and an inline `aspect-ratio: ${w}/${h}` CSS on each `<img>`.

**I7 — Favicon falls back to `header.logoUrl` — wrong file**  
Files: `app/(public)/w/[orgSlug]/page.tsx:33`, `app/(public)/w/[orgSlug]/gallery/page.tsx:24`  
`const iconUrl = workspace.publicPage?.siteIcon?.url || workspace.publicPage?.header?.logoUrl`  
The header logo is a full-width rectangular wordmark or brand image, not a square icon. Browsers and Google Search try to display favicons at 16×16 to 32×32 px; a landscape logo produces a crushed or cropped result. The fallback should be removed or replaced with a generic Gallurio mark.

**I8 — All gallery `<img>` default to empty `alt=""` — no SEO text**  
Files: `lib/page-builder/blocks/GalleryGridBlock.tsx:246`, `lib/page-builder/blocks/GalleryMasonryBlock.tsx:194`  
`alt={img.alt ?? ""}` — the `alt` field on `GalleryImage` is optional and owners rarely fill it. Empty alt is correct for decorative images but photography portfolio images are primary content. Google Image Search relies on alt text for indexing. Without alt text, gallery images are invisible to image search.

#### Minor

**M1 — No `<link rel="preload">` for above-fold hero images**  
Gallery images all carry `loading="lazy"` (`GalleryGridBlock.tsx:247`). If the gallery block is the LCP element (common for portfolio home pages with a hero photo grid), the first visible image should be `loading="eager"` + `fetchpriority="high"` and ideally preloaded via `<link rel="preload">`. Currently every image defers until intersection.

**M2 — All brand-kit fonts load with `preload: false`**  
File: `lib/fonts/portfolio.ts` — all nine font families set `preload: false`  
Correct for the authenticated app shell (which may not use any given family), but the active portfolio brand-kit font will never be preloaded. On a fresh page load the browser fetches it only after CSS is parsed, causing FOUT for any text rendered in that family. A selective preload for the active heading/body font pair would improve LCP and reduce CLS from FOUT.

**M3 — No `title` template configured for public pages**  
The `app/[locale]/layout.tsx:14-21` sets `{ title: { default: "Gallurio", template: "%s · Gallurio" } }` for the app shell. The public root layout has no metadata export at all. Public page titles are standalone and don't get a site-name suffix, which is acceptable but inconsistent for a branded product.

**M4 — `workspace.businessType` unused in metadata**  
File: `lib/db/models/Workspace.ts:54-58` — seven business type values exist (`photographer`, `venue`, `planner`, etc.). This field is never read in any `generateMetadata` function. It could power the JSON-LD `@type` (e.g. `"PhotographyBusiness"` vs `"FoodEstablishment"`) with zero owner input required.

**M5 — Contact nav item has no destination URL**  
The "Contact" nav link is a `<button>` that opens a modal, not an `<a>` to a URL. There is no `/w/[orgSlug]/contact` page. This is fine architecturally but means:
- There is no contact page to include in the sitemap
- Crawlers see a non-navigable "Contact" item, which provides no crawl path
- Internal link equity for the contact content is zero

**M6 — No apple-touch-icon or 512×512 PWA icon**  
Only `icons.icon` is set. Apple devices use `apple-touch-icon` for add-to-homescreen; Google Chrome uses a 512×512 icon for install prompts. Neither is generated.

**M7 — `not-found.tsx` has no metadata robots noindex**  
File: `app/(public)/w/[orgSlug]/not-found.tsx` — no metadata export. The 404 page has a valid `<h1>` but could accumulate unwanted index entries if a slug 404 is cached with a 200 status. A `robots: { index: false }` export is defensive hygiene.

---

## 3. Proposed Owner-Input SEO Fields

These are NEW fields to add to `Workspace.publicPage` (or a `publicPage.seo` sub-object). The P0 set is the minimum for a photography portfolio to function as a real advertising channel.

### Priority table

| Priority | Field name | Type | What it powers | Validation | Default / auto-derive | Effort |
|----------|-----------|------|---------------|-----------|----------------------|--------|
| **P0** | `seo.ogImageUrl` | String (URL) | `og:image`, `twitter:image` — the social share card image | Valid URL, Cloudflare Images host | None (empty = no card) | S — new upload + field |
| **P0** | `seo.ogImageAssetId` | String | Paired with `ogImageUrl` for delete-on-replace | Non-empty if set | None | S — stored alongside URL |
| **P0** | `seo.galleryDescription` | String | Gallery page `<meta description>`, gallery OG description | max 160 chars | Auto: `"{name} — Photography Portfolio"` | XS — field + validator + metadata |
| **P0** | `seo.canonicalBase` (env override, not per-workspace) | — | `metadataBase` for correct absolute canonicals | — | `NEXT_PUBLIC_APP_URL` env var | XS — one-line fix in root layout |
| **P0** | `seo.noindex` | Boolean | `<meta name="robots" content="noindex">` — lets owner hide draft/soft-launch pages | — | `false` | XS — field + robots export |
| **P1** | `contact.instagram` *(already exists: `workspace.contact.socials.instagram`)* | — | `sameAs` in JSON-LD LocalBusiness | — | Already stored | XS — wire to JSON-LD |
| **P1** | `contact.facebook` *(already exists)* | — | `sameAs` in JSON-LD | — | Already stored | XS — wire to JSON-LD |
| **P1** | `seo.twitterHandle` | String | `twitter:creator` card tag | `@`-prefixed, max 15 chars | None | XS |
| **P1** | `seo.businessCategory` | String (enum) | JSON-LD `@type` (overrides auto-derive from `businessType`) | Subset of schema.org LocalBusiness subtypes | Auto from `workspace.businessType` | XS |
| **P1** | `seo.serviceArea` | String | JSON-LD `LocalBusiness.areaServed` — e.g., "Metro Manila" | max 100 chars | None | XS |
| **P1** | `seo.priceRange` | String | JSON-LD `LocalBusiness.priceRange` — e.g., "₱₱₱" | max 10 chars, regex `[₱$€£¥]{1,5}` | None | XS |
| **P1** | `seo.googleSiteVerification` | String | `<meta name="google-site-verification">` | hex/base64 token, max 68 chars | None | XS |
| **P2** | `seo.homePageTitle` | String | Per-page title override for Home (separate from global `seoTitle`) | max 70 chars | Falls back to `seoTitle` | S — requires per-page title field |
| **P2** | `seo.galleryTitle` | String | Gallery page `<title>` override (currently hardcoded `"${name} — Gallery"`) | max 70 chars | Auto: `"{name} — Gallery"` in workspace locale | XS |
| **P2** | `seo.keywords` | String[] | `<meta name="keywords">` — low direct ranking signal but useful for brand-kit autofill in JSON-LD | Array of strings, max 10, each max 30 chars | None | S |
| **P2** | `seo.openingHours` | String | JSON-LD `LocalBusiness.openingHours` — e.g., "Mo-Fr 09:00-17:00" | Schema.org OpeningHours spec | None | S |
| **P2** | `seo.address` *(already exists: `workspace.contact.address`)* | — | JSON-LD `LocalBusiness.address` (PostalAddress) | — | Already stored | XS — parse + wire |

### Notes on existing fields that can be wired without new inputs

The following are already stored in `Workspace` and can be used immediately in metadata/JSON-LD without any new owner UI:

- `workspace.contact.email` → JSON-LD `LocalBusiness.email`
- `workspace.contact.phone` → JSON-LD `LocalBusiness.telephone`
- `workspace.contact.address` → JSON-LD `LocalBusiness.address`
- `workspace.contact.socials.instagram/facebook/tiktok/website` → JSON-LD `LocalBusiness.sameAs[]`
- `workspace.businessType` → JSON-LD `@type` mapping (see §4)

---

## 4. JSON-LD Schema Specification

### 4.1 `@type` mapping from `workspace.businessType`

| `businessType` value | Recommended JSON-LD `@type` |
|---------------------|----------------------------|
| `photographer` | `PhotographyBusiness` |
| `venue` | `EventVenue` |
| `planner` | `LocalBusiness` (no specific subtype) |
| `stylist` | `HairSalon` (closest; or `LocalBusiness`) |
| `catering` | `FoodEstablishment` |
| `entertainer` | `PerformingArtsTheater` or `LocalBusiness` |
| `other` | `LocalBusiness` |

### 4.2 Home page JSON-LD blocks

**Block A — `LocalBusiness` / subtype (on every page, but authoritative on home)**

```json
{
  "@context": "https://schema.org",
  "@type": "PhotographyBusiness",
  "name": "{workspace.name}",
  "url": "https://example.com/w/{slug}",
  "image": "{seo.ogImageUrl or siteIcon.url}",
  "description": "{seoDescription}",
  "telephone": "{contact.phone}",
  "email": "{contact.email}",
  "address": {
    "@type": "PostalAddress",
    "streetAddress": "{contact.address}",
    "addressRegion": "{seo.serviceArea}"
  },
  "areaServed": "{seo.serviceArea}",
  "priceRange": "{seo.priceRange}",
  "sameAs": [
    "https://www.instagram.com/{contact.socials.instagram}",
    "https://www.facebook.com/{contact.socials.facebook}",
    "https://www.tiktok.com/@{contact.socials.tiktok}",
    "{contact.socials.website}"
  ]
}
```

**Block B — `WebSite` + `SearchAction` (home page only)**

```json
{
  "@context": "https://schema.org",
  "@type": "WebSite",
  "name": "{workspace.name}",
  "url": "https://example.com/w/{slug}"
}
```

### 4.3 Gallery page JSON-LD blocks

**Block C — `ImageGallery`**

```json
{
  "@context": "https://schema.org",
  "@type": "ImageGallery",
  "name": "{name} — Gallery",
  "url": "https://example.com/w/{slug}/gallery",
  "author": {
    "@type": "PhotographyBusiness",
    "name": "{workspace.name}",
    "url": "https://example.com/w/{slug}"
  }
}
```

**Block D — `BreadcrumbList` (gallery page)**

```json
{
  "@context": "https://schema.org",
  "@type": "BreadcrumbList",
  "itemListElement": [
    { "@type": "ListItem", "position": 1, "name": "{workspace.name}", "item": "https://example.com/w/{slug}" },
    { "@type": "ListItem", "position": 2, "name": "Gallery", "item": "https://example.com/w/{slug}/gallery" }
  ]
}
```

---

## 5. Sitemap Architecture

Because `/w/[orgSlug]` is outside the `[locale]` segment, it has no locale variants. Each published workspace contributes exactly two sitemap entries (three if a contact page URL existed — it does not):

```
/w/{slug}           — Home
/w/{slug}/gallery   — Gallery
```

**Recommended implementation:** `app/sitemap.ts` using Next.js `MetadataRoute.Sitemap`:

```ts
// Fetches all workspaces where publicPage.publishedAt !== null.
// Must be paginated (sitemapSize) or split into per-workspace sitemap indexes
// if the tenant count grows past 50,000.
export default async function sitemap(): Promise<MetadataRoute.Sitemap> { ... }
```

Each entry should include `lastModified: workspace.publicPage.lastPublishedAt`, `changeFrequency: "weekly"`, and `priority: 0.8` (home) / `0.6` (gallery).

**Recommended robots.txt implementation:** `app/robots.ts`

```ts
export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      { userAgent: "*", allow: "/w/", disallow: ["/en/", "/fil/", "/ms/", "/id/", "/ar/", "/api/"] },
    ],
    sitemap: `${process.env.NEXT_PUBLIC_APP_URL}/sitemap.xml`,
  };
}
```

---

## 6. hreflang / i18n

Public portfolio pages do **not** have locale variants — there is one URL per workspace (`/w/slug`), served in the workspace's chosen chrome locale. Therefore `hreflang` alternate links are **not applicable** here. Do not add spurious `hreflang` tags.

What IS required (and currently broken — see C2, C3):
- `<html lang="{resolvedLocale}">` — correct locale on the root HTML element
- `<html dir="rtl">` for Arabic workspaces

The Gallurio chrome locale rules remain: public chrome uses `publicPage.formLocale` (owner-chosen) defaulting to English, NOT the visitor's Accept-Language header.

---

## 7. Recommended P0 Fix Set (MVP advertising channel)

These seven changes are the minimum to make the portfolio a functional advertising channel:

| # | Gap | File to change | One-line fix |
|---|-----|---------------|-------------|
| 1 | Relative canonicals (C1) | `app/(public)/layout.tsx` | Add `export const metadata = { metadataBase: new URL(process.env.NEXT_PUBLIC_APP_URL!) }` |
| 2 | `<html lang>` wrong (C2) | Architecture change | Pass locale through the layout tree; set `lang` on `<html>` in slug layout or via `generateMetadata.alternates.languages` |
| 3 | No `dir` RTL (C3) | `app/(public)/layout.tsx` | Cannot be set statically; requires same architecture fix as C2 |
| 4 | No OG/Twitter image (C4, C5) | `Workspace.publicPage`, `generateMetadata` on both pages | Add `seo.ogImageUrl` field + wire to `openGraph.images` and `twitter.images` |
| 5 | No sitemap (C6) | New `app/sitemap.ts` | Query all published workspaces, return `[{url, lastModified}]` |
| 6 | No robots.txt (C7) | New `app/robots.ts` | Allow `/w/`, disallow app shell, point to sitemap |
| 7 | No JSON-LD (I5) | `app/(public)/w/[orgSlug]/page.tsx` and `gallery/page.tsx` | Inject `<script type="application/ld+json">` with LocalBusiness + ImageGallery using existing `workspace.contact.*` fields |

Items 2 and 3 are coupled — fixing the `<html lang>` and `<html dir>` in a Next.js multi-root-layout setup requires making the slug layout the authoritative `<html>` container (moving `<html>`/`<body>` into the slug layout and making `app/(public)/layout.tsx` a passthrough fragment, or using `generateMetadata` to export `metadataBase` + using an `<html lang>` set by the root layout reading a cookie/header).

Items 1, 4, 5, 6 are independent and can be shipped without any architectural change.

---

## Appendix — Evidence Index

| Finding | File | Line |
|---------|------|------|
| C1 — no `metadataBase` | `app/(public)/layout.tsx` | entire file — no metadata export |
| C2 — `lang="en"` hardcoded | `app/(public)/layout.tsx` | 21 |
| C3 — no `dir` | `app/(public)/layout.tsx` | 21 |
| C4 — no `og:image` | `app/(public)/w/[orgSlug]/page.tsx` | 38–43 |
| C4 — no `og:image` (gallery) | `app/(public)/w/[orgSlug]/gallery/page.tsx` | 29–34 |
| C5 — no `twitter:*` | both page.tsx files | (absent) |
| C6 — no sitemap | repo root | (absent) |
| C7 — no robots.txt | repo root | (absent) |
| I1 — gallery reuses home description | `app/(public)/w/[orgSlug]/gallery/page.tsx` | 23 |
| I2 — no `og:url`/`og:type`/`og:site_name` | both page.tsx generateMetadata | 38–43 / 29–34 |
| I3 — no `robots` directive | both page.tsx generateMetadata | (absent) |
| I4 — gallery title English-hardcoded | `app/(public)/w/[orgSlug]/gallery/page.tsx` | 22 |
| I5 — no JSON-LD | all public page files | (absent) |
| I6 — masonry CLS, no aspect-ratio | `lib/page-builder/blocks/GalleryMasonryBlock.tsx` | 193–198 |
| I7 — favicon falls back to logo | `app/(public)/w/[orgSlug]/page.tsx` | 33 |
| I8 — empty alt on gallery images | `lib/page-builder/blocks/GalleryGridBlock.tsx` | 246 |
| I8 — empty alt on gallery images | `lib/page-builder/blocks/GalleryMasonryBlock.tsx` | 194 |
| M1 — all images `loading="lazy"` | `lib/page-builder/blocks/GalleryGridBlock.tsx` | 247 |
| M2 — all fonts `preload: false` | `lib/fonts/portfolio.ts` | 20–130 |
| M3 — no title template in public layout | `app/(public)/layout.tsx` | (absent) |
| M4 — `businessType` unused in metadata | `lib/db/models/Workspace.ts` | 54–58 |
| M5 — Contact nav is modal, not URL | `app/(public)/w/[orgSlug]/_components/PortfolioHeader.tsx` | 456–465 |
| M7 — 404 page no `noindex` | `app/(public)/w/[orgSlug]/not-found.tsx` | (absent) |
