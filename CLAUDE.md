# Gallurio

Multi-tenant CRM SaaS for event businesses. Each workspace has bookings, clients, calendar, gallery, public pages, and inquiry forms.

## Stack
Next.js 16 App Router + Turbopack · React 19.2 · Tailwind v4 · Mongoose 8 + MongoDB Atlas · WorkOS AuthKit (identity only — WorkOS Organizations are NOT used) · Zod · react-hook-form · Puck · Cloudflare Images · next-intl · pnpm · RTK (token-efficient CLI). Lemon Squeezy is the current implemented billing integration; Lemon Squeezy, Creem, and a possible Paddle sole-proprietor application are the live-payment candidates.

## Framework rules
- Next.js 16 only; prefer current repo/library docs (context7 + `node_modules/.../docs`) over model memory.
- `middleware.ts` is `proxy.ts` and exports `proxy`.
- `params` and `searchParams` are async — always `await` them.

## Working style
- Compact, high-signal, non-repetitive output. Simplicity beats abstraction; fix the task directly, don't over-engineer.
- Improving nearby code: verify current behavior first, then ask before changing it.
- Never mention AI tools in code, commits, PRs, comments, or output.
- Don't speculate on ambiguous requirements — batch the genuinely-undecidable questions into ONE AskUserQuestion before acting; run the unambiguous parts meanwhile.

### Coding principles (Karpathy)
Bias to caution over speed; use judgment on trivial tasks.
- **Think before coding** — state assumptions explicitly; if multiple interpretations exist, surface them, don't pick silently; if a simpler approach exists, say so. Unclear → stop and ask.
- **Simplicity first** — minimum code that solves the stated problem, nothing speculative: no unrequested features/abstractions/config, no error handling for impossible cases. If 200 lines could be 50, rewrite it.
- **Surgical changes** — touch only what the request needs; match existing style; don't refactor or reformat working adjacent code. Remove only the orphans YOUR change creates; flag pre-existing dead code, don't delete it.
- **Goal-driven execution** — turn the task into a verifiable goal and loop until it passes ("add validation" → write tests for invalid inputs, then make them pass). State a brief plan with a per-step verify check for multi-step work.

