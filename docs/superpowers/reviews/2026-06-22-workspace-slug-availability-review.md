# Workspace Slug Availability — Code Review

**Branch:** `enhance/workspace-slug-availability`
**Reviewed:** 2026-06-22 (security-focused whole-feature review)
**Verdict:** Approved (after fixes below)

## Scope reviewed
`checkSlugAvailabilityAction` server action, `useSlugAvailability` debounced hook,
`SlugStatusIndicator` shared component, onboarding + settings form wiring, E11000
race-hardening in both submit paths, 4 locales, tests.

## Findings & resolution

| Sev | Finding | Status |
|---|---|---|
| **Critical** | UTF-8 BOM before `"use server"` in `lib/actions/slug.ts` and `settings/_actions.ts` (server-action directive must be the first bytes). | **Fixed** (`77cc831`) — BOMs stripped; verified first bytes are `"us`. |
| Important | Unauthenticated caller returned `{ available:false, reason:"taken" }` (misleads a user with an expired session). | **Fixed** (`77cc831`) — now `reason:"invalid"`; test + title updated. |
| Important | `SlugStatusIndicator` duplicated verbatim across both forms (DRY violation). | **Fixed** (`564ba61`) — extracted to `components/app/slug-status-indicator.tsx`, used in both forms, registered in `REUSABLE_CODE.md`. |
| Minor | Multiple `aria-live` regions (announcement reliability). | **Fixed** — single persistent `aria-live="polite" aria-atomic="true"` region (also removes idle layout shift). |
| Minor | Onboarding pre-check said "slug" while everywhere else says "URL". | **Fixed** — copy aligned. |
| Minor | Missing trailing newline on `hooks/useSlugAvailability.ts`. | **Fixed**. |

## Verified strengths
- **Tenant isolation correct:** the action resolves the caller's own workspace id
  from the session (never client-supplied) and excludes it via
  `_id: { $ne: ownId }`; a test confirms a same-named team/slug in another
  workspace is not leaked.
- **Auth + abuse control:** authenticated-only; format validated before any DB
  query; best-effort rate limiter keyed by user, fired after auth and before DB.
- **E11000 hardening:** both submit paths catch the duplicate-key error
  specifically on `slug`, re-throw other errors, and keep the pre-write fast-path
  check — closing the check-then-write race.
- **Hook race-safety:** monotonic sequence counter ignores stale responses; skips
  when empty or unchanged.

## Verification
- Tests: `lib/actions/slug.test.ts` (5), `hooks/useSlugAvailability.test.ts` (7),
  `lib/actions/onboarding.test.ts` (16), `settings/_actions.test.ts` (52) — all pass.
- `pnpm exec tsc --noEmit` — clean.

## Pending before merge
- **Manual 375px browser verification** of the indicator in the onboarding and
  settings forms (idle / checking / available / taken / invalid states) — not run
  in the worktree (no local env). Tracked as a PR checklist item.
