# Portfolio Maker demo + Book a Demo page

## Context
Gallurio wants two new public, unauthenticated marketing surfaces to drive signups: (1) a playable, no-login demo of the portfolio editor that persists only to the visitor's browser, and (2) a lead-gen "Book a Demo" form that emails both the submitter and support. A third, cross-cutting piece governs how the demo nudges visitors toward signing up when they hit its intentional limits (image/block caps, Publish, theme customization) — including a stacking promo-code reward for trying it. The grounding brief (`docs/demo-pages-prompt.md`) was independently verified against the current worktree by three research passes; every file:line cited below was confirmed live in this session, not assumed from the brief.

Decisions below marked **[my call]** were explicitly left to agent judgment by the brief; each states its reasoning. Decisions marked **[user-approved]** were resolved via AskUserQuestion this session.

**[user-approved] Copy voice: Warm/encouraging.** **[user-approved] Gate delivery: modal for all four gates** (image cap, block cap, publish, theme). Final copy is locked below — implement verbatim, do not re-litigate during coding.

---

## Part 1 — Portfolio Maker demo

### Architecture decisions
- **Template seeding — client-side, no new server action** [my call]. `lib/page-builder/templates/{types,index}.ts` and every template file are confirmed pure data (no server-only imports) — call `getTemplate(id)` and `template.seedData({ workspace: { name: "Your Studio" } })` directly from the demo's client component. Skips a redundant unauthenticated action surface entirely.
- **Two routes** [my call]:
  - `app/[locale]/(marketing)/portfolio-maker/page.tsx` — marketing info/CTA page (server component, marketing header/footer chrome), sells the feature, links to the live demo.
  - `app/[locale]/portfolio-maker-demo/page.tsx` — the live editor, full-bleed, **outside** both `(app)` and `(marketing)`. Precedent: `app/[locale]/portfolio-preview/page.tsx` already sits at this same nesting level specifically to avoid `(app)`'s sidebar chrome, confirmed via its own file (owner-only preview, `dynamic = "force-dynamic"`, no group layout). Same reasoning applies here for a chrome-less canvas, minus the auth.
- **Block-cap counting source**: use `renderDraftData.home.content.length` / `renderDraftData.gallery.content.length` (`EditorShell.tsx:530-533`, kept in sync on every edit via `handleChange`), **not** `PuckGateReader` — confirmed `PuckGateReader` (`EditorShell.tsx:424-440`) only reads the currently-mounted zone's live Puck store, not both zones at once.
- **New public upload route**: `app/api/portfolio-maker-demo/upload/route.ts`.
- **Persistence**: localStorage-only, no DB fallback — brief's own math (10 images as CF ids only, 20 blocks/zone) stays well under the ~5MB quota. Not building the documented DB-wipe-on-leave fallback; note it in a code comment as the documented contingency if caps ever loosen.

