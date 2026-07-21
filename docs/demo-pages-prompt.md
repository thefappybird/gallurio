# Task: Portfolio Maker demo + Book a Demo page

Branch `action/demo-pages` and worktree `.claude/worktrees/demo-pages` already exist off `dev`. Work there.

Two new public (unauthenticated) marketing surfaces:
1. **Portfolio Maker demo** — a stripped-down, no-login version of the real portfolio editor, playable by anonymous visitors, persisted to `localStorage` only.
2. **Book a Demo** — a lead-gen form that emails the submitter a confirmation and emails support the lead details.

Brainstorm/plan normally (writing-plans skill etc.) before implementing — this doc is the grounding brief, not a substitute for your own design pass. Everything below is verified against the current repo (not guessed); treat it as fact, not suggestion-to-double-check.

---

## Part 1 — Portfolio Maker demo

### What already exists (reuse, don't rebuild)
- Real editor: `app/[locale]/(app)/portfolio/_components/EditorShell.tsx` (~2150 lines). Client component, Puck-based, two zones (`home`, `gallery`).
- It ALREADY has a pure-localStorage persistence path: `persistLocalDraft()` / debounced write / `beforeunload` flush, keyed `` `gallurio:portfolio-draft:${slug}` ``. No server round-trip happens on every keystroke — only `handleSaveChanges()`/`doPublish()` hit the server. This is the exact mechanic to mirror for the demo, just keyed by a demo id instead of a workspace slug.
- Template system: `lib/page-builder/templates/` — `PORTFOLIO_TEMPLATE_IDS = ["bold","luxury","editorial","minimal","scratch"]` (`types.ts`), barrel `index.ts` exports `PORTFOLIO_TEMPLATES` + `getTemplate(id)`. `types.ts` states these modules are pure data with no server-only imports — safe to import from a client component directly if you go that route.
- `TemplatePickerDialog.tsx` already supports a `welcome` mode with a "Start from scratch" option (`onStartScratch`) and a `switching`/`error` state — reusable as-is for the demo's template picker.
- `EditorShell`'s existing unsaved-changes guard (`guardThenRun`, `pendingAction`, `UnsavedChangesDialog`) is the exact "warn before overwrite" mechanic needed for the new "Create new design" action — reuse the pattern, don't invent a new confirm-dialog primitive.
- `SCRATCH_TEMPLATE_ID = "scratch"` + `resetToScratchCanvas()` already implement "start from scratch."
- Guide: `SpotlightGuide.tsx` is the REAL first-run product tour (numbered steps, dim+cutout highlight) — this is what "the guide feature will exist" refers to. Do NOT confuse it with `SandboxEditorGuide.tsx` — that's a *different*, narrower thing: a second, throwaway `<EditorShell guideMode>` instance mounted *inside* the real authenticated editor page purely to run a scripted 6-step tour with drafts/persistence/publish all disabled and the manual-blocks drawer hidden. It is not a public demo and is not what you're building, though its `guideMode` prop (search `guideMode` in `EditorShell.tsx`) is a useful reference for "how to strip persistence out of EditorShell" since it already disables localStorage/drafts/publish/dismiss-guide when true.
- Cloudflare upload helpers: `lib/storage/cloudflareImages.ts` — `requestDirectUpload(workspaceId: string, subfolder?)`, `imageDeliveryUrl(imageId, opts)`. These functions themselves have NO auth check — auth happens one layer up, in the route handler.

