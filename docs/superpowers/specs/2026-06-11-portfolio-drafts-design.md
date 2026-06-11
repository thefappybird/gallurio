# Portfolio Drafts — Design Spec

Date: 2026-06-11
Branch: `feat/portfolio-enhancements`
Status: Approved (design); pending implementation plan

## Problem

The portfolio builder currently persists the in-progress layout to `localStorage`
only (key `gallurio:portfolio-draft:${slug}`), restored on mount. The Puck header
shows a "Saved" status that is misleading: a refresh re-hydrates from localStorage
and there is no durable, user-named save. There is also no way to keep multiple
portfolio layouts and switch between them.

This scope replaces the implicit single-buffer model with **named, durable drafts**:
loadable whole-portfolio layouts the user explicitly saves, switches between, and
deletes — with guard rails against losing unsaved work.

## Decisions (locked)

- **Storage:** new `PortfolioDraft` collection (not an embedded array). Each draft is
  a full portfolio snapshot; a separate collection scales and avoids bloating the
  16MB `Workspace` document.
- **Publish source:** Publish publishes the **active draft's saved content**.
  `publicPage.data` becomes the published mirror. There is **no server autosave**;
  the DB changes only on **Save changes** or **Publish**.
- **Publish while dirty:** block and show the Save-changes warning (Option A) **only
  when the active draft has unsaved changes or is a new unsaved draft**. If the
  active draft is clean and already persisted, Publish proceeds directly. Publish
  only ever publishes saved content.
- **Scratch template:** add a 6th template "I'll start from scratch" in the reserved
  last slot; existing 5 templates unchanged.
- **Draft cap by plan:** `free 5 / starter 15 / pro ∞`.
- **Entry popup:** shown on every load; options gated by state.
- **Existing content:** migrate current `publicPage.data` into one "New Draft" on
  first post-ship entry (idempotent).
- **Name uniqueness:** enforced on **create and rename**, against the workspace's
  *other* drafts (a draft excludes itself, so you can save an edit without changing
  the name). Collision with another draft's name is rejected.
- **Locales:** `en`, `fil`, `ms`, `id` (th removed).

## Data model

New model `lib/db/models/PortfolioDraft.ts`:

```
PortfolioDraft {
  workspaceId: ObjectId        // tenant scope, required, indexed
  name: String                 // default "New Draft"
  templateId: String           // origin template id (incl. "scratch"); reference only
  data: { home: Mixed, gallery: Mixed }
  brandKit: <brandKit sub-shape>
  contact: <contact sub-shape>
  header: <header sub-shape>
  collectionsPopup: <collectionsPopup sub-shape>
  formLocale: String
  createdAt: Date              // timestamps: true
  updatedAt: Date
}
```

Indexes:
- `{ workspaceId: 1, updatedAt: -1 }` — list the drafts board (newest first).
- **No unique index on `name`** — uniqueness is an app-level create-time check only,
  so renaming an existing draft may collide (allowed by product rule).

Sub-shapes (`brandKit`, `contact`, `header`, `collectionsPopup`) reuse the exact
field definitions already in `Workspace.publicPage` so editor/renderer parity holds.

Size guard: reuse the existing per-zone byte ceiling (`MAX_PUCK_ZONE_BYTES`) when
validating `data.home` / `data.gallery`.

## Plan caps

```
free   -> 5
starter-> 15
pro    -> Infinity (uncapped)
```

Resolved from `Workspace.plan`. Enforced atomically on create inside a Mongo
transaction (count drafts for the workspace, reject if `count >= cap`, else insert).
Rejection error: `draft_limit_reached`.

## Server actions

New file `app/[locale]/(app)/portfolio/_draftActions.ts`. All actions are
owner-only and tenant-scoped via `requireOrg()` → `{ _id: ctx.workspace._id }` /
`{ workspaceId: ctx.workspace._id }`. Inputs validated with Zod
(`lib/validators/portfolioDraft.ts`).

- `createDraftAction(input)`
  - Validate `name` non-empty → else `name_required`.
  - Validate `name` unique among the workspace's drafts → else `name_taken`.
  - Enforce plan cap (transactional) → else `draft_limit_reached`.
  - Insert; return the created draft id + payload.
- `updateDraftAction(id, input)`
  - Update by `{ _id: id, workspaceId }`. Validate `name` non-empty
    (`name_required`) and unique among the workspace's **other** drafts — exclude
    this draft's own id, so an unchanged name passes — else `name_taken`.
- `deleteDraftAction(id)`
  - Delete by `{ _id: id, workspaceId }`. Idempotent.
