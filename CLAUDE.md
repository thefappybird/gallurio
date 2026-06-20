# Gallurio

Gallurio is a multi-tenant CRM SaaS for event businesses. Each workspace has bookings, clients, calendar, gallery, public pages, and inquiry forms.

## Stack
- Next.js 16 App Router + Turbopack
- React 19.2
- Tailwind v4
- Mongoose 8 + MongoDB Atlas
- WorkOS AuthKit (`@workos-inc/authkit-nextjs`) for identity only; organizations/workspaces and memberships are managed in MongoDB (WorkOS Organizations are NOT used)
- Zod
- react-hook-form
- Puck
- Cloudinary
- Paddle
- Vercel Workflow DevKit (`workflow`, `@workflow/next`) for durable subscription checkout
- next-intl
- pnpm
- RTK (`rtk-ai/rtk`) for token-efficient command and prompt compression

## Framework rules
- Next.js 16 only: use local docs when unsure
- `middleware.ts` is `proxy.ts` and exports `proxy`
- `params` and `searchParams` are async and must be awaited
- Prefer current repo/library docs over model memory

## Working style
- Keep prompts, commands, and outputs compact, high-signal, and non-repetitive
- Use RTK when it reduces tokens without changing required semantics
- Simplicity beats abstraction
- Fix the task directly; do not over-engineer
- If nearby code can be improved, verify current behavior first, then ask before changing it
- Never mention AI tools in code, commits, PRs, comments, or output
- Do not speculate on ambiguous requirements; use AskUserQuestion to get the user's decision/context before acting

## RTK command policy
- Prefer explicit RTK commands for verbose shell output
- Use:
  - `rtk read`, `rtk grep`, `rtk find`, `rtk ls`
  - `rtk git status`, `rtk git diff`, `rtk git log`, `rtk git add`, `rtk git commit`, `rtk git push`, `rtk git pull`
  - `rtk vitest`, `rtk test <cmd>`, `rtk err <cmd>`
  - `rtk lint`, `rtk tsc`, `rtk next build`
- Prefer explicit RTK commands over automatic rewrite
- On Windows outside WSL, do not assume auto-rewrite works; call RTK directly
- Avoid relying on RTK rewrites for `pnpm <script>` when filters, env vars, script flags, or exact script behavior matter
- Fall back to native commands when exact raw output, patch compatibility, piping, or full uncompressed diffs/logs are required
- Prefer:
  - `rtk vitest` over `pnpm test`
  - `rtk lint` over `pnpm lint`
  - `rtk tsc` over `pnpm typecheck`
  - `rtk next build` over `pnpm build`
  when summarized output is sufficient

## Agent delegation
- Use delegation for non-trivial work
- Haiku: read files, search codebase, gather context, polish prompts
- Sonnet: implementation
- Opus Medium: planning and code review only
- Sonnet and Opus do not read files directly; use Mini readers for context
- Run independent Mini readers in parallel
- Skip delegation only for trivial one-liners
- Prompt polishing lives in `.claude/`
- Never use Sonnet with 1M context.

## Codebase memory (codebase-memory-mcp)
- Maintain a knowledge-graph index of the codebase via the `codebase-memory-mcp` server and prefer it over re-crawling files.
- Index every new branch/worktree as its own project: right after `git worktree add ... .claude/worktrees/<slug>`, run `index_repository { repo_path: "<absolute worktree path>" }` (`mode: "full"` for the first index; `fast`/`moderate` for refreshes).
- Keep the index fresh: re-run `index_repository` (or `detect_changes`) after significant edits, after pulling, and when switching branches. The graph is only as accurate as its last index.
- Before querying, confirm the project exists/its name with `list_projects`, and check `index_status { project }`. Pass `base_branch: "dev"` to `detect_changes` (default is `main`, which this repo does not use).
- Default to the graph instead of broad file reads when locating or understanding code:
  - `search_code` — graph-augmented code search (signatures, ranked by importance)
  - `get_architecture` / `search_graph` / `query_graph` (Cypher) — structure, dependencies, multi-hop and complexity/hot-path analysis
  - `trace_path` — how two symbols connect; `get_code_snippet` — exact source for a node
  - `detect_changes` — branch impact analysis (base `dev`)
- Use it every time it is needed — ESPECIALLY when coordinating multiple subagents:
  - Index the worktree once up front, then have every subagent (and the main loop) query the SAME shared project index rather than each re-reading files. Pass the project name to each subagent.
  - This keeps fan-out agents consistent, avoids duplicated crawling, and saves tokens. Haiku readers should query the graph first and only open files the graph points them to.
