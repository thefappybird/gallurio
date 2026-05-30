# Phase 8 — Brand kit, templates, and guided first-visit wizard

> Parent: `../master-plan.md`
> Branch: `feat/page-builder-wizard-and-templates` cut from `dev` (post-Phase-7).
> Implements the **guided start** when an owner first visits the page-builder route.

---

## Context

Until now, owners would land on the page-builder route with an empty Puck canvas — fastest path to abandonment. The user's brief is explicit: the first visit must be a **guided start that picks a template, applies branding, lets the owner upload starter images, choose a theme preset / font pairing / accent color, and lands them in the editor with a working portfolio**. Target time: 5–10 minutes.

Phase 8 ships:
1. The template registry (5 templates × seeded Puck data + default brand kit).
2. The first-visit wizard at `/page-builder/wizard`.
3. The brand-kit editor UI used both inside the wizard and as a sidebar panel in the editor (Phase 9 surfaces it in the editor).
4. The detection logic that routes first-visit owners to the wizard and returning owners directly to the editor.

---

## Acceptance criteria

- `lib/page-builder/templates/` contains 5 files:
  - `wedding-photographer.ts`
  - `event-photographer.ts`
  - `planner.ts`
  - `venue-stylist.ts`
  - `minimal.ts`
- Each template exports `{ id, label, businessType, description, previewImage, defaultBrandKit, seedData(opts) }` where `seedData({ workspace })` returns a valid `{ home: PuckData; gallery: PuckData }` object using the blocks shipped in Phases 3–4.

> **Note (added during Phase 5):** `publicPage.contact` is now a real config object (`{ title, description, buttonStyle, buttonColor }`) consumed by the prebuilt contact modal. Each template/`defaultBrandKit` should also seed sensible **contact defaults** (a `title` + `description`, optionally a `buttonStyle`/`buttonColor`) so a freshly-launched portfolio has on-brand contact copy. Validate against `portfolioContactConfigSchema` in `lib/validators/publicPage.ts`. The form fields themselves remain fixed/non-configurable.
- Template registry (`lib/page-builder/templates/index.ts`) exports an array and a `getTemplate(id)` lookup.
- Wizard at `/page-builder/wizard` is a 5-step flow with browser-back/next support:
  1. **Pick template** — grid of 5 cards with preview image, label, description. Defaults to the closest match for `workspace.businessType`.
  2. **Confirm branding** — pre-filled from `workspace.branding` (logo, primary/secondary color, tagline, description). Editable.
  3. **Choose theme preset + font pairing + accent color** — visual picker; live preview swatch.
  4. **Upload starter images** — at least 1, recommended 5. Uses existing `/api/uploads/sign` + Cloudinary direct upload. Images go into a new `GalleryCollection` named "Featured work" (or "Portfolio") and are referenced by ID in the seeded Puck data.
  5. **Review & launch** — shows a thumbnail of the seeded Home + Gallery, with a "Launch editor" button. On click: saves `Workspace.publicPage.data`, `templateId`, `brandKit`; redirects to `/page-builder` (the editor — Phase 9).
