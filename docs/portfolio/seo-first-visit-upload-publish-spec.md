# SEO First Visit: upload bugs + publish-status feature

## Context

Two upload flows in the portfolio editor (the "SEO first visit" Story Prompt wizard, and the Header panel / Settings page) wrote to the same Workspace fields through inconsistent paths — some live-immediate, some draft-gated. This produced two visible bugs (a nav logo and a site icon that could render as a black box) and a deeper reliability problem: public-page settings didn't consistently "land" on the published site, with no way for an owner to tell whether their settings had actually gone live.

## Bug 1 — Nav logo black box after the Story Prompt wizard

**Root cause (confirmed by reading the render tree):** the editor's preview iframe (`app/[locale]/portfolio-preview/`) is fed by `PreviewBrandShell`, which reads the workspace's localStorage draft **once, on mount**. `EditorShell.tsx` re-mounts that iframe by bumping `previewNonce` — every side-panel close path did this except the Story Prompt wizard's exit handlers. So after uploading a logo in the wizard, local state and localStorage updated correctly, but an already-mounted preview iframe kept showing the stale (missing) logo.

**Fixed:**
- `EditorShell.tsx`'s `onBrandingSaved` now bumps `previewNonce` when a logo actually changed.
- `HeaderPanelDialog.tsx`'s `onSaved` prop was declared but never called (the one panel dialog in the codebase with this gap — `ThemePanelDialog`/`ContactPanelDialog`/`CollectionsPopupPanelDialog` all call theirs correctly). Fixed so a successful logo upload survives closing the panel via Cancel/X instead of being reverted to the pre-open snapshot.
- The Story Prompt wizard's `header.logoUrl`/`logoAssetId` write also moved from live-immediate to the draft (see the publish-pipeline feature below), closing a related latent bug where an unrelated Publish click could silently revert a logo set via the wizard.

## Bug 2 — Site icon black box + favicon not updating

Two separate root causes, found via live reproduction against a running dev server (not guessed):

1. **Transient Cloudflare Images delivery-URL 404 window.** Right after a direct upload completes, the flexible-variant delivery URL can 404 for a few seconds before the asset finishes propagating — confirmed live (a fresh HTTP request 404'd immediately after upload+save+refresh, then 200'd on retry ~10s later). Fixed with a new shared hook (`hooks/useImageRetry.ts`) that retries a failed image load with backoff (1s/2s/3s) before giving up, applied to all four logo/icon preview `<img>` sites.
2. **Static `app/favicon.ico` competing with the per-workspace custom icon.** Confirmed live: the public portfolio page rendered two `<link rel="icon">` tags simultaneously. This is a documented Next.js quirk (file-convention icons can leak through and override nested-route metadata-API icons). Fixed by removing the static file and declaring the app-wide default favicon via the metadata API on both root layouts instead, so the public page's own `generateMetadata()` icon correctly takes precedence. Also fixed a related bug this surfaced: the public page/gallery routes set `icons: undefined` when a workspace had no custom icon, which blanks the parent's default instead of falling through — now `icons` is only set when a custom icon actually exists.

## Feature — bundle public-page settings into the draft → publish pipeline

SEO/branding fields (`seoTitle`, `seoDescription`, `siteIcon.{url,assetId}`, `seo.{keywords,ogImageUrl,ogImageAssetId,galleryDescription,noindex}`) moved off "write live immediately" and onto the same `PortfolioDraft` → `publishDraftAction` pipeline the Puck editor already uses. `inquiryRecipientEmail` stays live-immediate (operational, not page content).

- New `lib/page-builder/activeDraft.ts` (`resolveActiveDraftId`) resolves/creates a workspace's active draft, reusing the "newest updated draft" convention the Puck editor already follows.
- New `lib/portfolio/publicPageSeoFields.ts` normalizes draft vs. published field shapes and diffs them for "nothing pending" detection.
- `updatePublicPageSettingsAction` and `completeStoryPromptAction` now write the bundled fields to the active draft; `publishDraftAction` copies them onto `publicPage.*` on publish.
- Settings → Public Page gained a sticky footer (the Save button was easy to miss during testing — confirmed by manual testing) hosting: an "unpublished changes" banner and a new "Publish changes" button, disabled while there are unsaved edits or nothing pending.
- **Publish is a single unified action** — clicking "Publish changes" on the Settings page publishes the whole active draft (page content included), not just SEO fields, matching the original design intent (bundle everything, one publish action).

**Migration gap found in code review and fixed:** `ensureLegacyDraftMigrated` (which folds an existing workspace's live `publicPage` into its first draft) didn't carry forward SEO/icon fields, meaning any pre-existing workspace with SEO data configured before this feature shipped would get a migrated draft with those fields blank — and clicking Publish would have silently wiped the real live data. Fixed in both the migration path and `resolveActiveDraftId`'s own zero-draft fallback.

## Verification

- Full test suite (4103 tests) green; only pre-existing failures unrelated to any file this branch touched.
- Typecheck, lint (scoped to every file this branch changed), and production build all clean.
- Live end-to-end pass against a running dev server: Settings SEO edit → Save → pending banner → Publish → change confirmed live on the public page → banner clears; favicon fix confirmed (single icon link, no duplicate); sticky footer confirmed via computed `position: sticky` and screenshots at 375/768/1280px.
- Code review (senior-reviewer) caught the migration data-loss gap above plus a narrower one (client-side pending-state recompute after Save didn't account for `keywords`, since that field isn't editable from the Settings form) — both fixed and covered by new tests.