### Strip-down of EditorShell for the demo
Do not fork `EditorShell.tsx`. Add a `demoMode` prop following the exact pattern already proven by the existing `guideMode` prop (`EditorShell.tsx:187`, checked at 11 call sites — see research above), since `guideMode` already demonstrates the seam for "disable persistence/drafts/publish selectively." `demoMode` differs from `guideMode` in what it keeps on (unlike sandbox mode, the demo DOES persist to localStorage, DOES run the real `SpotlightGuide`, and DOES let Save Changes work):
- Persistence (`persistLocalDraft`, debounce, `beforeunload` flush): **unchanged**, keyed by a demo session id instead of workspace slug (see below).
- `handleSaveChanges`: keep local-only behavior (skip the server draft call, keep the localStorage flush) — this already matches how `persistLocalDraft` behaves; just make the "server round trip" branch conditional on `!demoMode`.
- `doPublish`: when `demoMode`, open the Part-3 Publish gate modal instead of calling the server publish flow.
- `applyTemplate`: when `demoMode`, skip `seedTemplateAction` and instead call `getTemplate(id).seedData(...)` client-side, still routed through the existing `guardThenRun(..., true)` unsaved-changes guard (reuse `UnsavedChangesDialog`'s title/body override params for demo-specific "Create new design" copy).
- Drafts button → replaced with "Create new design" in demo mode: opens `TemplatePickerDialog` in its existing `welcome` mode (already supports "Start from scratch" via `onStartScratch`), routed through `guardThenRun`.
- Entry screen: replace `entryOpen`/`welcomeTemplatesOpen`/`storyPromptOpen` branching with two options only — "Start from scratch" / "Continue where you left off" (latter gated on `hasRecoverableBuffer`, already computed at `EditorShell.tsx:770-780`). No `StoryPromptDialog`/`PortfolioEntryDialog` welcome-template branching in demo mode.
- Guide: runs for real (`<SpotlightGuide steps={demoSteps} .../>`, not the sandbox path) — see Part 3 for the 3-step override.
- Theme panel: preset selection (`applyTile`, `useThemeEditor.ts:64-69`) stays fully enabled. The boundary to gate is exactly `currentTheme !== null` / `hasUnsavedCurrent` (`useThemeEditor.ts:62,71-84`) — the moment any `changeControl` call would set `currentTheme` non-null (i.e., any tweak after picking a preset), intercept and open the Part-3 Theme gate modal instead of committing the change.
- Image/block caps: new counters computed from `renderDraftData` (blocks) and an uploaded-image count tracked in the demo's localStorage draft (images). On cap hit, open the Part-3 gate modal instead of allowing the add.

### Demo session id + localStorage
- Client generates `crypto.randomUUID()` on first load if absent, stores under a new key e.g. `gallurio:portfolio-maker-demo:session`. Reuse the existing draft key pattern for the canvas itself, substituting the demo session id for `slug`.
- Also store: claimed-promo flag, image count/id list (for the 10-cap and for the upload route's session id header).

### New public image-upload route
`app/api/portfolio-maker-demo/upload/route.ts` — mirror `app/api/images/direct-upload/route.ts`'s shape (Zod body schema, `requestDirectUpload()` call, JSON response) but:
- No `requireOrg()` — instead require a `demoSessionId` in the body (Zod: non-empty string, sane max length/UUID-shape).
- Pass the demo session id as `requestDirectUpload`'s subfolder/metadata tag (never a real `workspaceId`).
- Server-side 10-image cap: `rateLimit(demoSessionId, { limit: 10, windowMs: <session-length, e.g. 24h> })` from `lib/server/rateLimit.ts` (confirmed shape: `rateLimit(key, {limit, windowMs}) -> {ok, remaining, resetAt}`), return a distinct `{ error: "image_cap_reached" }` (400) the client maps to the cap modal — distinct from generic failure.
- Also rate-limit by IP via `getClientIp(request.headers)` + a second `rateLimit()` call, per Endpoint Hardening checklist.

### Route/page placement — file list
- `app/[locale]/(marketing)/portfolio-maker/page.tsx` (new, marketing info page)
- `app/[locale]/portfolio-maker-demo/page.tsx` (new, full-bleed editor page, renders `EditorShell demoMode`)
- `app/api/portfolio-maker-demo/upload/route.ts` (new)
- `app/[locale]/(app)/portfolio/_components/EditorShell.tsx` (add `demoMode` prop + branches, following `guideMode`'s pattern)
- `app/[locale]/(app)/portfolio/_components/spotlightSteps.ts` / new small override map (Part 3)

---

## Part 2 — Book a Demo page

### Decisions
- **Success semantics** [my call]: success = Zod validation passes. Both emails are attempted independently, each in its own try/catch exactly like `inquirySubmission.ts:219-263`; neither send gates the success response. This matches the existing pattern precisely (transaction/validation determines success, email delivery never does) rather than special-casing the confirmation email.
- **SUPPORT_EMAIL** [my call]: hoist the literal out of `app/[locale]/(marketing)/contact/page.tsx:5` into `lib/email/brand.ts` (already the home of platform-identity constants like `gallurioBrand()`) as `export const SUPPORT_EMAIL = "support@gallurio.com"`. Two consumers now (contact page mailto link, book-a-demo notification recipient) — right threshold to dedupe. Update the contact page's import, don't leave a duplicate literal.
- **Fields**: name, email, business/studio name, free-text message ("What would you like to see?"). Single short form, no wizard.
- **No DB persistence** — confirmed non-goal, do not add a Mongoose model.

### Implementation
- New Server Action (Zod-validated), e.g. `app/[locale]/(marketing)/book-demo/_actions.ts` — `submitBookDemoAction(input)`.
- New `lib/email/bookDemoNotification.ts` (support-facing): mirror `lib/email/inquiryNotification.ts` exactly — `renderBrandedEmail()`, `brand: gallurioBrand()`, `locale: "en"`, a `{ type: "rows", rows: [...] }` block with the four submitted fields, `sendEmail({ to: SUPPORT_EMAIL, replyTo: submitterEmail, ... })`.
- New `lib/email/bookDemoConfirmation.ts` (submitter-facing): mirror `lib/email/inquiryClientConfirmation.ts` — `renderBilingualEmail()`, new `EMAIL_COPY.demoBookingConfirmation` entry in `lib/email/messages.ts` (subject/greeting/body1/body2/body3 per-locale functions, following `inquiryConfirmation`'s exact shape at `messages.ts:157-163`), `brand: gallurioBrand()` (not `resolveWorkspaceBrand` — this is Gallurio's own form, no workspace).
- Rate limit: `rateLimit()` + `getClientIp()`, same as the inquiry form, per Endpoint Hardening.
- On success: in-app success state ("Request received — check your email"), independent of the confirmation email's actual delivery (per the success-semantics decision above).
- Route/page: `app/[locale]/(marketing)/book-demo/page.tsx` + a form component, following the file organization of `contact`/`pricing` siblings (note: `contact/page.tsx` itself has no form — the closer structural analog for a form+action pair is the tenant inquiry form's component split; keep it to page.tsx + one form component, no extra abstraction).

---

## Part 3 — Upsell system, promo reward, guide overrides, disclaimer banner

### Locked copy (Warm/encouraging voice, all four gates as modals)
- **Image cap** (11th image): *"You've used all 10 demo images! Sign up free to add unlimited photos to your gallery."* — CTA: "Sign up to build without restrictions" → `/sign-up`.
- **Block cap** (21st block, per zone): *"This page is full for the demo (20/20 blocks). Sign up free to keep building."* — same CTA.
- **Publish click**: *"Ready to go live? Publishing is a Gallurio Pro feature. Sign up for a free month and put your site on the internet today."*
- **Theme customization attempt**: *"Want to fully customize your colors and fonts? That's a Pro feature. Sign up for a free month to unlock full theme editing."*
- **Promo reward callout** (first gate hit, any type, once per session): *"Nice work exploring the editor! Here's a bonus code for an extra free month, stacked on top of your signup free month: [CODE]"* Show inside whichever gate modal triggered it, appended below that gate's own message. Subsequent gate hits in the same session show only that gate's own message (no repeat of the reward line) plus the code accessible via the disclaimer banner or a small persistent "Your bonus code" affordance — **[my call, flag for confirmation during implementation]**: exact placement of the persistent code display after the first reveal needs one more decision (e.g., a corner chip) — implementer should keep it simple (a line in the disclaimer banner: "Your bonus code: XXXX (claimed)" once revealed) rather than adding a new UI surface.
- **Claimed state**: once the code has been revealed once (localStorage flag), any later display shows the code struck through with "(claimed)" instead of the live copyable code, per brief's exact spec.
- **Disclaimer banner** (sticky, non-dismissible): *"Demo mode — nothing you do here is saved to a database or shared with anyone. It only lives in this browser."*
- **Guide overrides** (`SPOTLIGHT_STEPS`, override 3 of ~19 by id):
  - `theme` step: append *"Full customization is a Free/Pro feature."* to the existing body.
  - `drafts` step: **rewritten** (not skipped — see reasoning below) to: *"Use Create new design to try another template. Saved, named drafts are a Free/Pro feature."*
  - `publish` step: append *"Publishing live is a Free/Pro feature."*
  - `save` step: unchanged.

### Guide-step override mechanism
Confirmed seam: `SpotlightStep.slug` (optional) takes priority over the literal `title`/`body` when set (`SpotlightGuide.tsx` `TooltipCard` renders `step.slug ? tg(...) : step.title`). `EditorShell.tsx:80,2055` passes `steps={SPOTLIGHT_STEPS}` as a prop. Build a small demo-only override map keyed by step `id`, applied via `SPOTLIGHT_STEPS.map(s => overrides[s.id] ? { ...s, slug: undefined, title: overrides[s.id].title, body: overrides[s.id].body } : s)`, passed as the `steps` prop to the demo's `SpotlightGuide` instance. No new i18n `slug`-based keys needed for the 3 overridden steps (falls back to literal strings) — but the literal strings themselves still need to exist in all 5 locale files as new keys (e.g. under a new `portfolioMakerDemo.guideOverrides.*` namespace), consumed via `t()` at the call site rather than hardcoded, to satisfy the locale-parity requirement.
**Rewrite, not skip, the `drafts` step** [my call]: skipping would change the tour's step count/numbering, which is more structurally invasive than the already-proven title/body override seam. Rewriting keeps the guide's shape identical between real editor and demo.

### Promo code: new `demo1mo` type, stacking via `pendingPromoGrant`
Confirmed exact mechanics via `beta2mo`'s branch in `redeemPromoCodeAction` (`lib/actions/promoCode.ts:39-115`) — this is the pattern to mirror minus the beta-eligibility gate:
1. Add `"demo1mo"` to `PROMO_CODE_TYPES` in `lib/db/models/PromoCode.ts:3`.
2. In `redeemPromoCodeAction`, add a new branch (parallel to the existing `if (promoCode.type === "beta2mo")` check) for `type === "demo1mo"`:
   - Skip the `betaParticipation`/`betaPromoRedeemedAt` gate entirely (confirmed beta-specific, not present in the generic queue-or-grant logic).
   - Reuse the atomic `codesRedeemed` claim (`$addToSet` + `modifiedCount` check, `:57-66` pattern).
   - `if (isEntitled(ctx.workspace))` → queue via `Workspace.updateOne({ $set: { "pendingPromoGrant.grantMonths": 1, "pendingPromoGrant.queuedAt": now } })` (mirrors `:79-95`).
   - `else` → grant immediately: `grantPlan(ctx.workspace._id, { plan: "pro", expiresAt: now+1month, session })` (mirrors `:96-108`).
   - No transaction strictly required if skipping the beta-specific double-claim, but keep the existing transaction wrapper for consistency/safety with the `codesRedeemed` write — reuse the same `session.withTransaction` scaffold.
3. Consumption of the queued grant is already fully generic (`pendingGrantUpdate()`, `lib/billing/pendingPromoGrant.ts:30-47`) — confirmed used at 4 existing call sites (webhook expiry, lifecycle sweep, `checkGrantExpiry`, `closeBetaProgram`). **No changes needed there.**
4. **Single shared code, seeded as a base/prod fixture** — this is one fixed redeemable code shown to every demo visitor (not a unique code per session, not multiple codes), giving a flat 1 free month of Pro on redemption (one-time-per-workspace, enforced generically by the existing `codesRedeemed` claim). Add it as a **5th entry in `PROMO_CODE_SEEDS`** (`lib/db/seed-fixtures.ts:7-19`, alongside `LIFETIME2026`/`YEARPRO2026`/`MONTHPRO2026`/`BETA2PRO`), e.g. `{ title: "Portfolio Maker demo: 1 month Pro", code: "<TBD>", type: "demo1mo", expiresAt: null }`. Update `PromoCodeSeed["type"]`'s literal union (`lib/db/seed-fixtures.ts:10`) to include `"demo1mo"`. This makes it seed automatically wherever `scripts/seed-base-promos.ts` already runs — **including production** (per the user's explicit instruction), the same way the other 4 base codes do. Do not use the ad-hoc `scripts/seed-promo-code.ts` path for this one.
5. The demo never calls `redeemPromoCodeAction` itself (no workspace exists pre-signup) — it only displays the code string and directs the visitor to the existing promo-code entry UI in `app/[locale]/(onboarding)/onboarding/plan/plan-form.tsx` (already wired to this action). No redemption UI is built for the demo.
6. "Claimed" pre-signup state is a `localStorage` flag only (no DB tracking) — the real one-time enforcement is the existing `codesRedeemed` atomic claim at actual redemption time.

### Gate modal implementation
All four gates use one shared modal component (reuse `components/ui/dialog.tsx` primitives — no new dialog primitive needed), parameterized by gate type for copy + optional promo-reveal slot. First-gate-of-session detection via the localStorage claimed/revealed flag.

### Sticky disclaimer banner
No existing sticky/persistent banner primitive in `components/ui/` (confirmed — full directory listed, nothing named banner/alert-bar/sticky/disclaimer). Closest naming precedent is `components/app/beta-ending-banner.tsx` — build a new small `components/app/demo-disclaimer-banner.tsx` following that file's structural pattern (non-dismissible variant: no close button, no dismiss state). Not a `components/ui/` primitive since this is single-purpose, not a reusable base component — don't over-abstract for one caller.

---

## Cross-cutting

- **Nav**: add `portfolioMaker` and `bookDemo` keys under `marketing.nav` (alongside existing `pricing`/`contact`/`signIn`/`getStarted`). Update `marketing-header.tsx` in both the desktop `<nav>` block (`:34-47`) and the mobile `Sheet` nav (`:84-94`) — confirmed these are hand-duplicated links with no shared array, so add the two new `<Link>`s in both places matching existing style. Add to `marketing-footer.tsx`'s hardcoded link list (`:23-42`) too.
- **Locales**: update `en`, `fil`, `id`, `ar`, `th` for every new string: both marketing pages, book-a-demo form + success state, demo editor's new UI (entry screen, "Create new design" confirm, counters, 4 gate modals, promo reward/claimed copy, disclaimer banner, 3 guide overrides), nav labels, email copy (`EMAIL_COPY.demoBookingConfirmation`, `en/fil/th/id` only — `ar` excluded from `Locale` type per existing convention, confirmed). Reuse existing `app.pageBuilder.editor.*` keys for anything carried over unchanged (undo/redo, viewport toggle, save button, etc.) — only add keys for genuinely new copy.
- **`messages/portfolio-maker-locale-parity.test.ts`**: add a new block to its `BLOCKS` array (confirmed structure: `const BLOCKS = ["inquiries","pageBuilder"] as const`, each checked under `app.*`) for whatever new namespace holds the demo editor's UI copy (e.g. `app.portfolioMakerDemo`), and/or `ROOT_BLOCKS` if the marketing pages' copy lives at a root `marketing.portfolioMaker`/`marketing.bookDemo` namespace outside `app.*` (root-level parity isn't auto-covered — check whether `marketing.*` namespaces already have their own parity guard elsewhere before assuming this file is the only one to extend).
- **Endpoint hardening** (`docs/modules/hosting-ops.md` → `## Endpoint hardening`, verbatim checklist confirmed): both new public endpoints (image upload, book-a-demo submit) get `rateLimit()` + `getClientIp()`, bounded Zod input, graceful external-call failure handling (Cloudflare/Resend), never collapse malformed JSON into `{}`.
- **Tests**: Zod validators, the two new Route Handlers/Server Actions (mock Cloudflare + Resend, never Mongoose), component tests for the demo entry screen, the 4 gate modals, "Create new design" confirm flow, and the promo-reward/claimed-state localStorage logic. New `redeemPromoCodeAction` `demo1mo` branch needs a test mirroring existing `beta2mo` coverage (entitled→queue path, not-entitled→immediate-grant path, one-time-claim enforcement) — locate existing `beta2mo` tests for `promoCode.ts` and add the parallel case.
- **Deferred, not built this PR**: renaming the `"trial"` message key to `freeMonth` (brief marks this a nice-to-have; scope-creep risk) — flag it, don't touch it here.

## Explicit non-goals (unchanged from brief)
No named/multiple drafts. No real publish from a demo session. No reuse of `requireOrg()`-gated code in the demo path. No new Mongoose model for Book a Demo. No new promo-redemption/plan-grant mechanism beyond the one new `demo1mo` branch. No server-side DB tracking of the pre-signup claimed flag. No Paddle/Creem work.

---

## Verification
- `pnpm test --run` scoped to touched files first (validators, new actions/routes, promo redemption branch, locale-parity test), full suite pre-merge.
- `tsc --noEmit` (orchestrator-run only) + lint on all touched files.
- Playwright at 375/768/1280px for both new marketing pages (public-facing) and the demo editor: entry screen, template pick + overwrite-guard dialog, hitting each of the 4 gates (verify exact modal copy + CTA), promo reveal + claimed state after a page reload, disclaimer banner persists across scroll/zone-switch, guide runs with the 3 overridden steps' copy, Save Changes persists across reload, book-a-demo form success/error states.
- Manually verify (or seed a test copy of) the `demo1mo` promo code end-to-end once: reveal in demo → sign up → redeem in onboarding plan step → confirm `pendingPromoGrant` queues correctly when already entitled from the normal free month, and grants immediately when not.
- All 5 locale files pass the extended parity test.
