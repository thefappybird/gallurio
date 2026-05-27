# Phase 0 — Blueprint & CLAUDE.md updates

> Parent: `../master-plan.md`
> Branch: `docs/portfolio-maker-blueprint` cut from current `dev`
> Merges into: `dev` (so all later phases start from this state)
> No code changes — documentation only.

---

## Context

The portfolio maker requires three decisions that contradict current `CLAUDE.md` rules and must be ratified in documentation **before** any code lands:

1. The "Merriweather-only, sharp-corners, semantic-tokens-only" design policy is correct for the authenticated app, but it would make every public portfolio look identical. It needs to be **scoped to the authenticated app**.
2. The repo has no documented "portfolio maker" feature. Future Claude sessions will rediscover the same questions without a section in `CLAUDE.md`.
3. The user has stated a design principle that should govern all future work: **simplicity and functionality over complication for its own sake**. This belongs in `CLAUDE.md`.

Phase 0 captures all three in docs so subsequent phases reference a single source of truth.

---

## Acceptance criteria

- `CLAUDE.md` design section explicitly scopes the design policy to the authenticated app and authorizes a curated set of font/radius/color overrides on public `/w/[orgSlug]` pages via a per-portfolio brand kit.
- `CLAUDE.md` contains a new top-level **"Portfolio maker"** section summarizing the locked decisions from the master plan (3-page model, embedded data, fixed inquiry form, draft-booking flow, `/w/[orgSlug]` URL).
- `CLAUDE.md` "Development Mindset" section contains the **simplicity principle**.
- `SaaS-Blueprint.md` "Public pages" section is updated to match (3-page model, embedded data, brand kit scope).
- Existing `portfolio_maker plan.md` is either updated to reference the master plan or deleted (it is now superseded). Keep `portfolio_maker_codex_planner_manual.md` as-is — it remains useful as a product reference even though it's not the architectural source of truth.

---

## Concrete edits

### 1. `CLAUDE.md` — Design style section

Edit the opening of the "Design style" block to read:

> The rules below apply to the **authenticated app shell** (`app/[locale]/(app)/...`, settings, dashboards, modals, editor chrome). Public workspace portfolios at `/w/[orgSlug]` are governed by the per-portfolio brand kit and may override font, radius, and color tokens within the curated values defined by the page-builder brand kit. See the "Portfolio maker" section below.

Leave the rest of the design rules unchanged.

### 2. `CLAUDE.md` — Add "Portfolio maker" section (after "Internationalization", before "SEO")

```md
## Portfolio maker

Each workspace has a public portfolio at `/w/[orgSlug]` that is the main conversion surface for booking inquiries. It is composed of exactly **three pages**:

1. **Home** — Puck-composed landing page. Configurable.
2. **Gallery** — Puck-composed gallery page. Configurable.
3. **Contact** — a prebuilt modal that opens from any CTA. Not configurable.

Decisions that bind future work:

- **Source of truth**: `Workspace.publicPage` (embedded). `data: { home: PuckData; gallery: PuckData }`, plus `brandKit`, `templateId`, `publishedAt`, SEO fields, `inquiryRecipientEmail`. No separate `Portfolio`, `PortfolioPage`, `Service`, `Package`, `Testimonial`, `FormTemplate`, or `MediaAsset` collections — `GalleryItem`/`GalleryCollection` already cover structured image data and are referenced from Puck blocks by ID.
- **Brand kit** (per workspace, applied to public pages only): theme preset, font pairing, primary/secondary/accent/background/foreground colors, radius preset, button style. Translated into CSS variables on the public page wrapper.
- **Inquiry form** is fixed, two tabs (Client info / Booking request with calendar date + description). Submissions create an `Inquiry` and a draft `Booking` (`status: "draft"`, `createdFromInquiryId`) linked back; owner approves in `/inquiries` to promote the draft into the bookings list.
- **Editor**: single Puck `<Puck>` instance with a zone toggle between `home` and `gallery` and a Desktop / Tablet / Mobile preview frame. Owner-only.
- **First-visit wizard** at `/page-builder/wizard` seeds template + brand kit + initial gallery uploads before opening the editor.
- **Custom domains are not in MVP.** Public URL stays `/w/[orgSlug]`.
```

### 3. `CLAUDE.md` — Development Mindset section

Add a bullet near the top:

> - **Simplicity and functionality beat complication for its own sake.** Three similar lines beat a premature abstraction; an embedded subdocument beats a parallel collection until query needs prove otherwise. If you can solve it with the existing schema and a small helper, do that instead of introducing new models or layers.

### 4. `SaaS-Blueprint.md` — Public pages section

Update the "Public pages" subsection to mirror the new CLAUDE.md "Portfolio maker" section. Add:

- The three-page model and fixed contact modal.
- That all configurable composition lives in `Workspace.publicPage` (embedded).
- That the brand kit is scoped to public pages.
- That custom domains are explicitly deferred.

If the blueprint currently describes a fully configurable form builder or multi-page CMS for portfolios, replace those passages with the locked scope.

### 5. `portfolio_maker plan.md`

Either:

- Replace its contents with a one-line pointer to `C:\Users\alexb\.claude\plans\d-portfolio-projects-gallurio-portfolio-quizzical-unicorn.md` (since the master plan now lives there), OR
- Delete it.

Pick whichever is preferable; the original is now strictly superseded.

---

## Verification

- `git diff` shows only `CLAUDE.md`, `SaaS-Blueprint.md`, and the old plan touched.
- Re-read `CLAUDE.md` end-to-end and confirm no rule contradicts the new "Portfolio maker" section.
- No code, no schema, no test changes — this phase is documentation only.

---

## Branch & merge

```
git checkout dev
git checkout -b docs/portfolio-maker-blueprint
# … edits …
git commit -m "docs: scope design policy + add portfolio maker section + simplicity principle"
git push -u origin docs/portfolio-maker-blueprint
# open PR, review, then:
git checkout dev
git merge --no-ff docs/portfolio-maker-blueprint
git push origin dev
```

After this merge lands, **all future portfolio-maker branches start from `dev`** and inherit the updated docs.

---

## Out of scope for Phase 0

- Schema changes (Phase 2+ touches `Workspace.publicPage`)
- Any `lib/page-builder/` files (Phase 1)
- Tests (no testable code in this phase)
- Locale catalog updates (no user-facing strings added until Phase 2)
