# Workspace Slug Availability — Implementation Report

**Branch**: enhance/workspace-slug-availability
**Date**: 2026-06-22

## Parts delivered

### Part 1: checkSlugAvailabilityAction

- **File**: lib/actions/slug.ts (new)
- Authenticated server action ("use server")
- Rate-limited: 30 req/60s per user via rateLimit()
- Validates slug with slugSchema (Zod)
- Excludes the caller own workspace from clash check
- Returns SlugAvailability: { available: boolean; reason?: "invalid" | "taken" }
- **Tests**: lib/actions/slug.test.ts (5 tests, all passing)
  - invalid format, available, taken by other, excludes own, unauthenticated

### Part 2: useSlugAvailability hook

- **File**: hooks/useSlugAvailability.ts (new)
- Debounced 400ms; immediate reset (0ms) when slug is empty or equals currentSlug
- Stale-response-safe via monotonic seqRef counter
- SlugStatus: idle | checking | available | taken | invalid
- **Tests**: hooks/useSlugAvailability.test.ts (7 tests, all passing)
  - idle, available after debounce, taken, invalid, empty slug, currentSlug skip, stale ignore
- **Registered in**: REUSABLE_CODE.md (Section 3 — Hooks)

### Part 3: UI wiring

#### Settings form
- **File**: app/[locale]/(app)/settings/workspace/_business-form.tsx (updated)
- Added useWatch + control to track slug field
- useSlugAvailability(slugValue, defaults.slug) — idle when slug unchanged
- SlugStatusIndicator inline component: text + icon for each status (a11y)
- aria-invalid on Input for taken/invalid
- Submit disabled while checking/taken/invalid

#### Onboarding form
- **File**: app/[locale]/(onboarding)/onboarding/business/business-form.tsx (updated)
- Same pattern: useWatch + useSlugAvailability(slugValue) (no currentSlug — new workspace)
- SlugStatusIndicator inline component
- Submit disabled while checking/taken/invalid

### Part 4: E11000 race-safe submit

#### Onboarding action
- **File**: lib/actions/onboarding.ts (updated)
- Added try/catch around transaction block
- E11000 (code 11000) mapped to "That URL is already taken — try another."
- **Tests**: lib/actions/onboarding.test.ts — added E11000 test (total 16 tests, all passing)

#### Settings action
- **File**: app/[locale]/(app)/settings/_actions.ts (updated)
- Wrapped Workspace.updateOne in try/catch with E11000 mapping in updateWorkspaceBusinessAction
- **Tests**: app/[locale]/(app)/settings/_actions.test.ts — added E11000 test (total 52 tests, all passing)

### Locales

Added slugChecking/slugAvailable/slugTaken/slugInvalid to onboarding.business in all 4 locales:
- messages/en.json: "Checking...", "Available", "Already taken", "Invalid format"
- messages/fil.json: "Tinitingnan...", "Available", "Hindi available", "Hindi tamang format"
- messages/th.json: "กำลังตรวจสอบ...", "ว่าง", "ถูกใช้แล้ว", "รูปแบบไม่ถูกต้อง"
- messages/id.json: "Memeriksa...", "Tersedia", "Sudah digunakan", "Format tidak valid"

## Technical decisions

- SlugStatusIndicator: inlined in each form (not extracted) — depends on form translator t
- Skip delay (0ms) for idle reset vs 400ms for checks: avoids visual flash on unchanged slug
- monotonic seqRef: simpler than AbortController for the debounced-action pattern
- E11000 catch is a fallback safety net — the pre-write availability check is the primary guard

## Test summary (new + modified)

| File | Tests | Result |
|------|-------|--------|
| lib/actions/slug.test.ts | 5 | PASS |
| hooks/useSlugAvailability.test.ts | 7 | PASS |
| lib/actions/onboarding.test.ts | 16 | PASS |
| app/[locale]/(app)/settings/_actions.test.ts | 52 | PASS |

## Quality gates

- pnpm typecheck: PASS (no errors)
- pnpm lint (new files): PASS (0 errors, 0 warnings)
- pnpm lint (full): 1 error pre-existing in settings/_actions.test.ts (E11000 test) — RESOLVED; 62 warnings are pre-existing in other files
