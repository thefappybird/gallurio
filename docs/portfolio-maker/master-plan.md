# Portfolio Maker — Master Plan

## Context

Gallurio's competitive moat is the **portfolio → inquiry → booking** conversion loop. The marketing brief (`portfolio_maker_codex_planner_manual.md`) is a generic, expansive product spec; the existing `portfolio_maker plan.md` is already Gallurio-tightened but predates the user's decision to (a) expand brand-kit personalization on public pages, (b) lock the public site to a fixed structure (Landing + Gallery + Contact-as-modal), and (c) treat inquiry submissions as **near-final booking drafts** that the owner approves with one click.

This master plan supersedes both prior docs. It is the single source of truth; per-phase sub-plans will be created **after** this is reviewed and approved.

---

## Locked decisions (from review session)

| Decision | Choice |
|---|---|
| Public URL shape | `/w/[orgSlug]` for MVP; custom domains in v1.1 |
| Page count | **Multi-page but fixed:** Home (landing) + Gallery + Contact (modal). Only Home and Gallery are configurable. Contact is a prebuilt modal with a fixed two-tab form. |
| Data architecture | **Embedded** in `Workspace.publicPage`. Gallery blocks reference `GalleryItem`/`GalleryCollection` by ID. No separate `Portfolio`/`Page`/`Service`/`Package`/`Testimonial` tables. |
| Brand-kit scope | **Full personalization on public portfolios only.** App chrome stays Merriweather + sharp corners; public `/w/[orgSlug]` pages get theme presets, font pairings, color tokens, radius. CLAUDE.md design rule will be scoped to "authenticated app" only. |
| Inquiry form | **Fixed schema, not configurable.** Two tabs: (1) Client info, (2) Booking request with calendar date + event description. Submissions are designed to be **near-final booking drafts** so the owner approves with one click. |
| Conversion model | Inquiry → Client + draft Booking in one flow; owner finalizes the few fields they own (price, status, internal notes). |
| Onboarding | Guided first-visit wizard on the page-builder route. Picks template → applies workspace branding → seeds Puck `data` → opens editor. |
| Preview | Desktop / Tablet / Mobile preview toggle in the editor. Puck handles responsive block rendering. |
| Templates count | 5 in MVP: `wedding-photographer`, `event-photographer`, `planner`, `venue-stylist`, `minimal`. |
| Blocks count | ~10 in MVP. See "Block catalogue" below. |
| Design principle to add to CLAUDE.md | **"Strive for simplicity and functionality over complication for its own sake."** |

---

## Scope

### In MVP
- Three-page public portfolio at `/w/[orgSlug]`: Home, Gallery, Contact-as-modal.
- Guided first-visit wizard for owners (template + brand questions + sample image upload).
- Puck-powered editor for Home and Gallery layouts with desktop/tablet/mobile preview.
- Rich brand kit per portfolio (theme preset, font pairing, colors, radius, button style) — scoped to public pages.
- Fixed two-tab inquiry form rendered in a modal across all portfolios.
- Inquiry submission → `Inquiry` doc + auto-created draft `Booking` (status `pending`) and matched/created `Client`.
- `/inquiries` lead inbox with one-click "convert to booking" that promotes the draft.
- Public-page SEO (title, description, OG image, sitemap, JSON-LD LocalBusiness).
- Basic analytics: view, CTA click, form open, form submit.

### Out of MVP
- Custom domains, blog/CMS, ecommerce, marketplace, vendor directory, AI features.
- Configurable forms / extra form templates.
- Multi-page beyond Home + Gallery + Contact (no Services/About/Project sub-pages until v1.1).
- Separate `Portfolio`, `Service`, `Package`, `Testimonial` collections.
- Contracts, invoices, deposits, client portals, file delivery.
- WhatsApp/SMS notifications (email only in MVP).

---

## Architecture overview

### Routes

| Route | Purpose | Auth |
|---|---|---|
| `app/(public)/w/[orgSlug]/page.tsx` | Public Home renderer (Puck `<Render>`) | none |
| `app/(public)/w/[orgSlug]/gallery/page.tsx` | Public Gallery renderer | none |
| `app/(public)/w/[orgSlug]/_components/ContactModal.tsx` | Inquiry modal (client component) | none |
| `app/[locale]/(app)/page-builder/page.tsx` | Editor entry — opens wizard if first visit, otherwise Puck editor | owner |
| `app/[locale]/(app)/page-builder/wizard/page.tsx` | Guided template/brand wizard | owner |
| `app/[locale]/(app)/inquiries/page.tsx` | Lead inbox | owner + staff |
| `app/[locale]/(app)/inquiries/[id]/page.tsx` | Inquiry detail + "approve booking" action | owner + staff |
| `app/api/inquiries/route.ts` (POST) | Public inquiry submission | none, slug-validated |
| `app/api/page-builder/save/route.ts` (POST) | Editor save (Puck data + brand kit) | owner |
| `app/api/page-builder/publish/route.ts` (POST) | Publish action | owner |
| `app/api/analytics/event/route.ts` (POST) | Public analytics event ingest | none, rate-limited |

