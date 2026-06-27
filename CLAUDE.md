# Gallurio

Multi-tenant CRM SaaS for event businesses. Each workspace has bookings, clients, calendar, gallery, public pages, and inquiry forms.

## Stack
Next.js 16 App Router + Turbopack · React 19.2 · Tailwind v4 · Mongoose 8 + MongoDB Atlas · WorkOS AuthKit (identity only — WorkOS Organizations are NOT used) · Zod · react-hook-form · Puck · Cloudflare Images · Paddle · Vercel Workflow DevKit (durable checkout) · next-intl · pnpm · RTK (token-efficient CLI).

## Framework rules
- Next.js 16 only; prefer current repo/library docs (context7 + `node_modules/.../docs`) over model memory.
- `middleware.ts` is `proxy.ts` and exports `proxy`.
- `params` and `searchParams` are async — always `await` them.

## Working style
- Compact, high-signal, non-repetitive output. Simplicity beats abstraction; fix the task directly, don't over-engineer.
- Improving nearby code: verify current behavior first, then ask before changing it.
- Never mention AI tools in code, commits, PRs, comments, or output.
- Don't speculate on ambiguous requirements — batch the genuinely-undecidable questions into ONE AskUserQuestion before acting; run the unambiguous parts meanwhile.

## RTK
Use RTK for verbose shell output when a summary suffices: `rtk read|grep|find|ls`, `rtk git <sub>`, `rtk vitest`, `rtk lint`, `rtk tsc`, `rtk next build`. On Windows call RTK directly (don't rely on auto-rewrite). Fall back to native commands when exact raw output, full diffs/logs, patch compatibility, or piping matter. Full reference: `@C:\Users\alexb\.codex\RTK.md`.

## Agent delegation
Delegation is a cost trade-off, not a reflex: every subagent pays a fixed context tax (CLAUDE.md + skills + tools) before doing any work, so spawning one to read a single file costs MORE than reading it inline.
- **Reads ≤3 files / quick lookups: do them inline** (Read/Grep/Glob) — the orchestrating context is already loaded.
- **Delegate when fan-out amortizes the fixed cost**: a parallel sweep over many files/areas → multiple Explore (Haiku) readers in one message; non-trivial implementation → Sonnet executor(s); planning/review → Opus. Run independent agents in parallel; serialize agents that share files or commit (avoid git index-lock collisions).
- **Tight, closed-ended prompts**: name the exact files and the exact questions, and cap the return ("return the auth guard + the 3 exported signatures, nothing else"). Open-ended prompts make agents wander into extra files and dump verbose context.
- Never use Sonnet with 1M context. Prompt-polishing helpers live in `.claude/`.

## Codebase memory (codebase-memory-mcp) — opt-in
Use the graph index ONLY for large navigation/understanding tasks (multi-hop dependency tracing, architecture maps, broad fan-out where many agents share one index) — there it beats re-crawling and keeps subagents consistent. For routine few-file work, skip it; the token overhead isn't worth it.
- When used: `index_repository` the worktree once (`base_branch: "dev"`), then point queries (`search_code`, `get_architecture`, `trace_path`, `query_graph`, `detect_changes` with base `dev`) at that shared project. Refresh after significant edits/pulls/branch switches.
- Record durable architecture decisions with `manage_adr`.

## DRY & code reuse
`REUSABLE_CODE.md` (repo root) is the shared catalog of reusable components/hooks/helpers + extraction candidates.
- Before writing any component/hook/helper, check the catalog first — reuse, don't re-implement.
- New genuinely-shared code: extract one modular version (`components/ui|app/*`, `hooks/*`/`lib/hooks/*`, `lib/<area>/*`), repoint call sites, and register it in the catalog in the same change. Reuse must still honor the design/tenancy rules.
- Spot duplication you're not extracting now → add it to the catalog's "Extraction candidates" with paths. Keep entries accurate on move/rename/delete.

## Tooling
Reach for a tool when it raises confidence or a Done-criterion needs it; skip it when it adds no signal. Don't claim a UI/flow works until you've observed it running, not just compiled it.
- **Playwright CLI** (`pnpm exec playwright test`, NOT the MCP plugin): drive the app in a browser for UI/behavioral changes. Repo is wired — `playwright.config.ts` loads `.env.local`, `auth.setup.ts` logs in once and reuses `storageState`, specs in `e2e/`. Required for the 3-breakpoint Done-criterion. Recipes + seeded login accounts: see the `portfolio-testing` / `run-gallurio` skills. Minimize side effects on the shared seeded dev DB — prefer inspecting states over submitting; never repeat a verified submit; no needless reload/re-navigate/re-poll.
- **context7**: current library docs (Next 16, React 19, Mongoose, Tailwind v4, Paddle, next-intl, WorkOS) before relying on memory.
- **Security passes**: the trailofbits static-analysis / differential-review / fp-check plugins are disabled by default to save context — re-enable them (and use the `security-auditor` agent) when a change touches auth, tenancy, webhooks, uploads, payments, public routes, or input validation, and for pre-merge audits.

## Engineering bar
Operate as a senior full-stack engineer with strong mobile-first UI and backend/API judgment.

### UI
- Mobile-first at 375px. Verify with Playwright at THREE breakpoints: 375 / 768 / 1280px (desktop-only surfaces like the editor canvas may do 768 + 1280 only; public-facing surfaces must cover all three).
- Every async surface ships loading/empty/error/populated. Every interactive control ships idle/hover-focus-visible/active/disabled.
- No hover-only UX. Drag interactions need visible affordances. Large mobile flows use steps/tabs, not tall scroll-heavy modals.
- Accessibility required: semantic HTML, labels, keyboard support, focus management, color never the sole signal.
- Update all 5 locales together (`en`, `fil`, `ms`, `id`, `ar`). Prefer optimistic UI for high-confidence mutations.

### Backend
- Server Components by default; Server Actions for in-app mutations; Route Handlers for webhooks/public APIs. Node runtime unless Edge is justified.
- Validate at boundaries with Zod, then trust parsed types. Shape responses to caller needs. Cache intentionally.
- Prevent N+1; cursor-paginate unbounded lists; Mongo transactions for multi-doc writes that must succeed together; make retry-prone mutations idempotent; never swallow errors.

#### Endpoint hardening checklist (apply when creating OR updating any endpoint)
Acceptance criteria for every Server Action, Route Handler, and public/server-component data loader. Known lapses: `docs/backend-audit-findings.md` — read before touching a flagged area.
- **Rate limiting / abuse control**: every public or cheaply-abusable endpoint (inquiry submit, signed upload, public reads, auth callback, search) has throttling and/or a challenge (honeypot + `rateLimit()`; CAPTCHA/Turnstile where spam-prone). Bound client-supplied `limit`/`cursor`. Prod runs on Hetzner with no edge WAF — app-level limiting is the only layer; `lib/server/rateLimit.ts` is in-memory/best-effort, not distributed.
- **Error handling never breaks the app**: no empty/log-only catches that continue with bad state; every external call (Paddle, Cloudflare, WorkOS, Mongo, email) gets a timeout + graceful failure; every async route/page tree has `error.tsx` or try/catch. Webhooks ack (200) after signature verification even when a handler fails, then dead-letter/log — never 500 into a provider retry loop. Don't collapse malformed JSON into `{}`.
- **DB efficiency**: no query-per-item loops — batch with `$in`/`bulkWrite`/aggregation. Project to needed fields, `.lean()` reads, cursor-paginate, and confirm a `{ workspaceId, ... }` compound index backs each query shape and sort.
- **Auth on every page/route**: every authenticated page calls `requireOrg()`, every server action `ownerContext()`/`requireRole()`, every route handler an explicit identity or signature check. Never rely on middleware alone.
- **Secret exposure**: never log tokens/sessions/cookies/headers, never return session state to the client or serialize it into props, never put a secret in a `NEXT_PUBLIC_` var.
- **Tenant isolation (RLS-equivalent)**: see Multi-tenant rules — Mongo has no row-level security, your code is the only enforcement.

## Multi-tenant rules
- Never trust client-supplied `workspaceId` — resolve scope from the WorkOS session + re-validated active-workspace cookie + MongoDB memberships (never WorkOS Organizations).
- Every tenant-scoped query includes `workspaceId`; every mutation by `_id` also filters by `workspaceId`.
- Public routes resolve `orgSlug -> workspaceId` before any tenant read. Every new compound index starts with `workspaceId`.

## Design rules
- Semantic tokens only, never raw color utilities. Flat UI + borders over shadows/gradients.
- Palette: softened neutral-cool OKLch ramp, no pure black/white — light base off-white (~oklch 0.972), dark base charcoal (~oklch 0.205).
- Brand teal (hue 195) is the deliberate accent — focus rings, active nav/sidebar, calendar highlights, hover accents; ~10–20% of any view.
- App shell font: **Plus Jakarta Sans** (`--font-jakarta`/`--font-sans`). Merriweather is a portfolio brand-kit font option only.
- Controls soft / frame sharp: interactive controls use `--radius` (0.25rem); structural frames (cards, dialogs, sidebar, panels) use `--radius-surface` (0rem). Roundness governed by `data-radius` on `<html>` + `lib/theme/appTheme.ts` — extend theming there, not via ad-hoc Tailwind.
- Public portfolios may override brand styling only inside the public page wrapper.

## Architecture
Monolith Next.js app; shared-DB multi-tenancy via `workspaceId`. Workspaces are MongoDB `Workspace` docs (not WorkOS Orgs). Public pages live at `/w/[orgSlug]`.

## Auth & tenancy
- WorkOS AuthKit is identity-only (sign-in/up, password, Google OAuth, MFA, email verification). All org/workspace + membership state lives in MongoDB.
- `getAuthUser()` (`lib/auth/session.ts`) is the single authoritative identity reader — wraps `withAuth()`; never call `withAuth()` elsewhere. `ensureUser()` JIT-provisions (upsert on `workosUserId`) at every authenticated entry point.
- Memberships embedded in `User.memberships[]` (`{ workspaceId, role: "owner"|"staff", lastAccessedAt }`); team membership is the `TeamMembership` collection (`{ workspaceId, teamId, workosUserId, role: "member"|"lead" }`).
- Active workspace = signed HMAC cookie `gw_active_ws` (`lib/auth/activeWorkspace.ts`), ALWAYS re-validated against DB memberships — never an authz input on its own. Resolution: valid cookie → most-recent `lastAccessedAt` → sole membership → null (→ onboarding).
- Request context: `requireOrg()` (page-level, redirects) or `ownerContext()` (server action, returns `{ error }`); both derive role as `workspace.ownerUserId === workosUserId` OR `membership.role === "owner"`. `requireRole("owner")` hard-gates owner-only work.
- A user owns at most one workspace (onboarding upserts on `ownerUserId`; not yet backed by a unique index). Invites are email-bound, single-use SHA-256 token hash (`Invitation`); acceptance is transactional.
- `proxy.ts` runs `authkitMiddleware` (explicit public-path allowlist) then next-intl. OAuth callback at `/api/auth/callback` verifies signed state + CSRF nonce. Sign-out: `signOutAction()` clears `gw_active_ws` then WorkOS `signOut()`.
- User-facing copy never names the auth provider — keep it generic.
- Env vars (names) live in `.env.example`; secrets stay server-only.

## Portfolio builder
- Exactly 3 public pages: Home, Gallery, Contact. Source of truth: `Workspace.publicPage`. No separate portfolio collections unless explicitly needed.
- Shared Puck config powers editor and renderer. Contact form is fixed.
- Inquiry submission creates `Inquiry` + match/create `Client` + inquiry-status `Booking` in one transaction. Owner converts inquiry into booked work in-app; no in-app quote negotiation in MVP.
- Internals + gotchas: see the `portfolio-*` skills (architecture, blocks-and-design, drafts, theme-brand-kit, guide, testing).

## Cloudflare Images
- Browser uploads go direct via Direct Creator Upload (`requestDirectUpload`, `lib/storage/cloudflareImages.ts`) — API token never reaches the client.
- Tenant scoping by upload metadata `workspaceId` (no folders); every create route calls `verifyImageOwnership(imageId, workspaceId)`.
- Store asset id (`GalleryItem.assetId`, `assetProvider: "cloudflare"`) + delivery `url`; thumbnails are URL variants via `imageDeliveryUrl()`. Delete the remote image (`deleteImage`) when deleting image-bearing docs. Format/size enforced app-side (`lib/page-builder/photoSpec.ts`).

## Billing
- Paddle (Merchant of Record) for subscriptions; Vercel Workflow DevKit for durable checkout that waits on webhook confirmation. Marketplace/split payments not in MVP.
- `Workspace.plan` stays provider-agnostic (`free|starter|pro`). Billing fields: `paddleSubscriptionId`, `paddleCustomerId`, `paddleSubscriptionStatus`, `paddleCurrentPeriodEnd`, `paddleCheckoutWorkflowRunId`.
- Webhook verification: raw body + HMAC before parsing; Node runtime. Flow: create checkout → start workflow → save run id → wait `subscription.activated` → resume → update plan/status/period end.
- Handle `subscription.activated|updated|canceled|past_due` and `transaction.completed`.

## Production hosting
- Hetzner is the default prod target (materially cheaper than Vercel for steady-state). Shape: Ubuntu LTS VPS, Node 20+, `pnpm`, long-lived process (`pm2`/`systemd`), Caddy/Nginx reverse proxy on 80/443 → local Next on 3000.
- Deploys via GitHub Actions gated on tests + lint + typecheck + build. Audit any Vercel-coupled capability before a full cutover. Configure logs, restarts, backups, health checks, TLS before calling it production-ready.

## i18n
- Locales: `en`, `fil`, `ms`, `id`, `ar` (Arabic is RTL). Thai (`th`) phased out 2026-06-11 — no `th` file/routes/strings; do not reintroduce.
- RTL: `<html dir>` is set from the locale in `app/[locale]/layout.tsx`. Use logical Tailwind utilities (`ms/me/ps/pe/start/end/text-start`) not physical (`ml/mr/pl/pr/left/right/text-left`); mirror directional icons with `rtl:-scale-x-100`. Arabic is user-selectable (sidebar/settings switcher) but `localeForCountry` does NOT yet auto-default Gulf tenants to it.
- Routes under `app/[locale]/...`; ICU message formatting. Public workspace chrome uses workspace country locale, not visitor locale.

## Encoding safety
Preserve UTF-8 everywhere; never output/save mojibake. Verify user-facing Unicode renders; fix corruption before continuing. Prefer ASCII in code/config unless Unicode is intentional.

## Git workflow
- Branch from `dev`; name `action/pages-context`. All worktrees under `.claude/worktrees/` only — create with `git worktree add .claude/worktrees/<slug> -b <branch> dev`.
- Commit periodically: frequent small buildable checkpoints as each coherent unit lands, not one batch at the end.
- A worktree starts without `.env.local`; you may copy values from the canonical `dev` checkout's `.env.local` for local Playwright verification only — never commit, print, or paste secret values anywhere.

## Testing
- Every code change ships with tests: data-layer, components, handlers, validators, tenant isolation. Mock external services only; don't mock Mongoose (use in-memory Mongo). Run relevant tests during dev (`pnpm test --run <fragment>` for targeted; full sweep only at pre-merge).
- Billing tests cover: Paddle webhook signature verification, price/plan mapping, workflow resume, tenant isolation for billing updates.
- Before done: affected tests + `pnpm typecheck` + `pnpm lint`.

## Done criteria
Implementation complete · tests added and passing · lint + typecheck pass · locales updated · views checked at 3 breakpoints (375/768/1280; desktop-only may do 768+1280) · optimistic behavior where appropriate · errors surfaced properly · indexes confirmed for new queries.

## Review / merge flow
- Consolidate locales → build → strict code review (including a Playwright run-through of UI changes across the 3 breakpoints, verifying every state — not just that it compiles).
- Fix findings → once no tasks remain, open a PR whose description lists completed tasks as a `- [ ]` checklist. Merge to `dev` only after review and explicit approval.

## Docs hygiene
- Task/PR docs (spec, plan, audit, review) are scratch. Before the PR, consolidate everything into ONE summary doc under `docs/<area>/` (problem, changes per scope item, key decisions, verification) and delete the rest (recoverable in git). Net result of any PR: at most one new/changed doc.
- Never delete pre-existing durable references (README, master-plan, product-spec-reference, blueprint, backend-audit-findings, RELEASE-CHECKLIST, REUSABLE_CODE).

## Commands
`pnpm dev` · `pnpm start` · `pnpm seed`. Prefer RTK for diff/log/read/test/lint/type/build when a summary suffices.

## References
- `REUSABLE_CODE.md` (read before building shared code)