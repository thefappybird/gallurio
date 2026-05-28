# Phase 9 — Editor, Desktop/Tablet/Mobile preview, publish flow

> Parent: `../master-plan.md`
> Branch: `feat/page-builder-editor` cut from `dev` (post-Phase-8).
> The last big UX surface — the actual Puck editor with zone toggle, preview frames, and publish.

---

## Context

By Phase 8 the wizard seeds a working portfolio. Phase 9 gives owners the editor to refine it. Requirements straight from the user brief:

- The builder shows **previews for mobile and desktop at a click of a button**.
- Drag and drop is mobile responsive (Puck handles the rendered output; the editor itself is desktop-first per master plan).
- Owner-only access.

This is one of two phases (with Phase 8) where UX polish matters most because it's where owners spend the most time post-onboarding. We do not need feature parity with Webflow — we need a sharp, focused editor that does six things well.

---

## Acceptance criteria

- `/page-builder` route hosts the editor for owners. Layout breakdown:
  - **Top toolbar**: workspace name • zone switcher (Home / Gallery) • Desktop / Tablet / Mobile preview toggle • Save status indicator (`Saved 2s ago` / `Saving…`) • Publish button.
  - **Left sidebar**: block palette (drag source) — categorized by Layout / Gallery / Content / Trust.
  - **Center canvas**: Puck `<Puck>` editor rendering the active zone (`home` or `gallery`).
  - **Right sidebar**: selected block's props editor (Puck supplies this) + brand kit panel (`BrandKitPicker` from Phase 8) collapsible at the bottom.
- Zone switcher swaps the active Puck data between `data.home` and `data.gallery`. Each zone's state is preserved in memory while editing the other.
- Preview toggle:
  - Desktop = no frame; canvas at full editor width.
  - Tablet = canvas wrapped in a 768px-wide centered frame with a tablet bezel hint.
  - Mobile = canvas wrapped in a 390px-wide centered frame with a phone bezel hint.
  - Toggle is purely visual — Puck's drag/drop continues to work at any frame width.
- Save: debounced auto-save every 1.5s of inactivity. Server action `savePortfolioDraftAction(zone, data)` writes only the touched zone. Sets `publicPage.latestVersion += 1`.
- Publish: explicit button. Confirmation modal: "Publish your portfolio? Anyone with the link will see it immediately." On confirm:
  - Sets `publishedAt = new Date()` (and `lastPublishedAt`).
  - Revalidates `/w/[slug]` (Home), `/w/[slug]/gallery`, and `/sitemap.xml`.
  - Toast: "Live at gallurio.com/w/<slug>" with copy-link button.
