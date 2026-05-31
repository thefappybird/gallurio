# Code Review — Portfolio Maker Phase 9

Reviewed: `git diff 955c535...HEAD` (commit `83586fd` — Puck editor, zone switch, preview, publish, theme/contact panels).
Reviewers: Opus correctness/conventions pass + security/multi-tenant audit.
Date: 2026-05-31.

## Summary

Owner gating + tenant isolation on all four actions verified correct (workspaceId
always from `requireOrg()`, zone whitelisted via `z.enum` before the `$set` key is
built — no path injection). The zone-switch autosave closure, `ignoreNextChange`
flag, and `puckSeed` stability were traced and confirmed correct. No stored-XSS
sink in the Puck render path (no `dangerouslySetInnerHTML`; CTA hrefs are
enum-gated fragments). Findings below were fixed.

## Findings & resolutions

| # | Sev | Finding | Resolution |
|---|-----|---------|------------|
| 1 | Med (sec) | `savePortfolioDraftAction` validated structure but not SIZE — an owner could autosave multi-MB Puck data, bloating the embedded Workspace doc toward Mongo's 16 MB cap (tenant DoS). | **Fixed + tested** (security audit): 512 KB per-zone cap → `payload_too_large`. |
| 2 | P1 | Autosave `setTimeout` was never cleared on unmount → timer fires after unmount (setState-after-unmount) AND a final edit within the 1.5 s window could be lost on navigation. | Added an effect whose cleanup flushes the pending save and clears the timer on zone change + unmount. Removed the now-redundant manual flush in `switchZone`. |
| 3 | P1 | `handlePublish` published even if the pre-publish draft save failed — flipping `publishedAt` against a stale draft while toasting success (and error). | `saveZone` now returns a boolean; publish is gated on it (`if (!saved) return`). |
| 4 | Med (sec) | `ContactCardBlock` rendered `socials.website` verbatim as an `href` — a stored `javascript:` URL would be a clickable XSS link on the public page. | `safeWebsiteHref` at the render sink: only http(s) pass; bare domains get `https://`; everything else (javascript:/data:) is dropped. Regression tests added. |
| 5 | P2 | Theme/Contact side panels lifted edits to the parent live; closing without Save left the un-persisted value in parent state ("looks saved but isn't" on reopen). | EditorShell snapshots brand kit / contact on open and reverts on cancel/Escape/overlay (`onSaved`/`onCancel` contract). Live theme preview preserved; reverts cleanly. |
| 6 | P2 | `latestVersion` `$inc`s on every autosave (write counter, not a published-version count). | Clarified with a comment; intentional cheap marker for a future history UI. |
| 7 | Low (sec) | `backgroundImageUrl` fallback fields accept arbitrary external URLs (IP/UA leak to third-party origin; no script risk). | Documented in RELEASE-CHECKLIST §4e (product/infra decision: drop fallback or constrain to Cloudinary). |

## Verified correct (no change)

- Owner-only gating + tenant isolation on save/publish/brandKit/contact; no IDOR;
  zone enum prevents `$set` path injection (`__proto__` etc. rejected by Zod first).
- Zone-switch preserves in-memory edits (ref); no wrong-zone autosave (closure
  captures the right zone); `ignoreNextChange` resets per remount and can't swallow
  a real edit; `puckSeed` stays stable across brand-kit re-renders.
- `ensureIds` spread order lets an existing `props.id` win over the generated one.
- No `dangerouslySetInnerHTML` in any block; CTA hrefs are enum-gated fragments.
- `"use client"` boundary + `@measured/puck/puck.css` import correct; the base
  `Config` cast avoids the tsc deep-inference crash with no runtime impact.
- Locale parity guard covers `app.pageBuilder` across all five catalogs.

## Deferred (RELEASE-CHECKLIST §4e)

`socials.website` settings-side validation; block image-URL CDN bypass; confirm the
512 KB zone cap fits the largest real portfolios.