### Shared Puck config
`lib/page-builder/config.ts` exports a single `Config<Components>`. Used by editor (`<Puck>`) and renderer (`<Render>`). Two zones: `home` and `gallery`. Block components live in `lib/page-builder/blocks/`, one file each.

### Block catalogue (MVP)
1. **HeroBlock** — image/video background, headline, subhead, CTA pair (primary opens contact modal, secondary scrolls to section)
2. **AboutBlock** — image + rich text + optional credentials list
3. **GalleryGridBlock** — references a `GalleryCollection` by ID; renders a responsive grid
4. **GalleryMasonryBlock** — same source, masonry layout
5. **GalleryCarouselBlock** — same source, swipeable carousel
6. **FeaturedWorkBlock** — picks 1–3 `GalleryItem`s for a featured strip
7. **ServicesListBlock** — embedded items (title, blurb, optional price-from). No separate `Service` model.
8. **TestimonialsBlock** — embedded list (quote, author, role). No separate `Testimonial` model.
9. **CTABannerBlock** — headline + button that opens contact modal
10. **ContactCardBlock** — phone/email/address/social, all sourced from workspace branding by default

### Brand kit (embedded under `Workspace.publicPage.brandKit`)
```ts
brandKit: {
  themePreset: "minimal" | "editorial" | "luxury" | "bold" | "romantic" | "modern";
  fontPair: "merriweather-only" | "playfair-inter" | "dm-serif-dm-sans" | "cormorant-montserrat" | ...;
  primaryColor: string;       // hex
  secondaryColor: string;
  accentColor: string;
  backgroundColor: string;
  foregroundColor: string;
  radius: "sharp" | "subtle" | "rounded";   // 0 / 0.25rem / 0.5rem
  buttonStyle: "solid" | "outline" | "soft";
}
```
The renderer translates `brandKit` into inline CSS variables on the public page wrapper only. App chrome is untouched.

---

## Data model changes

### Extend `Workspace.publicPage` (lib/db/models/Workspace.ts)
- `data` — keep, but typed: `{ home: PuckData; gallery: PuckData }` (currently a single `Mixed`).
- Add `brandKit` subdocument (see above).
- Add `latestVersion: number` (default 0) and `lastPublishedAt: Date | null`.
- Drop legacy `blocks: [publicPageBlockSchema]` after a one-time migration. (Acceptable since no production data depends on it yet.)

### Extend `Inquiry` (lib/db/models/Inquiry.ts)
- Add `eventTime: string` (HH:MM) — paired with existing `eventDate`.
- Add `eventDuration: number | null` (hours, optional).
- Add `guestCount: number | null`.
- Add `location: string | null`.
- Add `draftBookingId: ObjectId | null` — link to the auto-created draft `Booking`.
- Existing `convertedClientId` / `convertedBookingId` remain; `draft` ≠ `converted` (draft is created on submission; converted is set when owner approves).

### Extend `Booking` (lib/db/models/Booking.ts)
- Ensure a `status: "draft" | "pending" | "confirmed" | "cancelled" | "completed"` (or matching existing enum) supports the **draft** state created from inquiries.
- Add `createdFromInquiryId: ObjectId | null`.

### No new collections
We are explicitly **not** adding `Portfolio`, `PortfolioPage`, `PortfolioVersion`, `BrandKit`, `Service`, `Package`, `Testimonial`, `FormTemplate`, `MediaAsset`. The embedded model + existing `GalleryItem`/`GalleryCollection`/`Inquiry`/`Booking`/`Client` cover the MVP scope. We can extract collections later if a real query need emerges.

---

## CLAUDE.md / blueprint updates (in this branch)

1. **Add principle:** "Strive for simplicity and functionality over complication for its own sake. Three similar lines beat a premature abstraction; an embedded subdocument beats a parallel collection until query needs prove otherwise."
2. **Scope design policy to authenticated app:** the Merriweather-only + sharp-corners + semantic-tokens rule applies to `/app` chrome. Public `/w/[orgSlug]` portfolios may override fonts, radius, and color tokens within a curated set defined in the brand kit.
3. **Add "Portfolio maker" section** describing the three-page model (Home, Gallery, Contact-modal), the fixed inquiry-form schema, and the inquiry → draft-booking flow.
4. **Update SaaS-Blueprint.md** §"Public pages" with the same scoping.

---

## Branching & merge strategy