- Editor uses a CSS scope (`.gallurio-editor`) that prevents the editor chrome from inheriting the portfolio brand-kit CSS variables (so editing a "Bold" theme portfolio doesn't repaint the editor itself).
- On mobile screens (`< 1024px`), the editor shows a notice "The page builder works best on a tablet or larger" with a "Open preview" button that links to `/w/<slug>` and a "Continue anyway" link. We do not block — but we communicate the constraint clearly.
- Tests:
  - Auto-save debounce: fires once after multiple rapid edits.
  - Owner-only access; staff get a 403 page.
  - Publish flips `publishedAt` and triggers revalidation paths.
  - Zone switcher preserves unsaved edits to the inactive zone (in-memory until save).
  - Brand kit panel save action persists to `publicPage.brandKit`.
- `pnpm test --run page-builder/editor` passes.

---

## File map

```
app/[locale]/(app)/page-builder/
  page.tsx                                  # owner-only entry; routes to wizard or editor
  _components/
    EditorShell.tsx                         # full layout (toolbar + sidebar + canvas)
    EditorToolbar.tsx
    ZoneSwitcher.tsx
    PreviewFrameToggle.tsx
    SaveIndicator.tsx
    PublishButton.tsx
    PortfolioEditor.tsx                     # the Puck <Puck> wrapper itself
    BlockPaletteOverrides.tsx               # categorize Puck's default palette
    EditorBrandKitPanel.tsx                 # wraps BrandKitPicker for editor sidebar
    MobileBanner.tsx                        # "best on desktop" notice
  _actions.ts                               # savePortfolioDraftAction, publishPortfolioAction, updateBrandKitAction
  _actions.test.ts
  editor.css                                # scoped editor styles

app/api/page-builder/save/route.ts          # API surface for non-action saves if needed
app/api/page-builder/publish/route.ts

lib/db/queries/publicPage.ts                # add updatePortfolioZone, publishPortfolio
```

---

## Save action

```ts
// app/[locale]/(app)/page-builder/_actions.ts
"use server";

export async function savePortfolioDraftAction(input: {
  zone: "home" | "gallery";
  data: PuckData;
}) {
  const ctx = await requireOrg();
  if (ctx.role !== "owner") return { error: "Only the workspace owner can edit the portfolio" };

  const parsed = puckDataSchema.safeParse(input.data);
  if (!parsed.success) return { error: "Invalid editor data" };

  await Workspace.updateOne(
    { _id: ctx.workspace._id },
    {
      $set: { [`publicPage.data.${input.zone}`]: parsed.data },
      $inc: { "publicPage.latestVersion": 1 },
    }
  );
  return { ok: true, savedAt: new Date().toISOString() };
}
```

Editing the inactive zone in memory doesn't hit the server until you switch back and re-edit. Debounce client-side at 1500ms.

## Publish action

```ts
export async function publishPortfolioAction() {
  const ctx = await requireOrg();
  if (ctx.role !== "owner") return { error: "Only the workspace owner can publish" };

  await Workspace.updateOne(
    { _id: ctx.workspace._id },
    { $set: { "publicPage.publishedAt": new Date(), "publicPage.lastPublishedAt": new Date() } }
  );
  revalidatePath(`/w/${ctx.workspace.slug}`);
  revalidatePath(`/w/${ctx.workspace.slug}/gallery`);
  revalidatePath("/sitemap.xml");
  return { ok: true };
}
```

---

## Preview frame implementation

Iframe-free. We just render the canvas inside a `<div style={{ width: 390 }}>` (or 768) centered with `margin: 0 auto`. Puck's drag and drop continues to function across the constrained width because it tracks pointer events on its own children, not on the viewport.

For real fidelity preview (Phase 10's polish item), a future enhancement could mount the actual public renderer in an iframe pointing at a `/preview` route. For Phase 9, the in-place width clamp is enough — and per the simplicity principle, ship the simpler version first.

---

## Brand kit panel in editor

The right sidebar's bottom section embeds the `BrandKitPicker` from Phase 8. Changes propagate via `updateBrandKitAction(brandKit)` which writes to `publicPage.brandKit`. The editor canvas re-applies CSS variables immediately so users see the change in place. The Puck data itself does not contain brand kit values — they're applied at the renderer wrapper.

> **Note (added during Phase 5):** the prebuilt **Contact modal** is now config-driven via `publicPage.contact = { title, description, buttonStyle, buttonColor }` (model + `portfolioContactConfigSchema` already exist). The editor must expose a small **Contact panel** (alongside the brand-kit panel) so owners can edit the contact `title`/`description` and pick the button `buttonStyle`/`buttonColor` (curated brand slots — see `CONTACT_BUTTON_COLORS`/`BRAND_KIT_BUTTON_STYLES` in `lib/page-builder/types.ts`). The **form fields stay fixed** — only this copy + button presentation is editable. Persist via an `updateContactConfigAction` mirroring `updateBrandKitAction`. The public modal (`app/(public)/w/[orgSlug]/_components/ContactModal.tsx`) already reads this config with brand-kit fallbacks.

---

## Tests

- `_actions.test.ts`:
  - save validates Puck data shape
  - save only touches the named zone
  - publish flips dates + revalidates
  - non-owner gets error in all three actions
- `EditorShell.test.tsx`:
  - renders for owner; renders "no access" for staff
  - zone switcher carries in-memory edits across switches
  - preview frame toggle clamps canvas width
  - mobile banner appears below 1024px

---

## Verification

```bash
pnpm test --run page-builder/editor
pnpm typecheck
pnpm dev
# As owner: visit /page-builder. Confirm:
#   - Editor loads with seeded data from wizard
#   - Adding a block, switching to Tablet preview, switching to Mobile, then back to Desktop, all preserve edits
#   - Saving indicator transitions through "Saving…" → "Saved Xs ago"
#   - Publishing fires revalidation; /w/<slug> shows the latest content
# As staff: visit /page-builder — get 403 page
```

---

## Out of scope

- Versioned history UI (rollback, diff) — defer; we already increment `latestVersion` so it's possible later.
- Collaboration / multi-cursor editing — not in MVP.
- Per-block A/B variants — not in MVP.
- True iframe preview at exact widths — Phase 10 polish item if needed.

---

## Branch & merge

```
git checkout dev
git checkout -b feat/page-builder-editor
```
