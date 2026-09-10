---
name: portfolio-drafts
description: How Gallurio's portfolio draft / versioning system works — the Drafts dialog, the local-browser draft autosave, and the save / publish / discard flow. Use this WHENEVER you touch portfolio drafts, the "Save changes" / "Publish" / "Discard" actions, local draft persistence, draft switching, or anything about how editor state becomes the live public page. Explains that Workspace.publicPage is the published source of truth, drafts are independent snapshots, and persistence is localStorage + explicit save (no server autosave).
---

# Portfolio drafts & versioning

## Two layers of state
1. **Local browser draft (autosave to localStorage).** `EditorShell.tsx` serializes a
   `PortfolioBrowserDraft` (`LOCAL_DRAFT_VERSION = 2`) under key
   `gallurio:portfolio-draft:{slug}` via `persistLocalDraft()` (zone data, `brandKit`,
   `contact`, `formLocale`, `formDir`, `headerConfig` (legacy, serialized for back-compat but never read back — the header is a Navigation block in `data` now), `collectionsPopup`, `draftId`,
   `draftName`). On mount it hydrates from there, validating the version first.
   **The local write is DEBOUNCED** (~350ms trailing) on Puck `onChange` — `handleChange`
   calls `debouncedPersistLocalDraft()`, not a synchronous write per keystroke (that caused
   typing lag). The debounce is **flushed** at every commit point: `flushPendingSave(zone)`
   (zone-switch / preview / save), `beforeunload`, and unmount — so the buffer is never stale
   and no keystrokes are lost. Config changes (locale/dir/header/contact/name) still persist
   synchronously via a state-effect. **There is NO server autosave** — server persistence
   happens only on explicit actions.
2. **Server drafts (named snapshots).** `PortfolioDraft` Mongo docs (indexed by
   `workspaceId`, unique name per workspace). `DraftSummary` = `{ id, name, templateId,
   updatedAt }`; `FullDraft` includes the nested config. Loaded into `EditorShell` as
   `initialDrafts` / `initialActiveDraftId` / `initialActiveDraftName`.

## Source of truth
`Workspace.publicPage` is the **published** live page. Server drafts are **independent
snapshots** — editing or switching a draft does NOT change the public page until Publish.

## The flows (`_draftActions.ts`, `EditorShell.tsx`, `draftDiscard.ts`)
- **Save changes** (`handleSaveChanges`): validate name → `createDraftAction` (new) or
  `updateDraftAction` (existing) → update local state + localStorage → clear the unsaved flag.
- **Publish** (`publishDraftAction`): copies the draft's `home`/`gallery` (and config) into
  `Workspace.publicPage.*`, reconciles gallery images + featured collections, stamps
  `publishedAt`. This is the only path to the live page.
- **Discard** (`resolveDiscardTarget`): a saved draft re-fetches from the DB (restores clean
  canvas); a new unsaved draft drops to the next available draft or empty scratch; clears the
  localStorage draft key. (Recent behavior: discard scraps unsaved edits and restores a clean
  canvas — commit 714f79b.)

## UI (`DraftsDialog.tsx`)
`DraftsDialog` lists drafts and supports switch (`onApply`), delete (`onDelete`, with a
confirm), and add-new (`onAddNew`). The `isNewUnsavedDraft` flag drives the dashed "Unsaved"
row for a freshly-created-from-template draft with no DB record yet.

## When editing this area
- Any new persisted field must be added to BOTH `PortfolioBrowserDraft` AND the server draft
  model + publish copy, or state will silently drop on reload or publish. Only bump
  `LOCAL_DRAFT_VERSION` for an INCOMPATIBLE shape change — an additive OPTIONAL field (e.g.
  `formDir`, which hydrates to LTR when absent) must NOT bump it, since a bump silently
  invalidates every user's existing local buffer on deploy.
- Multi-tenant: draft reads/writes scope by `workspaceId`; never trust a client-supplied id
  without the workspace filter.
- Verify save→reload→publish→discard in a real browser (see `portfolio-testing`).