- **Phase 0** lands on a branch `docs/portfolio-maker-blueprint` cut from current `dev`, then **merges straight into `dev`** so all later phases start from a `dev` that already contains the updated `CLAUDE.md`, `SaaS-Blueprint.md`, the simplicity principle, **and these plan files themselves**.
- **Phase 1 and onward** branch from the new `dev` (post-Phase-0). Each phase uses a fresh task branch per `CLAUDE.md`'s naming rule (e.g. `feat/page-builder-puck-config`, `feat/page-builder-public-home`, …). Phase 1 specifically is the first feature branch — `feat/page-builder-config-and-blocks-contract` — cut after Phase 0 lands.
- Plan files live in the repo at `docs/portfolio-maker/` — version-controlled so every future Claude session has access to them.

## Phase plan (10 phases, each independently shippable)

> Phases 0–10 have all shipped. Their per-phase sub-plan files (`phases/phase-0…phase-10`)
> and the phase review docs were removed once complete; they remain recoverable in git
> history. The summaries below are kept for context.

### Phase 0 — Blueprint & CLAUDE.md updates
Update `CLAUDE.md` and `SaaS-Blueprint.md` per the section above. No code changes.
**Acceptance:** doc diffs reviewed and merged before any feature branch begins.

### Phase 1 — Puck config + shared block contract
Create `lib/page-builder/config.ts` and a stub `lib/page-builder/blocks/index.ts`. Define types only — no working blocks yet. Establish how blocks consume `brandKit` via context (`PortfolioBrandContext`).
**Acceptance:** typecheck passes; both `<Puck>` and `<Render>` can import the config; tests for block-context wiring.

### Phase 2 — Public Home renderer
Build `app/(public)/w/[orgSlug]/page.tsx`. Look up workspace by slug, require `publishedAt`, render `publicPage.data.home` via Puck `<Render>`. Apply brand kit as CSS variables on the page wrapper. Metadata from `seoTitle` / `seoDescription` + workspace branding.
**Acceptance:** unpublished → 404; published → renders fallback when `data.home` is null; metadata uses fallbacks; tenant isolation tested with `mongodb-memory-server`.

### Phase 3 — First six blocks (Hero, About, GalleryGrid, ServicesList, CTABanner, ContactCard)
Implement the six lowest-risk blocks. Each block: one file, plain server-renderable React, client-only logic gated. Smoke test per block.
**Acceptance:** every block has a render test with realistic mock props; brand kit overrides applied; `pnpm typecheck` and `pnpm test --run page-builder` green.

### Phase 4 — Gallery page + GalleryMasonry/Carousel + FeaturedWork blocks
Build `app/(public)/w/[orgSlug]/gallery/page.tsx` rendering `publicPage.data.gallery`. Implement the three gallery layouts. Each references a `GalleryCollection` by ID; renderer fetches items workspace-scoped.
**Acceptance:** cross-workspace access blocked; missing collection renders empty state; lazy-loading + `q_auto,f_auto` thumbnails verified.

### Phase 5 — Contact modal + fixed two-tab inquiry form
Build `ContactModal.tsx` (client component, rendered on every public route). Two tabs:
- Tab 1: Client info — name, email, phone, preferred-contact toggle.
- Tab 2: Booking request — date picker (calendar), time, duration, guest count, location, event type, description.
Honeypot + rate-limit. Submission goes to `POST /api/inquiries`.
**Acceptance:** mobile-first layout fits 375px viewport without scroll; keyboard navigable; both tabs validated with Zod; honeypot rejects bots; rate-limit returns 429.

### Phase 6 — Inquiry submission API + inquiry-to-draft-booking flow
`POST /api/inquiries` resolves slug → `workspaceId`, validates payload, creates `Inquiry`, creates or matches `Client` by email, creates a **draft `Booking`** linked back via `createdFromInquiryId`, returns `{ ok: true }`.
**Acceptance:** tenant isolation tested; duplicate-email matches existing client; draft booking is not visible in the regular bookings list until approved (filter `status !== "draft"` by default); failure path leaves no orphan records.

### Phase 7 — Lead inbox UI (`/inquiries` and `/inquiries/[id]`)
List view with filters (status, date). Detail view shows full submission + linked draft booking. One-click **"Approve booking"** flips draft → `pending` and surfaces it in the bookings calendar.
**Acceptance:** owner + staff can read; only owner can approve (matches existing role pattern); approval is idempotent; dashboard "Recent inquiries" link works.

### Phase 8 — Brand kit + templates + guided wizard
Implement template registry under `lib/page-builder/templates/` (5 templates × seed Puck data + default brand kit). Build the first-visit wizard at `/page-builder/wizard`:
1. Pick template
2. Apply workspace branding (already collected in onboarding)
3. Upload first 5 hero/gallery images (uses existing `/api/uploads/sign`)
4. Choose theme preset + font pairing + accent color
5. Land in editor with seeded `data`
**Acceptance:** wizard skippable for repeat visits (detect `data.home != null`); brand kit values persisted; templates produce valid Puck data for both zones.