- Record durable architecture decisions with `manage_adr`. Set `persistence: true` on `index_repository` to write `.codebase-memory/graph.db.zst` when an index is worth sharing across the team/agents.

## DRY & code reuse (cross-agent)
DRY is enforced across ALL agents, not just within one task. `REUSABLE_CODE.md`
(repo root) is the shared catalog of reusable components, hooks, and helpers, plus
a ranked list of known duplication / extraction candidates. It exists so agents
reuse instead of re-implement, and so they avoid re-reading source files to learn
what already exists.
- **Before writing any component, hook, or helper**: consult `REUSABLE_CODE.md`
  first. If something matching the need exists, import and reuse it — do not write
  a parallel copy. The catalog is the cheap (low-token) way to discover this;
  fall back to the codebase-memory graph only if the catalog is silent.
- **When you create or update a feature**: check whether the same logic already
  lives elsewhere (catalog → codebase-memory `search_code` / `SIMILAR_TO`). If it
  does, extract a single modular version (`components/ui/*` or `components/app/*`
  for UI, `hooks/*` or `lib/hooks/*` for hooks, `lib/<area>/*` for helpers),
  point the call sites at it, and **register it in `REUSABLE_CODE.md`** so future
  agents find it. New genuinely-shared code must be added to the catalog in the
  same change.
- **When you spot duplication you are not extracting now**: add it to the
  "Extraction candidates" section of `REUSABLE_CODE.md` with file paths so it can
  be picked up later. Never silently leave a second copy undocumented.
- Keep the catalog accurate: if you move/rename/delete a reusable module, update
  its entry. A stale catalog costs more tokens than no catalog.
- Reuse must not break the design/tenancy rules below — a shared component still
  ships all UI states and a shared query still scopes by `workspaceId`.

## Tooling: browser verification & plugins
Use the installed MCP servers and plugins whenever they fit the task — they are
faster and more accurate than guessing, and several Done-criteria depend on them.
- **Playwright (prefer the CLI, not the MCP plugin)**: use Playwright to actually
  drive the app in a browser when a change is UI-facing or behavioral. **Default
  to the Playwright CLI** (`@playwright/test` via `pnpm exec playwright test`) — it
  costs far fewer tokens than the `mcp__plugin_playwright_playwright__*` MCP
  plugin, which should be avoided for routine verification and reserved only for
  one-off interactive exploration that a scripted spec can't express. The repo is
  wired for the CLI: `playwright.config.ts` loads `.env.local` via dotenv, an
  `auth.setup.ts` project logs in once and reuses `storageState`, and specs live
  in `e2e/`. Required for the "mobile view checked at 375px" Done-criterion —
  set a 375px viewport, navigate the flow, screenshot, and assert loading/empty/
  error/populated and idle/hover/focus/active/disabled states. Also use it to
  reproduce bugs and confirm fixes end-to-end (browser → action → result) rather
  than asserting from code alone.
  - **Submit only when the flow requires it; minimize side effects**: submitting
    forms / triggering mutations (create/invite/save/pay) is allowed when needed
    to verify a flow end-to-end, but the dev DB is shared and seeded — do it
    deliberately, prefer the minimal action, avoid destructive ones
    (delete/wipe), and never repeat a submit once it's verified. Where inspecting
    states (idle/focus/error/disabled, validation) already answers the question,
    don't submit.
  - **No unnecessary API calls / refetching / navigation**: this is a hard rule —
    don't reload, re-navigate, re-poll, or re-snapshot when the current DOM
    already answers the question. Navigate once to the target view and assert
    against that state; consolidate related checks into a single page load
    instead of one navigation per assertion; never loop a flow that repeatedly
    hits the server. Each page load reconnects the socket and refetches
    notifications, so keep navigations to the minimum the test truly needs.
  - **Test login env vars** (set in the worktree `.env.local`, values never
    printed/committed): three real WorkOS accounts wired into the seeded
    workspace let Playwright sign in autonomously. The seed (`lib/db/seed.ts`)
    reads the WorkOS user id + email; the matching password is used only to
    sign in via the UI:
    - Owner: `SEED_OWNER_WORKOS_USER_ID`, `SEED_OWNER_EMAIL`, `SEED_OWNER_PASSWORD` (optional `SEED_OWNER_NAME`)
    - Staff/member: `SEED_STAFF_WORKOS_USER_ID`, `SEED_STAFF_EMAIL`, `SEED_STAFF_PASSWORD` (optional `SEED_STAFF_NAME`)
    - Team lead: `SEED_LEAD_WORKOS_USER_ID`, `SEED_LEAD_EMAIL`, `SEED_LEAD_PASSWORD` (optional `SEED_LEAD_NAME`)
    Staff and lead accounts are seeded only when both their id and email are
    present. Turnstile is bypassed in dev (`NODE_ENV=development`), so sign-in
    needs only email + password.