## RTK
Use RTK for verbose shell output when a summary suffices: `rtk read|grep|find|ls`, `rtk git <sub>`, `rtk vitest`, `rtk lint`, `rtk tsc`, `rtk next build`. On Windows call RTK directly (don't rely on auto-rewrite). Fall back to native commands when exact raw output, full diffs/logs, patch compatibility, or piping matter. Full reference: `@C:\Users\alexb\.codex\RTK.md`.

## Agent delegation
Delegation is a cost trade-off, not a reflex: every subagent pays a fixed context tax (CLAUDE.md + skills + tools) before doing any work, so spawning one to read a single file costs MORE than reading it inline.
- **Reads ≤3 files / quick lookups: do them inline** (Read/Grep/Glob) — the orchestrating context is already loaded.
- **Pre-resolve context before delegating**: before dispatching ANY executor agent, read the files it will touch inline and inject the relevant excerpt (≤300 lines) directly into its prompt. Never send an executor to discover what you can resolve here first. The subagent should receive context, not hunt for it.
- **Delegate when fan-out amortizes the fixed cost**: a parallel sweep over many files/areas → multiple Explore (Haiku) readers in one message; non-trivial implementation → Sonnet executor(s); planning/review → Opus. Run independent agents in parallel; serialize agents that share files or commit (avoid git index-lock collisions).
- **Tight, closed-ended prompts**: name exact files + line ranges, state the exact question, cap the return ("return ONLY the 3 exported signatures, nothing else"). Open-ended prompts make agents wander and dump verbose context.
- **Workflow two-phase pattern**: reader phase (`lean-reader` agent, haiku, parallel) returns raw excerpts → executor phase receives those excerpts inline. Executors never explore.
- Never use Sonnet with 1M context. Prompt-polishing helpers live in `.claude/`.
- **Max 2 concurrent subagents**: this machine has limited RAM and crashes on wide parallel fan-out. Dispatch any multi-agent work — including the fixed roster below — in waves of at most 2 running at once, even where the task would otherwise justify more parallelism.
- **Orchestrator-only builds + full typecheck, strictly one at a time**: subagents never run `pnpm build`/`pnpm dev`/`next build`/`next dev` or the full-project typecheck (`pnpm run typecheck` / `tsc --noEmit`) themselves — only the top-level orchestrating session runs those, after a subagent reports its change is green. **Exactly one build or typecheck runs at any moment, ever** — never two concurrently, not even two the orchestrator itself started (no backgrounded build alongside a foreground one, no `tsc` while a build runs, no two worktrees building at once). Concurrent Next/TS workers balloon RAM and crash this box. Queue them: start the next only after the previous has exited. Subagents verify with only their own **scoped** tests (`pnpm test --run <fragment>`) + `eslint` on the files they touched.
- **Serialize tdd-guard'd implementer subagents (queue)**: the tdd-guard's last-test-run state is shared per worktree, so two implementer agents running their Red→Green cycles at once clobber each other and hit false "premature implementation" rejections (confirmed — the collision is the shared guard state, not file overlap). Default is **one at a time** in a shared worktree (queue them). Never bypass the guard by having the orchestrator apply an agent's file for it. Read-only agents (Explore/lean-reader/reviewers) still parallelize freely — they write no code and run no guarded tests. (`isolation: "worktree"` per agent is the alternative — separate guard state — but adds a merge-back step.)
- **tdd-guard policy (set 2026-07-31): ON for solo orchestrator work, OFF for agent fan-out.** Disable before dispatching parallel implementers, then **re-enable in the same turn** — treat that as an obligation, not a nicety. It is a globally-enabled plugin (`"tdd-guard@tdd-guard"` in `~/.claude/settings.json`), so toggling it affects **every project**, not just this worktree; say so out loud when you flip it.
  - **It cannot be scoped to paths.** Verified against upstream config docs: tdd-guard supports no ignore patterns, globs, or per-directory exemptions. The only levers are the global plugin toggle and `tdd-guard on/off`. Don't go looking again.
  - **The settings.json toggle does NOT take effect mid-session** (observed 2026-07-31): hooks are bound at session start, so a subagent dispatched *after* flipping the plugin off still runs with the guard active. To fan out without the guard you must flip it and start a NEW session. In-session, plan for the guard to be on regardless — which means the shared-state race is real and parallel implementers WILL clobber each other's `.claude/tdd-guard/data/test.json`. Either serialize, or tell each agent to re-run its targeted test immediately before every Edit (a subagent used that workaround successfully, at the cost of several retries).
  - **It is LLM-judged, not rule-based** (`.claude/tdd-guard/data/instructions.md` is a prompt evaluated by a model against your diff + last test output), so its verdicts are non-deterministic and degrade on large multi-concern files. Measured over one session: 2 blocks genuinely valuable (caught real over-reach in a Zod schema and a route handler bundling three features), 2 rule-correct but near-worthless, 3 actively harmful — including five successive contradictory rejections on one route rewrite, one of which violated the guard's own "Reaching a Clean Red" clause that explicitly permits stubbing.
  - **When it starts contradicting itself:** narrow the test to ONE assertion (it reasons badly about multi-assertion tests) or escalate to the user. Do not burn cycles re-phrasing the same edit.
  - It performs well on pure logic modules in `lib/**` and poorly on route handlers and `.tsx` wiring.

### Fixed team roster
When dispatching the full team, use this fixed 7-seat roster only — one flat layer, no further fan-out — dispatched in waves of at most 2 per the concurrency cap above, not all at once:
- `senior-backend-engineer` ×2 (sonnet) — server-only work.
- `senior-frontend-engineer` ×2 (sonnet) — UI-only work.
- `lean-reader` ×2 (haiku) — read-only context for the four engineers above.
- `senior-reviewer` ×1 (opus) — reviews the team's output; applies no fixes itself (dispatch a follow-up executor for that, per established practice).
- **Boundary is hard:** frontend agents never edit server files (Server Actions, Route Handlers, Mongoose, Zod schemas); backend agents never edit UI files (components, Tailwind, Puck config, locale copy). A side that needs the other's work stops and emits a self-contained handoff spec in its report (exact file/export name, input/output shape, error cases) instead of touching the file — relay that spec verbatim into the receiving engineer's prompt.
- **No recursive spawning (harness-enforced):** only this top-level session calls Agent or Workflow. The four roster agent definitions (`senior-backend-engineer`, `senior-frontend-engineer`, `senior-reviewer`, `lean-reader`) each carry an explicit `tools:` allowlist in their `.claude/agents/*.md` frontmatter that omits `Agent`/`Workflow` — the tool is unavailable to them, not just against policy, so a call fails hard rather than relying on the agent following the instruction.
- **Caveman default:** the backend/frontend/reviewer seats invoke the `caveman` skill at the start of every dispatch and keep using it through their final report, so their return text costs less of your context. `lean-reader` has no Skill tool by design (kept minimal/cheap) — its verbatim-only contract is already terser than caveman.

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
- **context7**: current library docs (Next 16, React 19, Mongoose, Tailwind v4, Lemon Squeezy, next-intl, WorkOS) before relying on memory.
- **Security passes**: the trailofbits static-analysis / differential-review / fp-check plugins are disabled by default to save context — re-enable them (and use the `security-auditor` agent) when a change touches auth, tenancy, webhooks, uploads, payments, public routes, or input validation, and for pre-merge audits.

## Engineering bar
Operate as a senior full-stack engineer with strong mobile-first UI and backend/API judgment.

### UI
- Mobile-first at 375px. Playwright at 3 breakpoints: 375/768/1280px (desktop-only surfaces: 768+1280; public-facing: all three).
- **Every Playwright run also covers all 5 locales and both themes** — `en`/`fil`/`id`/`ar`/`th` × light + dark, never `en`-light only. Assert on rendered strings (catches mojibake), check `ar` RTL geometry stays inside its container, and measure dark-theme colours against their background rather than assuming the token resolved. A breakpoint-only pass is an incomplete pass.
- Every async surface: loading/empty/error/populated. Every control: idle/hover-focus-visible/active/disabled.
- No hover-only UX. Drag needs visible affordances. Large mobile flows: steps/tabs, not tall modals.
- Accessibility: semantic HTML, labels, keyboard support, focus management, color never the sole signal.
- Update all 5 locales together (`en`, `fil`, `id`, `ar`, `th`). Prefer optimistic UI for high-confidence mutations.

### Backend
- Server Components by default; Server Actions for in-app mutations; Route Handlers for webhooks/public APIs. Node runtime unless Edge is justified.
- Validate at boundaries with Zod, then trust parsed types. Shape responses to caller needs. Cache intentionally.
- Prevent N+1; cursor-paginate unbounded lists; Mongo transactions for multi-doc writes that must succeed together; make retry-prone mutations idempotent; never swallow errors.
- **Endpoint hardening**: apply the full checklist in `docs/modules/hosting-ops.md`'s Endpoint hardening section on every new/updated endpoint. Known lapses: `docs/backend-audit-findings.md`.

## Multi-tenant rules
- Never trust client-supplied `workspaceId` — resolve scope from the WorkOS session + re-validated active-workspace cookie + MongoDB memberships (never WorkOS Organizations).
- Every tenant-scoped query includes `workspaceId`; every mutation by `_id` also filters by `workspaceId`.
- Public routes resolve `orgSlug -> workspaceId` before any tenant read. Every new compound index starts with `workspaceId`.

## Auth & tenancy
Use `getAuthUser()` for identity, `requireOrg()` on pages, `ownerContext()`/`requireRole()` on actions, explicit checks on route handlers. `ensureUser()` JIT-provisions at every authenticated entry. Active workspace = `gw_active_ws` HMAC cookie, always re-validated against DB memberships. Full details: `docs/modules/auth-tenancy.md`.

## Architecture
Monolith Next.js app; shared-DB multi-tenancy via `workspaceId`. Workspaces are MongoDB `Workspace` docs (not WorkOS Orgs). Public pages live at `/w/[orgSlug]`.

## Design
Semantic tokens only, flat UI, brand teal (hue 195) as deliberate accent (~10–20% of any view), Plus Jakarta Sans app font. Controls: `--radius`; frames: `--radius-surface`. Full palette/radius/theming details: `docs/modules/i18n-design.md`.

**Design Context** ("The Studio Ledger"): `PRODUCT.md` (register/users/brand personality/anti-references) and `DESIGN.md` (tokens/typography/components) are the source of truth for `/impeccable` and any UI work. Core rules: one accent only (brand teal = "act on this," never decorative), never-pure neutrals, flat surfaces (hairline `ring-foreground/10` + tonal shift, no `box-shadow` on cards/dialogs), soft controls (`--radius`) / sharp frames (`--radius-surface`), single type family (Plus Jakarta Sans) for the whole hierarchy. Reject: SaaS-cream dashboards, sterile enterprise chrome, clutter.

## Portfolio builder
3 public pages (Home, Gallery, Contact). Source of truth: `Workspace.publicPage`. Shared Puck config for editor + renderer. Inquiry submission is a single transaction (Inquiry + Client + Booking). See `portfolio-*` skills for internals.

## Cloudflare Images
Direct Creator Upload only — API token never reaches client. Scope uploads by `workspaceId` metadata; verify ownership before every create. Full implementation details: `docs/modules/portfolio-and-media.md`.

## Billing
The current implementation is Lemon Squeezy subscriptions through a synchronous checkout Route Handler and a webhook-only durability pipeline (atomic claim-lease ledger, no separate workflow engine). `Workspace.plan` is `free|pro|beta`. Lemon Squeezy, Creem, and a possible Paddle sole-proprietor application remain candidates until one can legitimately activate live payments first. Do not add Creem/Paddle configuration, claim either is integrated, or create a provider abstraction before an explicit provider decision. Selecting Creem or Paddle is a deliberate migration: replace checkout/webhooks and provider fields, audit schema/env/docs/tests, and preserve raw-body signature verification plus idempotent webhook processing. Full current flow + field names: `docs/modules/billing.md`.

## Production hosting
Hetzner VPS, Docker/Compose app container, Caddy, and systemd timers. GitHub Actions is gated on tests+lint+typecheck+build and publishes the immutable image; the VPS never builds the app. Details: `docs/modules/hosting-ops.md`.

## i18n
Locales: `en`, `fil`, `id`, `ar` (RTL), `th`. Malay (`ms`) dropped 2026-07-18 (overlapped too closely with `id` to justify a separate catalog); Thai (`th`) reintroduced 2026-07-18 after the original mojibake-corruption issue was root-caused (PowerShell UTF-8 corruption) and an automated encoding-sanity test (`messages/encoding-sanity.test.ts`) was added to catch any recurrence. Use logical Tailwind utilities (`ms/me/ps/pe/start/end/text-start`), not physical. Full RTL/locale details: `docs/modules/i18n-design.md`.

## Encoding safety
Preserve UTF-8 everywhere; never output/save mojibake. Verify user-facing Unicode renders; fix corruption before continuing. Prefer ASCII in code/config unless Unicode is intentional.

## Git workflow
- Branch from `dev`; name `action/pages-context`. All worktrees under `.claude/worktrees/` only — create with `git worktree add .claude/worktrees/<slug> -b <branch> dev`.
- Commit periodically: frequent small buildable checkpoints as each coherent unit lands, not one batch at the end.
- A worktree starts without `.env.local`; you may copy values from the canonical `dev` checkout's `.env.local` for local Playwright verification only — never commit, print, or paste secret values anywhere.

## Testing
Every change ships tests: data-layer, components, handlers, validators, tenant isolation. Mock external services only; never mock Mongoose (use in-memory Mongo).
- **Nested Mongoose subdocuments are optional on the inferred type.** `booking.amount` and friends need `?.` in test assertions (`b.amount?.currency`), even though the schema always materializes them from defaults. Vitest passes without it; `tsc --noEmit` fails — and only the orchestrator runs that, so a subagent can't catch it. Run targeted: `pnpm test --run <fragment>`; full sweep only pre-merge. Billing tests cover: webhook signature verification, price/plan mapping, idempotent webhook application, and tenant isolation.

## Done criteria
Implementation complete · tests passing · lint + typecheck pass · locales updated · 3 breakpoints × 5 locales × light+dark verified · optimistic UI where appropriate · errors surfaced · indexes confirmed for new queries.

## Review / merge flow
- Consolidate locales → build → strict code review (Playwright run-through at 3 breakpoints × 5 locales × light+dark, verifying every state — not just that it compiles).
- Fix findings → once no tasks remain, open a PR with `- [ ]` checklist. Merge to `dev` only after review and explicit approval.

## Docs hygiene
- Scratch docs (spec, plan, audit, review) consolidated into ONE `docs/<area>/` summary before PR, rest deleted. Net result: at most one new/changed doc per PR.
- Never delete: README, master-plan, product-spec-reference, blueprint, backend-audit-findings, RELEASE-CHECKLIST, REUSABLE_CODE.

## Commands
`pnpm dev` · `pnpm start` · `pnpm seed`. Prefer RTK for diff/log/read/test/lint/type/build when a summary suffices.

## References
- `docs/AGENTS-INDEX.md` (start here — map of every module doc, skill, and living reference doc)
- `REUSABLE_CODE.md` (read before building shared code)
