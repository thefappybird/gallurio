# Code Review — Portfolio phases 6–9: drop wizard, collection deletes, per-block style toolkit

**Commit reviewed:** `354e57c` — `feat(portfolio): drop wizard, collection deletes, per-block style toolkit`
**Scope:** the changes in that single commit (49 files, +2525 / −1636). Surrounding code read for context.
**Reviewer stance:** strict / adversarial. Findings below are limited to ones I'm genuinely confident matter.

## Summary

This is a solid, well-tested commit. Multi-tenant security is correct everywhere it matters: the new `DELETE` route checks `role === "owner"`, derives `workspaceId` from `requireOrg()`, and combines `{ _id, workspaceId }` on both the ownership read and the deletes; tenant-isolation, non-owner, missing, and invalid-id cases are all covered by tests. The seed/reseed helpers take a server-derived `workspaceId` and are called only from owner-gated actions. The hard-delete cascade ordering (DB transaction first, best-effort Cloudinary cleanup after commit) is correct and defended against a stuck asset resurrecting the row. The shared `resolveBlockStyle` clamps every numeric input and is wired identically into editor preview and production render, with the parity test guarding field keys. `_style` round-trips through the loose `puckDataSchema` without being stripped. Locales were updated for the new strings; editor chrome being English-only is consistent with the existing Puck-chrome decision and is fine.

The findings are mostly UI-state and robustness issues, not security or data-loss. The one I'd treat as a real bug is the orphaned confirm dialog after a successful template switch (P1). The rest are P2.

No P0 findings.

---

## P1 — should-fix

### 1. Orphaned confirm dialog after a successful template switch
**File:** `app/[locale]/(app)/portfolio/_components/TemplatePickerDialog.tsx:58,121-150` (with `app/[locale]/(app)/portfolio/_components/EditorShell.tsx:289-314`)

`TemplatePickerDialog` holds the chosen template in local `pending` state and renders the confirm step as `<AlertDialog open={pending !== null}>`. That nested AlertDialog is a portal-based dialog whose visibility is governed only by its own `open` prop — it is **independent of the outer `<Dialog open={open}>`**. On a successful switch, `EditorShell.handleSwitchTemplate` calls `setTemplatesOpen(false)` (closing the outer picker) but `pending` inside `TemplatePickerDialog` is never reset. Result: the outer picker closes while the "Switch template?" confirm dialog stays mounted and visible over the editor — and it will also re-appear the next time the picker is opened.

The non-owner / failure paths don't hit this because `pending` is cleared by `AlertDialogCancel`, but the happy path leaves it stranded.

**Fix:** drive `pending` off the parent lifecycle. Either (a) clear it when the picker closes — `useEffect(() => { if (!open) setPending(null) }, [open])`; or (b) lift the success signal so `onConfirm` success resets `pending`; or (c) have `EditorShell` pass a `key`/reset prop. Simplest is the effect on `open`.

---

## P2 — nice-to-have

### 2. `step` is not reset when the guide overlay is reopened
**File:** `app/[locale]/(app)/portfolio/_components/PortfolioGuideOverlay.tsx:83-88`

`useState(0)` for `step` persists across open/close because the component is never unmounted (it returns `null` while `!open` but stays mounted). If the owner pages to step 4, hits "Get started" / "Skip" (session close), then reopens via the Guide button, the overlay reopens on step 4 instead of step 1.

**Fix:** reset on open — `useEffect(() => { if (open) setStep(0) }, [open])`.

### 3. Guide overlay is a hand-rolled modal without a focus trap, Escape handler, or focus restore
**File:** `app/[locale]/(app)/portfolio/_components/PortfolioGuideOverlay.tsx:90-96`

It sets `role="dialog"` / `aria-modal="true"` but, unlike the rest of the app's dialogs (built on the `Dialog` primitive), it does not trap focus, does not close on `Escape`, and does not restore focus to the invoking control on close. CLAUDE.md's accessibility bar says modals must trap focus and restore it. Since it auto-opens on first run over the whole editor, keyboard users can tab out behind it.

**Fix:** render it through the existing `Dialog` primitive (which already handles trap + Escape + restore), or add a focus trap + `Escape` listener + `returnFocus` to the trigger.

### 4. `itemsDeleted` reports the count of *non-empty public IDs*, not items deleted
**File:** `app/api/portfolio/gallery/collections/[id]/route.ts:52,82`

`publicIds` is `items.map(...).filter(Boolean)`, and the response reports `itemsDeleted: publicIds.length`. An item with a missing/empty `cloudinaryPublicId` is deleted from Mongo but not counted. The field name promises item count; it actually returns destroyable-asset count. The test happens to use items that all have public IDs, so it doesn't catch the divergence. Low impact (the UI doesn't display the number), but the field is misnamed for what it returns.