- Detection: `app/[locale]/(app)/page-builder/page.tsx` (Phase 9's entry point, stubbed in this phase) checks if `workspace.publicPage.data.home === null`. If so, redirects to `/page-builder/wizard`. Otherwise renders a placeholder "Editor coming in Phase 9" page.
- Wizard is skippable — there's a "Skip wizard" link in the bottom-left that seeds the `minimal` template with default brand kit and goes straight to the editor.
- Returning to the wizard URL after data exists shows a confirmation: "You already have a portfolio — going back to the wizard will overwrite it. Continue?" with Cancel + Reset link.
- Wizard state lives in URL query params + sessionStorage so a refresh doesn't lose progress.
- Tests:
  - Template seed produces valid Puck data for both zones (validated via `portfolioPuckDataSchema`).
  - Wizard save action is owner-only.
  - Save creates exactly one `GalleryCollection` per workspace named "Featured work" (or finds an existing one).
  - Skip flow seeds `minimal` template correctly.
  - Reset flow archives existing data into `publicPage.previousData` (a soft-delete pattern) before overwriting — so an owner doesn't lose work to an accidental click.
- `pnpm test --run page-builder/templates page-builder/wizard` passes.

---

## File map

```
app/[locale]/(app)/page-builder/
  page.tsx                                  # entry; redirects to wizard if no data
  wizard/
    page.tsx                                # shell
    _components/
      WizardLayout.tsx
      WizardStepIndicator.tsx
      StepTemplate.tsx
      StepBranding.tsx
      StepThemePicker.tsx
      StepImageUpload.tsx
      StepReview.tsx
    _actions.ts                             # saveWizardOutputAction, resetPortfolioAction
    _actions.test.ts

lib/page-builder/templates/
  index.ts                                  # registry + getTemplate(id)
  wedding-photographer.ts
  event-photographer.ts
  planner.ts
  venue-stylist.ts
  minimal.ts
  templates.test.ts                         # validates each template produces valid Puck data

lib/page-builder/brandKitPicker/
  BrandKitPicker.tsx                        # reusable widget — wizard + editor sidebar
  BrandKitPicker.test.tsx
  themePresetSwatches.ts

lib/db/models/Workspace.ts                  # add publicPage.previousData (optional, for reset safety)
```

---

## Brand kit picker

A reusable client component with three sub-pickers:

- **Theme preset** — 6 visual cards (Minimal, Editorial, Luxury, Bold, Romantic, Modern). Each card uses canonical sample text + colors.
- **Font pairing** — 5 options (Merriweather Only, Playfair + Inter, DM Serif + DM Sans, Cormorant + Montserrat, Fraunces + Inter). Each option shows heading + body sample.
- **Color set** — primary / secondary / accent / background / foreground. Inputs are color pickers with hex text input. "Use workspace branding" button pulls from `workspace.branding`.

The picker emits a `PortfolioBrandKit` object via an `onChange` callback. No internal save state — the parent wizard / editor owns persistence.

---

## Template seed example

```ts
// lib/page-builder/templates/wedding-photographer.ts
import type { PortfolioTemplate } from "./types";
import { DEFAULT_BRAND_KIT } from "@/lib/page-builder";

export const weddingPhotographerTemplate: PortfolioTemplate = {
  id: "wedding-photographer",
  label: "Wedding Photographer",
  businessType: "photographer",
  description: "Image-first hero, featured weddings, services, testimonials.",
  previewImage: "/template-previews/wedding-photographer.jpg",
  defaultBrandKit: {
    ...DEFAULT_BRAND_KIT,
    themePreset: "editorial",
    fontPair: "playfair-inter",
    accentColor: "#7e6a52",
  },
  seedData: ({ workspace }) => ({
    home: {
      content: [
        { type: "Hero", props: { headline: `${workspace.name}`, subhead: workspace.branding.tagline || "Wedding photography that lasts a lifetime.", primaryCtaLabel: "Inquire", primaryCtaAction: "open-contact", alignment: "center", height: "tall" } },
        { type: "About", props: { heading: "About", body: workspace.branding.description || "Tell your story here.", imagePosition: "left" } },
        { type: "FeaturedWork", props: { heading: "Recent weddings", itemIds: [], layout: "row" } },
        { type: "ServicesList", props: { heading: "Services", items: [{ title: "Engagement session", description: "60-minute outdoor shoot." }, { title: "Wedding day coverage", description: "Up to 10 hours, 2 photographers." }, { title: "Album design", description: "Hand-curated 30-spread heirloom album." }] } },
        { type: "CTABanner", props: { headline: "Let's create something beautiful.", ctaLabel: "Start your inquiry", ctaAction: "open-contact", background: "accent" } },
        { type: "ContactCard", props: { heading: "Get in touch", showEmail: true, showPhone: true, showSocials: true } },
      ],
      root: {},
    },
    gallery: {
      content: [
        { type: "GalleryMasonry", props: { collectionId: "", columns: 3, gap: "normal", showCaptions: false, maxItems: 24 } },
      ],
      root: {},
    },
  }),
};
```

Each template's `seedData` runs at wizard completion time. The `collectionId: ""` on gallery blocks is filled in by `saveWizardOutputAction` after the "Featured work" collection is created (or reused).

---

## Save action (wizard completion)

```ts
// app/[locale]/(app)/page-builder/wizard/_actions.ts
"use server";

export async function saveWizardOutputAction(input: {
  templateId: PortfolioTemplateId;
  brandKit: PortfolioBrandKit;
  branding: { logoUrl?: string; primaryColor?: string; secondaryColor?: string; tagline?: string; description?: string };
  starterImages: Array<{ cloudinaryPublicId: string; url: string; width: number; height: number; altText?: string }>;
}) {
  const ctx = await requireOrg();
  if (ctx.role !== "owner") return { error: "Only the workspace owner can run the wizard" };

  // 1. Update workspace.branding from input.branding
  // 2. Match-or-create GalleryCollection { workspaceId, slug: "featured-work" }
  // 3. Insert GalleryItems linked to the collection (order: index)
  // 4. Build template seedData(...), inject collectionId into gallery blocks
  // 5. Update workspace.publicPage = { templateId, data, brandKit, publishedAt: null, ... }
  // 6. Soft-archive previous data to publicPage.previousData if non-null
  // 7. Revalidate /page-builder, /w/[slug]
  // 8. Return { ok: true }
}
```

---

## Tests

- `templates.test.ts`: for each template, run `seedData({ workspace: mockWorkspace })` and validate output with `portfolioPuckDataSchema`. Assert every block type referenced exists in the Phase 3/4 block registry.
- `wizard/_actions.test.ts`:
  - happy path: starter images persisted, collection created, publicPage updated
  - second run reuses existing "featured-work" collection, doesn't duplicate
  - non-owner gets error
  - previous data soft-archived to `previousData`
- `BrandKitPicker.test.tsx`:
  - selecting a theme preset updates onChange payload
  - color inputs validate hex format
  - "Use workspace branding" populates from prop

---

## Verification

```bash
pnpm test --run page-builder/templates page-builder/wizard
pnpm typecheck
pnpm dev
# As a new owner: visit /page-builder → should redirect to /page-builder/wizard
# Complete the 5 steps. Confirm:
#   - workspace.publicPage.data.{home,gallery} populated
#   - GalleryCollection { slug: "featured-work" } created with N items
#   - Brand kit persisted with chosen theme/font/colors
#   - Revisit /page-builder → no redirect (stays in editor stub)
```

---

## Out of scope

- The editor itself — Phase 9.
- Multi-language template variants — defer; English-only seed text is fine in MVP (workspace locale derives from country).
- Theme preset deeper customization (typography weights, line-height) — defer.
- Wizard-driven block creation beyond what `seedData` produces.

---

## Branch & merge

```
git checkout dev
git checkout -b feat/page-builder-wizard-and-templates
```
