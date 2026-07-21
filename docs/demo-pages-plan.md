# Portfolio Maker demo + Book a Demo page

## What this is
Two public, unauthenticated marketing surfaces:
1. **Portfolio Maker demo** (`/portfolio-maker-demo`) — a stripped-down, no-login version of the real portfolio editor, persisted to `localStorage` only. Sold via a marketing info page at `/portfolio-maker`.
2. **Book a Demo** (`/book-demo`) — a lead-gen form emailing the submitter a confirmation and support a notification. No DB persistence.

## Key architecture decisions
- **`EditorShell` got a `demoMode` prop**, a sibling to the existing `guideMode` prop (same seam, different behavior): keeps localStorage persistence (session-namespaced key, not workspace slug) and runs the real `SpotlightGuide`, but strips every server round-trip — draft CRUD, publish, template seeding (`getTemplate().seedData()` runs client-side instead, since the template modules are pure data).
- **No collections-based image picker in demo mode.** The real `MediaPicker` is coupled to a workspace-scoped collections API that has no anonymous equivalent — building a parallel collections backend for throwaway demo sessions wasn't worth it. Demo mode gets a lightweight picker (`DemoImagePicker.tsx`) backed by a new public upload route (`app/api/portfolio-maker-demo/upload/route.ts`, rate-limited per IP and per session, hard 10-image cap). The `FeaturedWork` block (the only collections-based block) is hidden from the demo's block drawer and defensively disabled if a template seeds one.
- **One new promo code type, `demo1mo`**: a single shared code (`DEMOPRO2026`), seeded as a permanent base fixture in `PROMO_CODE_SEEDS` (reaches production via `scripts/seed-base-promos.ts`, not the ad-hoc single-code script). Redemption mirrors the existing `beta2mo` type's `pendingPromoGrant` queuing behavior (stacks on an existing free-month entitlement instead of overwriting it) minus the beta-eligibility gate.
- **Four upsell gates** (image cap, block cap, publish click, theme-customization attempt) share one modal (`DemoGateModal.tsx`), each with its own locked copy (warm/encouraging voice, decided with the user during planning). The bonus promo code reveals once per session on the first gate hit, then persists visibly in the sticky disclaimer banner (`claimed` state) rather than only flashing once.
- **Three `SpotlightGuide` steps get demo-specific copy** (theme, drafts→"Create new design", publish) via a small override map applied on top of `SPOTLIGHT_STEPS` — no fork of the tour.
- **Preview toggle is disabled in demo mode**, not hidden: no real preview route exists for unpublished, localStorage-only demo data (the naive approach iframes the demo page inside itself), but the control stays in the DOM so the guide's `preview-device` tour step still finds its anchor.

## Critical bug caught only by real browser verification
`proxy.ts`'s `UNAUTHENTICATED_PATHS` allowlist never had the three new routes added — every anonymous visitor to `/portfolio-maker`, `/book-demo`, or `/portfolio-maker-demo` was silently redirected to `/sign-in`, defeating the entire premise of both features. No unit or component test exercises the real middleware; only a live Playwright run against the dev server surfaced it. Fixed; covered by `e2e/portfolio-maker-demo-pages.spec.ts` and `e2e/portfolio-maker-demo-editor.spec.ts`.

## Known follow-ups (not blocking, not built this pass)
- `guardThenRun`'s "unsaved changes" guard always fires for demo's "Create new design," even on a pristine, unedited canvas (demo has no concept of a "saved" id, so it's permanently "dirty" by that check). Never-silently-discards, so judged an acceptable papercut rather than a bug.
- The `messages/en.json` key literally named `"trial"` (plans/onboarding namespace) still invites the "trial" vs "free month" confusion the project has otherwise standardized away from. Renaming it (and its 4 locale counterparts) was flagged as a nice-to-have in the original brief, out of scope for this branch.
- No dedicated `proxy.ts` unit test exists in this repo (verified via a live server request instead) — a future pass could add coverage for the public-route allowlist directly.