### Hard constraint you must design around
- `app/api/images/direct-upload/route.ts` (the only existing direct-upload route) calls `requireOrg({ allowDuringOnboarding: true })` — it 401s/throws for an anonymous visitor. **Cannot be reused as-is.**
- Every draft/template server action in `app/[locale]/(app)/portfolio/_draftActions.ts` — `createDraftAction`, `updateDraftAction`, `deleteDraftAction`, `getDraftAction`, `listDraftsAction`, `publishDraftAction`, `seedTemplateAction` — starts with `const ctx = await requireOrg(); if (ctx.role !== "owner") return { error: "owner_only" };`. **None of these are callable from the demo.** The demo needs its own template-seed path (either import `getTemplate()`/`template.seedData({ workspace: { name } })` directly client-side since it's pure data, or add one new unauthenticated server action that mirrors `seedTemplateAction` minus the `requireOrg()` call — your call which is cleaner) and must never call the draft CRUD or publish actions.
- `PORTFOLIO_TEMPLATES` currently only gets to the client today as a server-serialized `EditorTemplateSummary[]` prop (see `app/[locale]/(app)/portfolio/page.tsx`) — the demo route is a different entry point, so decide fresh whether to serialize server-side or import the pure template modules client-side.

### Product spec (verbatim, now grounded)
- **No first-visit onboarding.** Skip the real editor's `StoryPromptDialog` / `PortfolioEntryDialog` / "welcome templates" branching entirely (that's the `entryOpen`/`welcomeTemplatesOpen` logic in `EditorShell.tsx`, driven by `guideDismissed`/`storyPromptCompleted`). Replace with a simple, always-shown two-option entry: **"Start from scratch"** or **"Continue where you left off"** (the latter only enabled/shown when a recoverable `localStorage` buffer exists — same detection the real shell already does via `hasRecoverableBuffer`).
- **The guide (SpotlightGuide) exists** and runs for real in the demo — it's not a gimmick tour of a second shell, it's the actual guide overlaying the actual demo editor.
- **No drafts feature, no CRUD.** There is exactly one canvas, one localStorage slot. No named drafts, no drafts list, no rename/delete.
- **Drafts button → "Create new design" button.** Clicking it opens the template picker; picking a template overwrites the current canvas entirely. If the current canvas has unsaved/any changes, show a warning first ("your current design will be lost") before applying — reuse the existing unsaved-changes-guard pattern described above.
- **"Save changes" can still work, localStorage-only.** No server call — it's effectively just a manual/explicit flush of the same local persistence that's already happening on every edit (matches how the real editor already treats localStorage as the always-on buffer beneath the server draft).
- **Publish button stays visible, but is gated, not removed.** There is no public page for a demo session, so clicking Publish must never run the real `publishDraftAction` flow — instead it opens the upsell surface (see Part 3) with copy specific to publishing. Same treatment for full theme customization (see below). This is a deliberate change from an earlier draft of this brief that said to drop Publish entirely — don't drop it, gate it.
- **Themes are partial.** Visitors can browse/select the built-in per-template default brand kits (the `defaultBrandKit` each of the 4 real templates — bold/luxury/editorial/minimal — already ships, per `lib/page-builder/templates/*.ts`) freely inside the Theme panel. But going further — customizing away from a built-in (e.g. changing the font, which is what opens the fuller custom color/font editing + "save as a new theme" capability, i.e. `PortfolioSavedTheme` / the `initialSavedThemes` prop on `EditorShell`) is gated: it opens the upsell surface instead of applying the customization. Verify the exact preset-vs-custom boundary against `ThemePanelDialog.tsx` yourself — this brief has not fully traced that file's internals, only the concept from the `portfolio-theme-brand-kit` skill and `EditorShell`'s `initialSavedThemes`/`PortfolioSavedTheme` prop.
- **Most other editor features stay**: block drag/drop, style toolkit, undo/redo, viewport preview toggle, contact/header/collections-popup panels — whatever isn't explicitly gated above, keep working as in the real editor. Use judgment on anything ambiguous; flag anything you're unsure should stay.
- **Image cap: 10 images total**, with a running "`X/10`" counter visible in the editor UI.
- **Block cap: 20 blocks per page**, counted **separately for `home` and `gallery`** (each zone gets its own 20 and its own running "`X/20`" counter). "Blocks" = top-level Puck content entries in that zone (mirror how `PuckGateReader` in `EditorShell.tsx` already reads `content.length` off Puck store state for a similar purpose).
- **Over-limit UX**: attempting to add an 11th image or a 21st block on a page opens a modal saying the demo's images/blocks are full (show the exact count, e.g. "10/10 images" or "20/20 blocks") with a "Sign up to build without restrictions" CTA (link to `/sign-up`, matching the marketing header's existing `getStarted`/sign-up link).
- **Persistence contingency**: default to the same localStorage-only approach as the real editor (only image *references*/CF ids are stored locally, not blobs, and the cap is 20 blocks/zone + 10 images — this should stay well under the ~5MB localStorage quota). Only fall back to a DB row that gets wiped on page-leave if you actually measure the serialized draft threatening that quota — don't build the DB-wipe-on-leave path speculatively; note it as a documented fallback if you decide localStorage is enough, don't silently skip it if you decide it isn't.

