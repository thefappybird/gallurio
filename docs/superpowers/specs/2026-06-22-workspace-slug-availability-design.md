# Workspace Slug Availability (debounced) — Design

**Date:** 2026-06-22
**Branch:** `enhance/workspace-slug-availability`
**Worktree:** `.claude/worktrees/slug-availability`

## Problem

Workspace slugs (`gallurio.com/w/<slug>`) are already globally unique (DB
`unique: true` index on `Workspace.slug` + app-level clash checks) and already
manually editable in onboarding and Settings → Workspace. The gap is purely UX +
robustness:
- No live availability feedback — a clash only surfaces on submit
  (`"That URL is already taken"`).
- The submit-time clash check is a non-atomic `findOne`, so two simultaneous
  saves of the same slug can both pass it; one then hits the DB unique-index
  error (Mongo **E11000**), which is **not caught** today and would throw.

## Current state (evidence)
- `Workspace.slug` — `lib/db/models/Workspace.ts:51` (`unique: true`, lowercase, trim).
- Format validator — `lib/validators/workspace.ts` `slugSchema` (3–50 chars, `^[a-z0-9]+(?:-[a-z0-9]+)*$`). Used by `businessStepSchema` (onboarding) and `updateWorkspaceBusinessSchema` (settings).
- Onboarding write + clash check — `lib/actions/onboarding.ts:45-138` (excludes the user's own owned workspace).
- Settings update + clash check — `app/[locale]/(app)/settings/_actions.ts:32-57` `updateWorkspaceBusinessAction` (excludes `ctx.workspace._id`).
- Settings slug input — `app/[locale]/(app)/settings/workspace/_business-form.tsx` (`gallurio.com/w/` prefix + `<Input id="slug">`).
- Onboarding slug input — the onboarding business step form (find under `app/[locale]/(onboarding)/onboarding/**`).
- Public resolution — `lib/db/queries/publicPage.ts` `findPublishedWorkspaceBySlug` (findOne by slug).
- No availability endpoint/action exists.

## Approach

### 1. `checkSlugAvailabilityAction(slug: string)` — server action
- Place in `lib/actions/slug.ts` (new). Authenticated: resolve the caller via the
  same auth used by onboarding/settings; it must work both during onboarding
  (user may not own a workspace yet) and in settings (owner of a workspace).
- Validate with `slugSchema`. Invalid → `{ available: false, reason: "invalid" }`
  (do not query the DB).
- Resolve the caller's own owned `workspaceId` (if any) and run
  `Workspace.findOne({ slug: normalized, _id: { $ne: ownId } })` (normalize
  lower/trim like the model). Found → `{ available: false, reason: "taken" }`,
  else `{ available: true }`.
- Cheap probe → wrap with the existing best-effort limiter (`lib/server/rateLimit.ts`)
  keyed by user id to bound abuse.
- Return type: `type SlugAvailability = { available: boolean; reason?: "invalid" | "taken" }`.

### 2. `useSlugAvailability(slug)` — debounced hook
- New `hooks/useSlugAvailability.ts` (or `lib/hooks/`). Debounce ~400ms, skip
  while the value equals the workspace's current slug (settings) or is empty,
  call the action, expose `status: "idle" | "checking" | "available" | "taken" | "invalid"`.
  Cancel in-flight on change (ignore stale responses). Register in `REUSABLE_CODE.md`.

### 3. Wire into both slug inputs
- Settings `_business-form.tsx` and the onboarding business step form: render an
  inline indicator next to the input — text + icon + color (NOT color alone),
  covering idle / checking (spinner) / available (✓) / taken (✗) / invalid.
  Use existing input states (focus-visible, error styling on taken/invalid).
  Disable submit while `checking` or when `taken`/`invalid` (belt-and-suspenders;
  the action still validates server-side).

### 4. Race-safe submit
- In both `onboarding` upsert and `updateWorkspaceBusinessAction`, wrap the
  write in try/catch and map Mongo duplicate-key (`err.code === 11000` /
  name `MongoServerError`) on `slug` to the same friendly
  `"That URL is already taken — try another."` result instead of throwing. Keep
  the pre-write `findOne` check (fast path); E11000 handling covers the race.

## i18n
New UI strings (checking / available / taken / invalid) added to all four
locales `en`, `fil`, `id`, `th` under the relevant onboarding + settings
namespaces. No `ms`.

## Acceptance
- Typing a slug in onboarding and in settings shows debounced live
  available/taken/invalid feedback; no extra calls while idle/unchanged.
- Submitting a slug that was taken between check and write returns the friendly
  "taken" error (E11000 handled), never a 500/throw.
- a11y: indicator conveys state by text+icon, not color alone; input labelled;
  keyboard/focus intact.
- All four locales updated; mobile 375px checked for the indicator layout.
- Tests: action (available / taken / excludes own workspace / invalid format /
  E11000 mapping) with in-memory Mongo; hook (debounce, stale-response ignore,
  status transitions). `pnpm typecheck` + `pnpm lint` pass.

## Out of scope
- Auto-generating slugs / suggestions on clash (could add "try `<slug>-2`"
  later). Reserved-slug blocklist (e.g. `w`, `api`, `admin`) — note as a
  follow-up if not already enforced by routing.