- `listDraftsAction()` (or load directly in the page Server Component)
  - Return `{ id, name, templateId, updatedAt }` for the board (no heavy `data`
    until a draft is applied). Apply fetches the full draft on demand.
- `publishDraftAction(id)` — supersedes the existing `publishPortfolioAction`
  - Load the draft by `{ _id, workspaceId }`, reconcile gallery/featured images,
    copy its snapshot into `publicPage.data` + `brandKit` + `contact` + `header` +
    `collectionsPopup`, stamp `publishedAt`/`lastPublishedAt`, revalidate public
    routes. The UI only invokes this once the active draft is clean+persisted; if it
    is dirty or a new unsaved draft, the Save-changes warning fires first (Option A).
    The old `publishPortfolioAction` (which published the
    implicit `publicPage.data` working copy) is replaced by this draft-sourced flow;
    keep its image-reconcile/revalidate internals, change only the source.
- `migrateLegacyPortfolioToDraftAction()`
  - Idempotent: if the workspace has **0** drafts and `publicPage.data` is
    non-empty, create one draft named "New Draft" from the current
    `data`/`brandKit`/`contact`/`header`/`collectionsPopup`/`formLocale` and return
    it as the active draft. Otherwise no-op.

Validators (`lib/validators/portfolioDraft.ts`) compose the existing
`brandKitSchema`, `portfolioContactConfigSchema`, `portfolioHeaderConfigSchema`,
`portfolioCollectionsPopupConfigSchema`, and `puckDataSchema`.

## Client state & localStorage

Single working buffer, key reused: `gallurio:portfolio-draft:${slug}`, reshaped:

```
{
  version: <bumped>,
  draftId: string | null,   // null => unsaved new draft
  draftName: string,        // default "New Draft"
  data: { home, gallery },
  brandKit, contact, header, collectionsPopup, formLocale
}
```

Behavior:
- `draftId === null` ⇒ unsaved new draft; name defaults to "New Draft".
- **Dirty detection (2.6.1):** on entry, if the buffer has a `draftId`, fetch that
  DB draft and deep-compare (JSON) the snapshot fields. Differences ⇒ unsaved
  changes: load the buffer and present as "editing with unsaved changes". If
  `draftId === null`, load the buffer directly with no diff. If the referenced
  draft no longer exists (deleted), fall back to unsaved-new.
- **No server autosave.** Remove/neutralize any existing onChange → server save so
  the DB mutates only on Save changes or Publish.
- **Style panels route into the active draft.** The Theme/brandKit, Contact, Header,
  and Collections-popup panels currently persist straight to `publicPage` via
  `updateBrandKitAction` / `updateContactConfigAction` / `updateHeaderConfigAction` /
  `updateCollectionsPopupConfigAction` (plus `updateFormLocaleAction`). Under the
  drafts model their "Save" updates **in-memory state + the localStorage working
  buffer only** — they no longer call those server actions. The full snapshot
  (`brandKit`, `contact`, `header`, `collectionsPopup`, `formLocale`) persists to the
  draft on **Save changes** and goes live only on **Publish**. This keeps a published
  page from mutating without a Publish, and makes a draft faithfully restore its
  styling. The buffer is extended to carry `brandKit` and `collectionsPopup` (it
  currently omits them). The four `update*Action`s plus `updateFormLocaleAction`
  become unused by the editor and are removed (or left only if used elsewhere —
  verify). The named-theme library (`saveThemeAction` / `updateThemeAction` /
  `deleteThemeAction` on `publicPage.savedThemes`) is independent and stays.
- `beforeunload` guard while dirty, in addition to the in-app warning modal.

State machine (in `EditorShell`):
- `activeDraftId: string | null`
- `activeDraftName: string`
- `isDirty: boolean` (derived from buffer-vs-baseline compare; baseline is the last
  saved snapshot loaded from DB, or empty for a brand-new draft)
- `nameEditing: boolean` + draft name input value
- pending navigation target (for the unsaved-changes modal)

## UI

`EditorShell.tsx` plus new components under `portfolio/_components/`.

- **Right cluster:** replace the **Templates** button with a **Drafts** button.
- **Header status area:** remove the "Saved" text. Show the **active draft name**
  with an **edit (pencil) button**. Editing turns the name into a text input with
  **check** and **✕** buttons. Check commits the new name into the working buffer
  only (no API call). ✕ cancels back to the prior name. A separate **Save changes**
  button persists name + content to the DB (create when `draftId === null`, else
  update).