### New image-upload route needed
Existing route is auth-gated (see above), so add a new **public** Route Handler (e.g. under `app/api/portfolio-maker-demo/` or similar — name it sensibly) that:
- Calls `requestDirectUpload()` directly from `lib/storage/cloudflareImages.ts`, passing a synthetic demo-session id (NOT a real `workspaceId`) as the metadata tag.
- Generates/accepts a per-visitor **demo session id** (client generates one on first load, e.g. `crypto.randomUUID()`, persists it in `localStorage` alongside the canvas draft, and sends it with every upload request).
- Enforces the 10-image cap **server-side**, not just client-side-decorative — keep an in-memory counter per demo-session-id (the same shape as `lib/server/rateLimit.ts`'s sliding-window `Map<string, number[]>`, or literally call `rateLimit(sessionId, { limit: 10, windowMs: <session-length> })`) so a visitor can't bypass the client counter by editing local state.
- Also rate-limits by IP (`lib/server/getClientIp.ts` + `lib/server/rateLimit.ts`) per the Endpoint Hardening checklist in `docs/modules/hosting-ops.md` (`## Endpoint hardening`) — this is a public, cheaply-abusable, upload-URL-issuing endpoint.
- Returns a distinct error code the client maps to the "images full" modal, distinguishable from a generic failure.

### Route/page placement
Public demo editor page lives outside `(app)` (which is `requireOrg()`-gated) — put it under `app/[locale]/(marketing)/` alongside the existing `contact`/`pricing`/`privacy` pages, e.g. `app/[locale]/(marketing)/portfolio-maker/page.tsx`, or directly under `app/[locale]/` like `portfolio-preview` already is (that route also deliberately sits outside `(app)`/`(marketing)` — see its own doc comment). Pick whichever fits the shared layout you want (marketing header/footer chrome vs a fullscreen chrome-less editor experience) — the demo editor probably wants to NOT be wrapped in the marketing layout's header/footer while the canvas is open (the real editor page isn't wrapped in `(app)`'s sidebar shell either), but the pre-editor landing/intro content for "Portfolio Maker" (the actual marketing page selling the feature) belongs in `(marketing)`. These can be two different routes: a `(marketing)/portfolio-maker` info/CTA page, and a separate full-bleed `/portfolio-maker/try` (or similar) editor route it links to — your call, just don't stuff the live Puck canvas inside the marketing chrome if it doesn't fit.

---

## Part 2 — Book a Demo page

### What already exists (reuse the pattern, not the code — this is tenant-scoped, the demo form isn't)
- `lib/server/inquirySubmission.ts` is the closest existing analog: Zod-validate → (transaction, N/A here) → send an owner-facing notification email → send a client-facing confirmation email, both **best-effort / never fatal** (each wrapped in its own try/catch, logged, non-blocking).
- `lib/email/inquiryNotification.ts` — owner-facing email. Uses `renderBrandedEmail()` (`lib/email/layout.ts`) with a fixed `locale: "en"`, `gallurioBrand()`-equivalent branding, and an `EmailBlock[]` "rows" table (`{ type: "rows", rows: [{ label, value }, ...] }`) to lay out the submitted fields. **This is the pattern for the support-facing "new demo booking request" email** — same rows-table shape, populated with whatever the Book a Demo form collects (name, email, business/studio name, message, etc.).
- `lib/email/inquiryClientConfirmation.ts` — client-facing email. Uses `renderBilingualEmail()` with `EMAIL_COPY` entries from `lib/email/messages.ts` (locale-aware via `emailLocale()`), sender-agnostic subject that's kept English-only for scannability. **This is the pattern for the submitter-facing "we got your request" email** — new `EMAIL_COPY` entry, something like `EMAIL_COPY.demoBookingConfirmation`, following the existing `inquiryConfirmation` shape (`subject`, `greeting`, `body1`, `body2`, `body3` per-locale functions).
- `lib/email/brand.ts` — since this form belongs to Gallurio itself (not a tenant workspace), use `gallurioBrand()` for both emails, not `resolveWorkspaceBrand()`.
- `lib/email/send.ts` — `sendEmail({ to, subject, html, text, replyTo?, attachments? })`. Never throws; returns `{ ok: false, error }` on failure — callers must not let a failed email break the user-facing success response (mirror `inquirySubmission.ts`'s try/catch-per-send).
- Support address constant: `SUPPORT_EMAIL = "support@gallurio.com"`, currently only declared locally inside `app/[locale]/(marketing)/contact/page.tsx` — reuse that literal value (hoist it somewhere shared if that feels warranted, your call, but don't invent a different address).
- Rate limiting: `lib/server/rateLimit.ts` + `lib/server/getClientIp.ts`, same pattern the real inquiry form uses per the Endpoint Hardening checklist — apply it here too (public, unauthenticated, email-sending form = classic spam target).

### Product spec
- A public Server Action or Route Handler, Zod-validated at the boundary, no auth.
- **No DB persistence** — the user's own spec only asked for two emails (confirmation to submitter, notification to support); don't add a Mongoose model/collection for this. If you think a lead record would be valuable, say so as a flagged suggestion rather than building it — matches the "don't speculate/don't add unrequested persistence" project convention.
- Fields: not explicitly specified by the user — design something reasonable and minimal (e.g. name, email, business/studio name, and a free-text message/what-they-want-to-see) rather than copying the full tenant inquiry form's event/sessions/location fields, which don't apply here. Keep it a single short form, not a multi-step wizard.
- On successful submit:
  1. Send the submitter a confirmation email (Resend, via `sendEmail`): booking/demo request received, tell them to keep an eye on their inbox, someone from the team will follow up soon.
  2. Send `support@gallurio.com` a notification email with the submitter's email + every field they entered, so support has context.
  3. Show the submitter an in-app success state saying the same thing (request received, check your email) — don't rely on the email alone for that confirmation.
- Both sends are best-effort/non-fatal exactly like `inquirySubmission.ts` — a failed notification email must not make the form report failure to the submitter if their own confirmation still needs to be attempted independently (evaluate whether success should require the confirmation email specifically to succeed, or is unconditional once validated — your call, but be deliberate and say which you picked).

### Route/page placement
`app/[locale]/(marketing)/book-demo/page.tsx` (or similar kebab-case slug matching the existing `contact`/`pricing`/`privacy`/`refunds`/`terms` siblings), with a form + Server Action, following the same file-organization convention as those pages.

---

## Part 3 — Upsell messaging system, promo reward, guide changes, disclaimer banner

This part governs everything that happens when a demo visitor hits a gate (image cap, block cap, Publish, theme customization) and how the demo rewards them for trying it.

### Copy is NOT this agent's to finalize
The user wants to co-write these messages, not receive them as a fait accompli: **"the agent should bounce message ideas with me for each of them — I will only approve them on planning as the final text to show, as a final decision."** Concretely: during your planning/brainstorming pass, draft 2–3 short options for EACH distinct gated surface below (image cap, block cap, Publish, theme customization, the promo-reward callout, the sticky disclaimer banner, and the guide-step overrides), present them to the user, and get explicit sign-off before writing any of it into components or locale files. Do not silently pick "the best one" and proceed to implementation.

### Every gate gets its OWN message — not one generic "upgrade" modal
The user's explicit ask is cohesion through *variety*: hitting the image cap, the block cap, clicking Publish, and trying to customize a theme must each surface distinct, purpose-written copy (not the same boilerplate paywall text reused four times). All four point to the same underlying action (sign up / go to `/sign-up`), but the framing differs per surface:
- Image cap hit (11th image): image-specific message.
- Block cap hit (21st block on a page): block-specific message.
- Publish clicked: publishing-specific message (mention Gallurio Pro by name, since publishing is a Pro-tier action per `docs/modules/billing.md`'s plan model — `Workspace.plan: free|pro|beta`).
- Theme customization attempted (see Part 1's preset-vs-custom boundary): theme-specific message.
- Modal vs. a lighter popover/toast is explicitly undecided — the user floated both ("it could be a modal, or it could be a pop up to be less distracting"). Bring this as an option in the same planning conversation as the copy, not just the copy itself.

### Encourage signup via Gallurio's free month — never call it a "trial"
Every one of these surfaces should nudge toward signing up for **Gallurio's existing one-month-free-Pro-on-signup** (not toward paying immediately) — per `docs/modules/billing.md`: *"One month of free Pro on signup, then a hard gate to `/subscribe`. No permanent free tier."* This is a **project-level convention already in force**, not new for this feature: `[[project_free_mode_lifecycle]]`-equivalent memory notes there is deliberately **no LS trial** — Pro is a straight paid subscription, and the free month is a one-time grant (`User.freeTrialConsumedAt` guards it, set in `lib/actions/onboarding.ts`), not a cancel-before-you're-charged trial. Word all new copy (upsell surfaces, promo callout, and any pricing-page edits below) as **"one month free"** / **"free month"**, never **"trial"** or **"trial period"**.
- Audit existing pricing-adjacent copy while you're in there: `messages/en.json` has a key literally named `"trial"` (value: `"1 month of full Pro access"` — search the `plans`/`onboarding` namespaces) feeding the onboarding plan step's feature list. The displayed text is fine, but the key name itself invites exactly the confusion the user is flagging — consider renaming it (and its 4 other-locale counterparts) to something like `freeMonth` while you're touching nearby copy, but this is a nice-to-have, not the core ask; don't scope-creep into a full pricing-page rewrite beyond what these new features actually touch.

### Promo reward for hitting a limit — reuse the existing PromoCode system, don't build a new one
Gallurio already has a **complete, working, generic promo-code + plan-grant system** — ground every part of this in it:
- `lib/db/models/PromoCode.ts`: `{ code (unique, lowercased), type: "lifetime"|"yearly"|"monthly"|"beta"|"beta2mo", expiresAt, revokedAt }`.
- `lib/actions/promoCode.ts` → `redeemPromoCodeAction(code, { onboarding? })`: an authenticated (`ownerContext`) Server Action — **only callable once a workspace exists**, i.e. after sign-up. It's already wired into the onboarding flow's plan step: `app/[locale]/(onboarding)/onboarding/plan/plan-form.tsx` (`PlanStepForm`) has an existing promo-code entry UI (`TicketPercent` icon, code input) that calls this action. **This is "the code drawer" — where a demo visitor redeems their reward after signing up.** The demo does not need to build any redemption UI of its own; it only needs to hand the visitor a code string and tell them where to enter it.
- One-time-per-workspace claim enforcement already exists: `Workspace.codesRedeemed[]` (ref `PromoCode`), enforced via an atomic `$addToSet` + `modifiedCount` check in `redeemPromoCodeAction` — reused as-is, not reinvented.
- **Stacking "on top of" the normal free month** — this is the important nuance. Look at the two existing redemption branches in `redeemPromoCodeAction`:
  - The plain `monthly`/`yearly`/`lifetime`/`beta` branch calls `grantPlan()` directly, which **overwrites** `planGrantExpiresAt` to "now + N" — it does NOT stack on an existing entitlement.
  - The `beta2mo` branch is different on purpose: it checks `isEntitled(ctx.workspace)` first — if already entitled (e.g. still inside their normal free month), it **queues** the extra time via `pendingPromoGrant.{grantMonths,queuedAt}` (`lib/billing/pendingPromoGrant.ts`'s `pendingGrantUpdate()`), consumed automatically whenever the workspace's current entitlement actually expires (webhook, lifecycle sweep, or beta close — see `lib/billing/betaProgram.ts`'s `closeBetaProgram()` for a worked example of consuming a queued grant). If NOT yet entitled, it grants immediately instead.
  - Since the user wants the demo's reward to land **"on top of their free sub"** (i.e., extend past the normal one free month, not replace it), the new demo promo code needs the **`beta2mo`-style queuing behavior**, not the flat-overwrite behavior — add a new `PromoCodeType` (e.g. `"demo1mo"`) and a new branch in `redeemPromoCodeAction` that mirrors the `beta2mo` branch's `isEntitled` check + queue-or-grant logic, but with `grantMonths = 1` and none of `beta2mo`'s beta-participation eligibility gate (`user.betaParticipation`/`User.betaPromoRedeemedAt` — those are specific to the beta program, not relevant here).
  - Seed the new code the same way existing promo codes are seeded: see `scripts/seed-promo-code.ts` / `scripts/seed-base-promos.ts` for the convention (read them before writing the seed).
- **"Claimed" state in the demo itself is separate from workspace-level redemption** (there is no workspace yet — the visitor is anonymous). Track "has this browser already unlocked/been shown its demo reward code" as a `localStorage` flag alongside the canvas draft — once set, show the code crossed out with a "(claimed)" label instead of the live/copyable code, exactly as the user described. This is a demo-local UI flag, not a new DB mechanism — don't build server-side tracking for the pre-signup "claimed" state; the REAL one-time enforcement already happens for free at redemption time via `Workspace.codesRedeemed`.
- Trigger: the user said "if they hit any of those limits" — award/reveal the code the first time the visitor hits *any* gate (image cap, block cap, publish click, or theme-customization attempt) in a session, not once per gate type.

### Guide (SpotlightGuide) changes — only 3 of its ~17 steps
`app/[locale]/(app)/portfolio/_components/spotlightSteps.ts` exports `SPOTLIGHT_STEPS`. Exactly three steps need demo-specific copy overrides — the rest of the tour runs unchanged:
- `id: "theme"` (title: "Pick your colors and fonts") — needs a demo note that full customization is Free/Pro-only.
- `id: "drafts"` (title: "Save drafts and switch versions") — this step's premise doesn't even apply anymore (the demo has no drafts feature, replaced by "Create new design") — decide whether to skip this step entirely in demo mode or rewrite it to describe "Create new design" instead, and to note that saved/named drafts are a Free/Pro feature.
- `id: "publish"` (title: "Publish to go live") — needs a demo note that publishing is Free/Pro-only.
- The `id: "save"` step (Save Changes) does NOT need a rewrite — that still works, localStorage-only, in the demo.
- Implementation-wise: add a way to override specific steps' `title`/`body` by id when the guide is running inside the demo (e.g. a small override map applied on top of `SPOTLIGHT_STEPS`), rather than forking the whole steps array.

### Sticky, non-dismissible disclaimer banner
Always visible in the demo editor (not just on first load — persistent, no close button), stating, in substance:
1. This session's data is not saved to any database — it's stored locally, in this browser only.
2. Nothing is collected, and nothing is shared with any other visitor/user anywhere.
Exact wording is part of the copy-approval process above — draft options, don't finalize. Check for an existing sticky-banner UI primitive in `components/ui/` before building a new one from scratch (none was found during this brief's research, but verify — don't duplicate if one exists).

---

## Cross-cutting requirements (apply to both parts)

- **Nav**: add links to both new pages in `app/[locale]/(marketing)/_components/marketing-header.tsx` (desktop nav AND the mobile `Sheet` nav — it currently duplicates the `pricing`/`contact` links in both places, keep that duplication pattern) and in `marketing-footer.tsx` if it lists page links. New i18n keys go under the existing `marketing.nav` namespace (currently has `pricing`, `contact`, `signIn`, `getStarted`).
- **Locales**: update all 5 — `en`, `fil`, `id`, `ar` (RTL), `th` — for every new string across both pages, the nav, the demo editor's new UI (limit-reached modal, "Create new design" confirm dialog, simplified entry screen, counters), and everything in Part 3 (per-gate upsell copy, promo callout + claimed state, guide-step overrides, sticky banner). Reuse existing `app.pageBuilder.editor.*` keys for any UI element carried over unchanged from the real editor (undo/redo, viewport toggle, etc.) — only add new keys for genuinely new copy. All Part 3 copy goes through the copy-approval process before it's written into any locale file.
- **`messages/portfolio-maker-locale-parity.test.ts`**: despite the name, this is a pre-existing generic key-tree-parity guard for `app.inquiries`, `app.pageBuilder`, and root `inviteAccept` — it is NOT related to this feature by anything other than name coincidence, and does NOT mean any of this already exists. If you introduce a new namespace (e.g. a `marketing.portfolioMaker`/`marketing.bookDemo` block, or a new root-level demo-editor block) that deserves the same "all 5 locales must have the identical key tree" guard, extend this test's `BLOCKS`/`ROOT_BLOCKS` arrays — don't rename or repurpose the file.
- **Endpoint hardening** (`docs/modules/hosting-ops.md` → `## Endpoint hardening`): both new public endpoints (demo image upload, book-a-demo submit) need rate limiting/abuse control, bounded input, and graceful external-call failure handling per that checklist.
- **Tests**: validators, the new Route Handler(s)/Server Action(s), and component tests for the new demo-editor entry screen / limit modals / "Create new design" flow. Mock external services only (Cloudflare, Resend) — never mock Mongoose if you end up touching it at all (you likely won't, since neither part persists to the DB).
- **Done criteria** per CLAUDE.md: lint + typecheck clean, 3 breakpoints (375/768/1280 — both new marketing pages are public-facing, so all three, not just desktop) verified in a real browser via Playwright, all 5 locales updated, loading/empty/error/populated states for the async bits (image upload, form submit), idle/hover/focus-visible/active/disabled for every control.

## Explicit non-goals (don't build these)
- No named/multiple drafts, no draft rename/delete, no drafts list UI, in the demo.
- No public page ever actually produced from a demo session — Publish stays as a gate/upsell trigger only, never a real publish.
- No reuse of `requireOrg()`-gated actions/routes anywhere in the demo path.
- No new Mongoose model for Book a Demo submissions.
- No new promo-redemption or plan-grant mechanism — extend `redeemPromoCodeAction`/`PromoCode`/`grantPlan`/`pendingPromoGrant` with one new code type, don't build parallel infrastructure.
- No server-side DB tracking of the demo's pre-signup "claimed" flag — that's a `localStorage` UI flag only; the real one-time enforcement is the existing `Workspace.codesRedeemed` check at actual redemption time.
- No Paddle/Creem/other-provider billing work — irrelevant here, just avoid accidentally touching billing config while adding the sign-up CTA link.
- Don't finalize any Part 3 copy without running the brainstorm-and-approve step with the user first.