**Fix:** either count items before filtering (`itemsDeleted: items.length`) and report a separate `assetsAttempted: publicIds.length`, or rename to `assetsDeleted`.

### 5. Cancelling `CreateCollectionDialog` after uploading orphans Cloudinary assets
**File:** `lib/page-builder/galleryPicker/CreateCollectionDialog.tsx:68-78,213-220`

Photos upload directly to Cloudinary as soon as they're dropped (`handleFiles` → `uploadImageToCloudinary`). If the owner then removes a thumbnail (X button) or cancels the dialog, `reset()` only clears local `images` state — the uploaded Cloudinary assets are never attached to a collection and never destroyed, so they leak. This is the inherent trade-off of direct browser upload and likely pre-existed in the wizard, but it's now reachable from a new entry point.

**Fix (optional for MVP):** track uploaded public IDs and call the sign/destroy path on remove/cancel, or document this as a known orphan source in `docs/RELEASE-CHECKLIST.md` and add a periodic Cloudinary sweep. At minimum, note it so it's a conscious decision.

### 6. `seedDefaultPortfolio` returns its own seed even when it lost the idempotency race
**File:** `lib/page-builder/seedPortfolio.ts:91-120`

Two concurrent first loads both run `buildSeed` and both call `updateOne({ ..., "publicPage.data.home": null }, ...)`. Only the first matches; the second is a no-op but still returns its locally built `seed`. The page (`page.tsx:63-72`) then renders the loser's seed, which can differ from what was persisted (e.g. different injected `FeaturedWork.itemIds` if the featured collection changed between the two reads). Benign in practice (both built from the same template), and self-heals on next load, but the function's contract ("returns the seed when it or a peer populates the page") isn't quite what the code does on a lost race.

**Fix (optional):** when `updateOne` reports `matchedCount === 0`, re-read the persisted `publicPage` and return that (or return `null` so the caller falls back to the freshly persisted doc). Low priority given the low blast radius.

### 7. Hero/CTA wrappers mix the `background` shorthand with `resolveBlockStyle`'s `backgroundColor`/`backgroundImage` longhands
**File:** `lib/page-builder/blocks/HeroBlock.tsx:106-112,117`; `lib/page-builder/blocks/CTABannerBlock.tsx` (analogous)

`wrapperStyle` sets the `background` *shorthand* (the accent gradient fallback) and then spreads `...resolveBlockStyle(_style)`, which sets `backgroundColor` / `backgroundImage` *longhands*. In a single inline-style object React serialises both; when the shorthand and longhand collide the result depends on CSS property order, so an owner who sets a block background color/image via the toolkit may not see it win over the block's own gradient (or vice-versa) consistently. For blocks that have no own `background` (About, Services, Gallery grids) this is a non-issue; it's only the two image/gradient blocks.

**Fix:** in `resolveBlockStyle`, when a `bgColorToken`/`bgImagePublicId` is present, also clear the conflicting shorthand (e.g. set `background: undefined`) — or have Hero/CTA stop using the `background` shorthand and use `backgroundImage`/`backgroundColor` longhands so the toolkit cleanly overrides. Verify the intended precedence (toolkit should win) in the browser at 375px.

---

## Things checked and found correct (no action)

- **DELETE route security:** owner gate, `isValidObjectId`, `{ _id, workspaceId }` ownership read, `{ workspaceId, collectionId }` on both deletes, items with `collectionId: null` untouched (tested), tenant isolation tested.
- **Transaction/cleanup ordering:** DB delete in `withTransaction` (idempotent on retry), Cloudinary destroys after commit, per-asset try/catch, `assetsFailed` surfaced, errors logged not swallowed.
- **Owner gating on every new server action** (`switchTemplateAction`, `dismissPortfolioGuideAction`) and on `reseedPortfolioFromTemplate`'s only caller.
- **`_style` persistence:** loose `puckDataSchema` (`props: z.record(z.unknown())`) round-trips `_style`; editor/prod field-key parity holds for all 9 blocks; `previousData` and `guideDismissedAt` both exist in the `Workspace.publicPage` schema.
- **`resolveBlockStyle` robustness:** every numeric input clamped via `clamp` (NaN/Infinity → min), unknown tokens impossible (typed), client-safe Cloudinary URL builder returns null when cloud name absent.
- **`AlertDialogAction` does not auto-close** (custom component built on the plain `Dialog`, just a `Button`), so the async confirm handlers correctly keep their dialog open to show loading/error — no premature close.
- **Tailwind `z-60`** is valid in Tailwind v4 (dynamic numeric z-index utilities).
- **i18n:** five catalogs updated; editor-chrome English-only is the documented, deliberate choice.
- **Tests:** the new `styleToolkit`, `seedPortfolio`, `_actions`, and DELETE-route suites pass (38 + route tests green locally).