- **context7** (`mcp__plugin_context7_context7__*`): fetch current docs for any
  library/framework/API (Next.js 16, React 19, Mongoose, Tailwind v4, Paddle,
  next-intl, WorkOS, etc.) before relying on memory. Prefer it over web search
  for library docs; pair with the local `node_modules/.../docs` references.
- **codebase-memory-mcp**: default for locating/understanding code (see Codebase
  memory). Query the shared project index instead of broad file reads.
- **Security/static-analysis skills** (semgrep, codeql, differential-review,
  fp-check, the `security-auditor` agent): run when a change touches auth,
  tenancy, webhooks, uploads, payments, public routes, or input validation, and
  for pre-merge passes.
- **Vercel / Figma plugins**: use only when the task is actually about that
  surface (deploy/runtime questions, design-to-code) — do not push them otherwise.
- General rule: reach for the relevant tool when it raises confidence or is
  required by Done criteria; skip it when it adds no signal. Don't claim a UI/flow
  works until you've observed it (Playwright or a real run), not just compiled it.

## Engineering bar
Every executor/planner operates as a senior full-stack engineer with strong mobile-first UI and backend/API design judgment.

### UI
- Design mobile-first at 375px
- Every async surface ships loading, empty, error, and populated states
- Every interactive control ships idle, hover/focus-visible, active, and disabled states
- No hover-only UX
- Drag interactions need visible affordances
- Large mobile flows should use steps/tabs, not tall scroll-heavy modals
- Accessibility is required: semantic HTML, labels, keyboard support, focus management, color not sole signal
- Update all 4 locales together: `en`, `fil`, `ms`, `id` (Thai `th` was phased out — do not add it)
- Prefer optimistic UI for high-confidence mutations

### Backend
- Server Components by default
- Server Actions for in-app mutations
- Route Handlers for webhooks/public APIs
- Validate at boundaries with Zod, then trust parsed types
- Shape responses to caller needs
- Prevent N+1 queries
- Use cursor pagination for unbounded lists
- Make retry-prone mutations idempotent
- Never swallow errors
- Use Node runtime unless Edge is explicitly justified
- Cache intentionally
- Use Mongo transactions for multi-document writes that must succeed together

#### Endpoint hardening checklist (apply when creating OR updating any endpoint)
These are mandatory review points for every Server Action, Route Handler, and
public/server-component data loader. Treat them as acceptance criteria, not
aspirations. The current backlog of known lapses lives in
`docs/backend-audit-findings.md` — read it before touching a flagged area.
- **Rate limiting / abuse control**: every public or cheaply-abusable endpoint
  (inquiry submit, signed upload, public reads, auth callback, search) must have
  throttling and/or a challenge (honeypot + `rateLimit()` today; CAPTCHA/Turnstile
  where spam-prone). Validate and bound any client-supplied `limit`/`cursor`.
  Note prod runs on Hetzner with no edge WAF, so app-level limiting is the only
  layer. `lib/server/rateLimit.ts` is in-memory/best-effort by design — do not
  assume it is distributed.
- **Extreme-case error handling must never break the app**: no empty/log-only
  catches that continue with bad state; every external call (Paddle, Cloudflare
  Images, WorkOS, Mongo, email) gets a timeout (`AbortController`/`Promise.race`)
  and a graceful failure path; every async route/page tree has an `error.tsx`
  (or try/catch) so one bad record degrades instead of 500ing the page. Webhooks
  must ack (200) after signature verification even when a handler fails, then
  dead-letter/log — never return 500 into a provider retry loop. Don't collapse
  malformed JSON into `{}`; surface a distinct, logged error.
- **N+1 / DB efficiency**: no query-per-item loops — batch with `$in`/`bulkWrite`/
  aggregation. Project to needed fields, `.lean()` read paths, cursor-paginate
  unbounded lists, and confirm a `{ workspaceId, ... }` compound index backs each
  query shape and sort (verify with `explain()` when in doubt).