### Phase 9 — Editor + preview toggle + publish flow
Build `app/[locale]/(app)/page-builder/page.tsx`. Host `<Puck>` with a toolbar that switches between `home` and `gallery` zones and toggles Desktop / Tablet / Mobile preview frames (iframe with width clamps). Save debounced; publish is explicit. Editor uses sandbox styles so it doesn't inherit app chrome.
**Acceptance:** Puck data round-trips through save/load; publish updates `publishedAt`; preview frames show the actual public renderer at three widths; "best on desktop" banner shown on mobile editor.

### Phase 10 — SEO, sitemap, analytics, polish
- `app/sitemap.ts` includes published public pages only.
- `app/robots.ts` blocks `/api`, `/dashboard`, etc.
- JSON-LD `LocalBusiness` on public Home.
- `POST /api/analytics/event` ingests view/cta-click/form-open/form-submit; minimal `AnalyticsEvent` model added now (only at this phase).
- Lead-inbox dashboard tile shows views + inquiry count + conversion rate.
**Acceptance:** sitemap excludes unpublished; robots verified; analytics writes are workspace-scoped and bot-filtered; dashboard tile renders with real numbers.

---

## Critical files to modify or create

### New
- `lib/page-builder/config.ts`
- `lib/page-builder/blocks/{Hero,About,GalleryGrid,GalleryMasonry,GalleryCarousel,FeaturedWork,ServicesList,Testimonials,CTABanner,ContactCard}.tsx`
- `lib/page-builder/brandKitContext.tsx`
- `lib/page-builder/templates/{wedding-photographer,event-photographer,planner,venue-stylist,minimal}.ts`
- `lib/validators/publicPage.ts` (Puck data shape + brand kit validators)
- `lib/validators/inquiry.ts` (extend if exists)
- `app/(public)/w/[orgSlug]/{page,layout}.tsx`
- `app/(public)/w/[orgSlug]/gallery/page.tsx`
- `app/(public)/w/[orgSlug]/_components/ContactModal.tsx`
- `app/[locale]/(app)/page-builder/{page,wizard/page}.tsx`
- `app/[locale]/(app)/inquiries/{page,[id]/page}.tsx`
- `app/api/inquiries/route.ts`
- `app/api/page-builder/{save,publish}/route.ts`
- `app/api/analytics/event/route.ts`
- `lib/db/models/AnalyticsEvent.ts` (Phase 10 only)
- `app/sitemap.ts`, `app/robots.ts`

### Modify (representative — pattern repeats per model)
- `lib/db/models/Workspace.ts` — extend `publicPage` schema (`data` shape, add `brandKit`, drop legacy `blocks` post-migration)
- `lib/db/models/Inquiry.ts` — add booking-draft fields
- `lib/db/models/Booking.ts` — add `draft` status + `createdFromInquiryId`
- `lib/db/models/_queries/bookings.ts` (or equivalent) — filter out `draft` from default lists
- `app/[locale]/(app)/settings/public-page/_form.tsx` — keep SEO controls; link to new editor
- `CLAUDE.md`, `SaaS-Blueprint.md` — design-policy scoping + new section + simplicity principle

### Reuse
- `lib/auth/requireOrg.ts` — every authenticated route
- `lib/storage/cloudinary.ts` — `workspaceFolder`, `cloudinaryThumbnailUrl`, `signUpload`
- `app/api/uploads/sign/route.ts` — wizard image uploads
- `lib/i18n/localeForCountry.ts` — locale for public chrome
- `lib/db/models/GalleryCollection.ts`, `GalleryItem.ts` — gallery blocks
- `lib/db/models/Inquiry.ts`, `Client.ts`, `Booking.ts` — submission flow

---

## Verification strategy

Each phase ends with:
1. `pnpm typecheck`
2. `pnpm test --run <touched-area>` (targeted, per memory rule)
3. Manual smoke at 375px and 1440px widths for any UI phase
4. For Phases 2, 4, 5, 6: cross-workspace isolation test using `mongodb-memory-server` (org A cannot read or submit to org B's data) — **non-negotiable**.

Before merging the whole feature into `dev`:
1. Locale catalogues consolidated across `en/fil/ms/id` (any new keys translated).
2. `pnpm test` full sweep.
3. `pnpm build`.
4. Opus agent code review (per CLAUDE.md merge policy).

---

## Open items for review

None blocking — all major scope/architecture questions answered in the locked decisions table. If the user confirms this plan, the next step is to create sub-plans `phase-0` through `phase-10` as individual `.md` files (one per phase) before the first feature branch is cut.