- **`DraftsDialog.tsx`** (2.4): grid mirroring the templates modal. Empty-state
  fallback copy when the board is empty. Footer **Add new draft** button opens the
  templates modal. Each card supports Apply (load into canvas) and Delete. The card
  for the currently-active draft shows an **"Active" pill**. Applying sets
  `activeDraftId` + name and resets dirty baseline.
- **Templates modal** — reuse the existing `TemplatePickerDialog`, now listing **6**
  templates. Apply loads the chosen template into the canvas as a **new unsaved
  draft** (`draftId = null`, name "New Draft").
- **`PortfolioEntryDialog.tsx`** (2.6): shown on every load. Three options, gated:
  - *Continue where you left off* — enabled only when a recoverable buffer exists.
  - *Load an existing draft* — enabled only when ≥1 draft exists; opens the Drafts
    modal.
  - *Start from scratch* — always enabled; opens the templates modal (equivalent to
    Add new draft).
- **`UnsavedChangesDialog.tsx`** (2.2): blocks switching draft / template / starting
  new while dirty. **Save changes** persists then proceeds; **Discard** wipes the
  buffer and loads the target.
- **Save rejection (2.7):** inline error beneath the name input with a nudge/shake.
  `name_required` ("This field is required") always; `name_taken` ("A draft with
  this name already exists") whenever the name collides with another draft (on
  create or rename; a draft excludes its own current name).

## New template — "I'll start from scratch" (2.5)

`lib/page-builder/templates/scratch.ts`: 6th entry, reserved last slot. Empty
`home`/`gallery` zones (no Puck blocks), `defaultBrandKit` = default brand kit,
default nav/popup/contact styling. Register in `lib/page-builder/templates/index.ts`,
add the id to `PORTFOLIO_TEMPLATE_IDS` (`lib/page-builder/templates/types.ts`) and to
the `Workspace.publicPage.templateId` enum, and add a preview SVG under
`/public/template-previews/`.

## Responsive fix (item 3)

In `EditorShell.tsx` the left page-nav cluster (`~580-624`) currently uses
`flex items-center gap-1/2` with no wrapping. Add `flex-wrap` to its container so the
Home/Gallery/Contact/Navigation/Collections/Preview controls wrap on small screens,
matching the right cluster's `flex-wrap` behavior. Verify at 375px.

## i18n

The portfolio **editor chrome is English-only** (RELEASE-CHECKLIST §4f): the sibling
`TemplatePickerDialog` hardcodes its copy in a local `L` constant rather than using
`next-intl`. All new draft UI (drafts board, entry popup, unsaved-changes modal,
draft name editor, Save-changes button) follows that precedent — **plain-English
string constants, no new message keys**. This avoids churn/mojibake across the four
locale catalogs for chrome that is intentionally not translated. (Locale set is
`en/fil/ms/id`; th removed. Public-facing portfolio content is unaffected by this
feature.)

## Testing

- `PortfolioDraft` model + **tenant isolation** (queries/mutations scoped by
  `workspaceId`; cross-tenant access denied).
- Plan-cap enforcement: free 5 / starter 15 / pro uncapped; `draft_limit_reached`.
- `createDraftAction`: empty name rejected (`name_required`); duplicate name
  rejected (`name_taken`).
- `updateDraftAction`: updates by id+workspace; empty name rejected; rename to
  another draft's name rejected (`name_taken`); saving with the draft's own
  unchanged name passes.
- `deleteDraftAction`: idempotent, tenant-scoped.
- `publishDraftAction`: publishes active draft content; reconciles images; stamps
  `publishedAt`; tenant isolation.
- `migrateLegacyPortfolioToDraftAction`: creates one draft from legacy content;
  idempotent (no duplicate on second run; no-op when drafts already exist or
  `publicPage.data` empty).
- Scratch template seeds empty zones + default styling.
- Dirty-diff logic: matching buffer/DB ⇒ clean; differing ⇒ dirty; deleted draft ⇒
  fallback unsaved-new.
- Entry-popup option gating by state.
- Drafts board shows the "Active" pill on the active draft only.
- Publish gating: clean+persisted active draft publishes directly; dirty or new
  unsaved active draft triggers the Save-changes warning first.
- Left-cluster wraps at 375px (component/snapshot check).

Gate before done: affected tests, `pnpm typecheck`, `pnpm lint`. Check mobile at
375px. Confirm new indexes.

## Out of scope

- Draft version history / per-draft undo beyond the existing `previousData`.
- Sharing/duplicating drafts across workspaces.
- Quote negotiation or any inquiry-flow changes.
```