- **Auth on every page/route, not just login**: every authenticated page calls
  `requireOrg()`, every server action `ownerContext()`/`requireRole()`, every
  route handler an explicit identity or signature check. Never add an
  authenticated surface that relies on the middleware alone.
- **Auth token / secret exposure**: never log tokens/sessions/cookies/headers,
  never return session state to the client or serialize it into props, never put
  a secret in a `NEXT_PUBLIC_` var. Auth secrets stay server-only.
- **MongoDB tenant isolation (the RLS-equivalent)**: Mongo has no row-level
  security — isolation is YOUR code. Every tenant-scoped read filters by
  `workspaceId`; every mutation by `_id` also filters by `workspaceId`;
  client-supplied `workspaceId` is never trusted (resolve from session +
  re-validated active-workspace cookie); public routes resolve
  `orgSlug -> workspaceId` before any tenant read. See Multi-tenant rules.

## Multi-tenant rules
- Never trust client-supplied `workspaceId`
- Resolve tenant scope from the WorkOS session + MongoDB memberships (never from WorkOS Organizations — they are not used); see Auth & tenancy
- Every tenant-scoped query must include `workspaceId`
- Every mutation by `_id` must also filter by `workspaceId`
- Public routes must resolve `orgSlug -> workspaceId` before reading tenant data
- Every new compound index starts with `workspaceId`

## Design rules
- Use semantic tokens only, never raw color utility values
- Prefer flat UI and borders over shadows/gradients
- Color palette is a softened neutral-cool OKLch ramp — no pure black or pure white in either theme; light base is an off-white (~oklch 0.972), dark base is a charcoal (~oklch 0.205)
- Brand teal (hue 195) is the deliberate accent outlier — use it for things that should catch the eye: focus rings, active nav/sidebar item, calendar highlights, hover accents; aim for ~10–20% of any view
- App shell font is **Plus Jakarta Sans** (`--font-jakarta` / `--font-sans`); Merriweather is loaded only as a portfolio brand-kit font option
- Interactive controls (buttons, inputs, badges, dropdowns, tooltips, toasts) use `--radius` (default 0.25rem, "subtle"); structural frames (cards, dialogs, sidebar, panels) use `--radius-surface` (default 0rem, sharp) — controls soft, frame sharp
- Roundness is governed by the `data-radius` attribute on `<html>` + `lib/theme/appTheme.ts` (`AppThemeConfig`, `appThemeAttributes`, `DEFAULT_APP_THEME`); extend theming there, not via ad-hoc Tailwind classes
- Public portfolios may override brand styling only inside the public page wrapper

## Architecture
- Monolith Next.js app
- Shared DB multi-tenancy via `workspaceId`
- Organizations/workspaces are MongoDB `Workspace` docs, not WorkOS Organizations (see Auth & tenancy)
- Public pages live at `/w/[orgSlug]`

## Production hosting
- Favor **Hetzner** for production web hosting over Vercel because the pricing is materially better for Gallurio's steady-state app workload
- Treat Hetzner as the default production build target when documenting deploys, infra, cron, backups, and custom-domain setup
- Keep deployment automation explicit: GitHub Actions should run tests, lint, typecheck, and build before shipping the production artifact to Hetzner
- Default Hetzner shape for this repo: Ubuntu LTS VPS, Node 20+, `pnpm`, a long-lived app process (`pm2` or `systemd`), and Caddy or Nginx as the reverse proxy
- Production deploy checklist for this Next.js app:
  - provision the server, create a non-root deploy user, enable firewall, and install Node LTS + `pnpm`
  - sync production env vars, then run `pnpm install --frozen-lockfile`, `pnpm build`, and `pnpm start`
  - run the app behind Caddy or Nginx on `80/443` and proxy to the local Next.js process on `3000`
  - automate deploys with GitHub Actions so prod only updates after tests, lint, typecheck, and build pass
  - configure logs, restarts, backups, health checks, and TLS before calling the host production-ready
- Before a full Hetzner cutover, audit any Vercel-coupled capability and either replace it or keep it as an explicit external dependency

