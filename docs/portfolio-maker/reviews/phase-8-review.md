# Code Review — Portfolio Maker Phase 8

Reviewed: `git diff 6cc574f...HEAD` (commit `234e9b9` — templates, brand-kit picker, first-visit wizard).
Reviewers: Opus correctness/conventions pass + security/multi-tenant audit.
Date: 2026-05-31.

## Summary

The template registry, transactional `saveWizardOutputAction` (ordered multi-doc
create, match-or-create collection, previousData archive), owner-only gating, and
zod boundary validation were verified correct. One High-severity isolation gap
(fixed during the audit), one P1 (broken seed), and a set of P2/minor items.

## Findings & resolutions

| # | Sev | Finding | Resolution |
|---|-----|---------|------------|
| 1 | **High (sec)** | `saveWizardOutputAction` stored `starterImages[*].cloudinaryPublicId` / `branding.logoCloudinaryPublicId` without verifying they belong to the caller's workspace folder. A crafted payload could reference another tenant's Cloudinary asset (leak onto the attacker's public page; later delete-on-remove would destroy the victim's asset). A `..`-traversal variant defeated a naive prefix check. | **Fixed + tested.** Added `makeWorkspacePrefixCheck` rejecting any public id not under `gallurio/<workspaceId>/` or containing `..`; runs pre-transaction for both images and the logo. 4 new isolation tests. |
| 2 | **P1** | `pnpm seed` (`lib/db/seed.ts:140`) still wrote `templateId: "default"`, now off-enum → `ValidationError` on `Workspace.create()`, breaking the documented seed command. | Fixed → `"minimal"`. Grep confirmed it was the only off-enum writer. |
| 3 | P2 | `FeaturedWork.itemIds` was seeded as bare `string[]`, but the Puck array editor round-trips `{ id }` rows — would mis-bind when loaded into the Phase 9 editor. | Seed now maps to `{ id }` objects in `injectGalleryRefs`; test asserts the row shape. Renderer already accepts both. |
| 4 | P2 | `WizardClient` lazy-inits state from `sessionStorage`, so a same-tab mid-wizard refresh can cause a one-time hydration reconcile (server rendered defaults). | **Accepted with rationale** (documented in-code). The reconcile is benign and lands on the correct resumed state; the effect-based alternative trips the react-hooks "no setState in effect" rule (hard error) and adds a visible defaults→draft flash. Page is authed + dynamic (no SEO). |
| 5 | Low (sec) | `injectGalleryRefs` walks `content` but not Puck `zones`. | Accepted — no current template uses `zones`; fixing now would be premature (simplicity rule). Flagged for when a template uses sub-zones. |
| 6 | Minor | Orphaned Cloudinary assets if the wizard is abandoned/skipped after upload. | Documented in RELEASE-CHECKLIST §4d (cleanup cron / on-skip delete pre-prod). |
| 7 | Minor | `template.previewImage` points at non-existent `/template-previews/*.svg`; nothing renders them (CSS palette preview used). | Harmless; noted in checklist §4d. |

## Verified correct (no change)

- `workspaceId` is always from `requireOrg()` — never client-supplied — across the
  branding update, collection match-or-create, item insert, and reset.
- Both actions are owner-only; entry + wizard pages gate to owner (staff → notice/redirect).
- Client cannot supply arbitrary Puck data — the seed is generated server-side from
  the registered template; only `templateId`/`brandKit`/`contact`/`branding`/image
  metadata cross the boundary, all zod-validated (hex colors, enums, bounded lengths,
  `starterImages` capped at 50).
- `ordered: true` on the multi-doc `GalleryItem.create` in the session.
- All five locales carry the new `app.pageBuilder` keys.

## Deferred (RELEASE-CHECKLIST §4d)

Cloudinary orphan cleanup; upload-preset format/size limits; real template preview assets.