## Auth & tenancy
- WorkOS AuthKit is identity-only: sign-in/up, password, Google OAuth, MFA, email verification. WorkOS Organizations are NOT used; all org/workspace and membership state lives in MongoDB.
- Identity: `getAuthUser()` (`lib/auth/session.ts`) is the single authoritative reader — it wraps `withAuth()`; never call `withAuth()` anywhere else. Users are JIT-provisioned by `ensureUser()` (upsert keyed on `workosUserId`) at every authenticated entry point.
- Tenancy: `Workspace` docs own tenancy. A user's workspace memberships are embedded in `User.memberships[]` (`{ workspaceId, role: "owner" | "staff", lastAccessedAt }`). Team-level membership is the separate `TeamMembership` collection (`{ workspaceId, teamId, workosUserId, role: "member" | "lead" }`).
- Active workspace = signed HMAC cookie `gw_active_ws` (`lib/auth/activeWorkspace.ts`), ALWAYS re-validated against the DB memberships list — never trusted as an authz input on its own. Resolution: valid cookie -> most-recent `lastAccessedAt` -> sole membership -> null (-> onboarding).
- Resolve request context via `requireOrg()` (page-level, redirects) or `ownerContext()` (server action, returns `{ error }`). Both derive role as `workspace.ownerUserId === workosUserId` OR `membership.role === "owner"`. Use `requireRole("owner")` to hard-gate owner-only work.
- A user owns at most one workspace: onboarding (`lib/actions/onboarding.ts`) upserts the `Workspace` keyed on `ownerUserId`, so re-running edits the same workspace rather than creating another. This is NOT backed by a unique index — add a unique index on `Workspace.ownerUserId` if hard enforcement is required. Staff may belong to multiple workspaces.
- Invites are email-bound with a single-use SHA-256 token hash (`Invitation` model); acceptance is transactional and writes `User.memberships` + `TeamMembership`. No WorkOS org calls.
- Request gating: `proxy.ts` runs `authkitMiddleware` (explicit public-path allowlist) then next-intl, and localizes `/sign-in` redirects. OAuth lands at `/api/auth/callback` (verifies signed state + CSRF nonce, exchanges code, sets the sealed `wos-session` cookie, JIT-provisions, redirects).
- Sign-out: `signOutAction()` (`lib/auth/signOut.ts`) clears `gw_active_ws`, then WorkOS `signOut()` clears `wos-session` and redirects to `/sign-in`.
- User-facing copy must never name the auth provider ("WorkOS"); keep it generic.

## Auth env
- `WORKOS_API_KEY`
- `WORKOS_CLIENT_ID`
- `WORKOS_COOKIE_PASSWORD` (>=32 chars; seals `wos-session`)
- `ACTIVE_WORKSPACE_COOKIE_SECRET` (signs `gw_active_ws` and the OAuth `state` param)
- `NEXT_PUBLIC_WORKOS_REDIRECT_URI`
- `WORKOS_COOKIE_NAME` (optional; defaults to `wos-session`)
- `AUTHKIT_DEBUG` (optional; `"true"` enables middleware session logging)

## Portfolio builder
- Public portfolio has exactly 3 pages: Home, Gallery, Contact
- Source of truth: `Workspace.publicPage`
- Do not create separate portfolio-related collections unless explicitly needed
- Shared Puck config powers editor and renderer
- Contact form is fixed
- Inquiry submission creates `Inquiry` + match/create `Client` + inquiry-status `Booking` in one transaction
- Owner converts inquiry into booked work from the app; no in-app quote negotiation flow in MVP

## Cloudinary
- Browser uploads go direct via signed endpoint
- Store both `url` and `cloudinaryPublicId`
- Thumbnails are derived from URL transforms
- Delete remote asset when deleting image-bearing docs

## Billing
- Paddle replaces HitPay for Gallurio subscription billing
- Paddle is Merchant of Record for subscriptions
- Use Vercel Workflow DevKit for durable checkout flows that wait on Paddle webhook confirmation
- Keep `Workspace.plan` provider-agnostic: `free | starter | pro`
- Workspace billing fields:
  - `paddleSubscriptionId`
  - `paddleCustomerId`
  - `paddleSubscriptionStatus`
  - `paddleCurrentPeriodEnd`
  - `paddleCheckoutWorkflowRunId`
- Paddle recurring prices are pre-created in the dashboard and referenced by env vars
- Webhook verification must use raw body + HMAC before parsing
- Webhooks run on Node, not Edge
- Checkout flow:
  - create Paddle checkout
  - start checkout workflow
  - save workflow run id
  - wait for `subscription.activated`
  - resume workflow
  - update workspace plan/status/period end
- Handle:
  - `subscription.activated`
  - `subscription.updated`
  - `subscription.canceled`
  - `subscription.past_due`
  - `transaction.completed`
- Marketplace / split payments are not in MVP
- Workspace owners collect end-client payments outside the app in MVP

## Billing env
- `PADDLE_API_KEY`
- `PADDLE_WEBHOOK_SECRET`
- `PADDLE_API_BASE`
- `NEXT_PUBLIC_PADDLE_CLIENT_TOKEN`
- `PADDLE_PRICE_STARTER_ID`
- `PADDLE_PRICE_PRO_ID`

## Encoding safety
- Never output or save mojibake or broken-encoding text
- Preserve UTF-8 in all files and generated content
- Verify user-facing Unicode characters render correctly
- Fix corrupted text before continuing; do not guess
- Prefer ASCII in code/config unless Unicode is intentionally required

## i18n
- Locales: `en`, `fil`, `ms`, `id`
- Thai (`th`) is phased out (removed 2026-06-11): no `th` message file, routes, or strings — do not reintroduce it
- Routes under `app/[locale]/...`
- Use ICU message formatting
- Public workspace chrome uses workspace country locale, not visitor locale

## Git workflow
- Branch from `dev`
- Branch name format: `action/pages-context`
- All worktrees must live under `.claude/worktrees/`
- Never create worktrees outside `.claude/worktrees/`
- Create with:
  `git worktree add .claude/worktrees/<slug> -b <branch> dev`
- Immediately after creating a branch/worktree, index it with codebase-memory-mcp as its own project:
  `index_repository { repo_path: "<absolute worktree path>", mode: "full", persistence: true }` (use `fast`/`moderate` for later refreshes). This is a required step for every new branch/worktree — see Codebase memory.
- Commit periodically during long tasks: make frequent, small checkpoint commits as each coherent unit of work lands (a fix, a passing test, a refactor step) rather than batching everything into one commit at the end. Many checkpoints are the norm — they bound data loss if a session crashes or context is lost, and keep the branch recoverable. Each checkpoint should be a buildable, self-describing commit; do not wait for the entire task to be "done" before the first commit.
- A worktree starts without a `.env.local`, so the app cannot boot there for Playwright/browser verification. You are allowed to copy the env values from the canonical `dev` checkout's `.env.local` into the worktree's `.env.local` so the app runs and Playwright can drive the real flow. This copy is for local verification only: never commit `.env.local` or any secret value (it must stay git-ignored), never print/log the values, and never paste them into commits, PRs, reviews, or chat output.

## Testing
- Every code change ships with tests
- Test data-layer code, components, handlers, validators, and tenant isolation
- Mock external services only
- Do not mock Mongoose; use in-memory Mongo where needed
- Run relevant tests during development
- Billing tests must cover:
  - Paddle webhook signature verification
  - price/plan mapping
  - workflow resume behavior
  - tenant isolation for billing updates
- Before marking done, pass:
  - affected tests
  - `pnpm typecheck`
  - `pnpm lint`

## Done criteria
A task is done only when:
- implementation is complete
- tests are added and passing
- lint and typecheck pass
- locales are updated
- mobile view is checked at 375px
- optimistic behavior is implemented where appropriate
- errors are surfaced properly
- indexes are confirmed for new queries

## Review / merge flow
- Consolidate locales
- Build
- Run strict code review
  - The code review step must include a Playwright run-through (prefer the Playwright CLI, not the MCP plugin — see Tooling) of any UI changes to confirm they are built to spec — drive the flow in a browser and verify each state (loading/empty/error/populated, idle/hover/focus/active/disabled) plus the 375px mobile view, not just that the code compiles
- Save review as markdown
- Fix review findings
- After the final review passes and all findings are fixed, automatically open a PR for the branch. The PR description must list the completed tasks as a checklist (`- [ ]`) so each can be tested easily later. Only open the PR once there are no remaining tasks on the branch.
- Merge to `dev` only after review and explicit approval

## Commands
- `pnpm dev`
- `pnpm start`
- `pnpm seed`
- Prefer RTK for diff/log/read/test/lint/type/build flows when appropriate

## References
- `REUSABLE_CODE.md` (shared component/hook/helper catalog + extraction candidates — read before building shared code; see DRY & code reuse)
- `docs/backend-audit-findings.md` (known backend lapses to remediate; see Endpoint hardening checklist)
- `SaaS-Blueprint.md`
- `docs/portfolio-maker/`
- `docs/RELEASE-CHECKLIST.md`
- `docs/booking-inquiry-lifecycle.md`
- `docs/notifications-scope.md`
- `node_modules/next/dist/docs/01-app/`
- `node_modules/@workos-inc/authkit-nextjs/`
- `node_modules/@workos-inc/node/`
- `@C:\Users\alexb\.codex\RTK.md`
