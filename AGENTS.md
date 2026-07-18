# Gallurio — Release-stage project instructions

Gallurio is a multi-tenant CRM SaaS for event businesses. A workspace owns its
bookings, clients, teams, gallery, public portfolio, inquiry form, and billing
state. We are preparing the first production release: prefer small, verified,
release-safe changes over speculative refactors.

## Current stack and deployment

- Next.js 16.2 App Router, React 19, TypeScript, Tailwind v4, Mongoose/MongoDB
  Atlas, Zod, react-hook-form, Puck, Socket.IO, next-intl, Resend, Cloudflare
  Images, WorkOS AuthKit, and Lemon Squeezy's SDK.
- The custom `server.ts` is required for Socket.IO. `proxy.ts` replaces legacy
  `middleware.ts`; `params` and `searchParams` are async.
- Production target: a Docker/Compose app container on Hetzner behind Caddy
  and Cloudflare, connected to MongoDB Atlas. GitHub Actions builds, tests,
  publishes an immutable image, and deploys it. Never run `next build`, install
  dependencies, or build the app on the VPS.
- Two systemd timers call the protected invitation-seat and billing-lifecycle
  routes. Vercel Cron, Workflow, PostgreSQL, PM2, and a separate billing worker
  are not part of the final runtime.

Read the relevant section of `docs/dev-reference.md` before changing auth,
billing, media, hosting, endpoint hardening, design, or i18n. Treat
`docs/RELEASE-CHECKLIST.md` as the launch source of truth and keep its short
pending list current when release work changes it.

## Working approach

- Inspect the real route, schema, tests, and deployment/config evidence before
  changing behavior. Current repository code and release docs override older
  notes and provider assumptions.
- Keep scope tight. Do not improve nearby code unless it is necessary; explain
  and obtain approval before widening the change.
- Use `rg` for search and `rtk` for summarized reads, diffs, tests, lint, type
  checks, and builds when its output is sufficient. Quote PowerShell paths that
  contain `()` or `[]` and use `-LiteralPath` for reads.
- Preserve UTF-8. Stop and repair mojibake rather than saving corrupted text.
- Do not expose secrets in output, logs, tests, fixtures, screenshots, commits,
  or documentation. Never put a secret in a `NEXT_PUBLIC_` variable.

## Security and tenancy

- WorkOS AuthKit is identity-only. Workspace, membership, role, and team state
  are MongoDB-owned; never use WorkOS Organizations.
- `getAuthUser()` is the sole identity reader. It wraps `withAuth()`; do not
  call `withAuth()` elsewhere. JIT-provision via `ensureUser()`.
- Resolve pages with `requireOrg()`, server mutations with `ownerContext()` or
  `requireRole()`, and route handlers with explicit identity/signature checks.
  Middleware/proxy is never sufficient authorization on its own.
- Never trust a client `workspaceId`. Scope every tenant query and mutation by
  `workspaceId`; resolve public `orgSlug` to the workspace before reading. New
  compound indexes begin with `workspaceId`.
- The signed active-workspace cookie is revalidated against MongoDB membership;
  it is not authorization by itself. Invitation acceptance is transactional.
- Validate untrusted input at boundaries with Zod. Rate-limit or challenge
  public/cheap endpoints, bound pagination, avoid N+1 queries, and use cursor
  pagination for unbounded lists.

## Billing: live-provider decision

- The implemented billing path is Lemon Squeezy only: synchronous checkout URL
  creation and raw-body-HMAC-verified, idempotent webhooks backed by MongoDB's
  `WebhookEvent` claim/lease ledger. There is no Workflow/Postgres layer.
- The saleable product is Pro (monthly and yearly); `PlanTier` is
  `free | pro | beta`. Never restore the removed Starter tier.
- Lemon Squeezy, Creem, and a potential Paddle sole-proprietor application are
  all live-payment options under consideration. Select the provider that can
  legitimately activate Gallurio first, after verifying its current eligibility,
  Merchant-of-Record terms, payout/tax fit, and production approval.
- Until that decision is made, keep Lemon Squeezy code working and release-safe,
  but do not represent Creem or Paddle as integrated, add either provider's
  secrets/configuration, or build a generic payment-provider abstraction. A
  switch to Creem or Paddle is a scoped migration that needs an explicit
  decision, implementation plan, webhook and checkout replacement,
  schema/env/docs/test audit, and production verification.
- Preserve beta/coming-soon gating while live payments are unavailable. Treat
  `BETA_TESTER_ENABLED` and provider test/live flags as release-critical.

## Media, portfolio, and product rules

- Cloudflare Images is the supported image path. Browser uploads use Direct
  Creator Upload; the API token stays server-side. Store asset IDs/provider and
  verify upload metadata ownership against `workspaceId`; delete remote assets
  when their owning document is deleted.
- The public portfolio remains exactly Home, Gallery, and Contact. Its source
  of truth is `Workspace.publicPage`; do not add portfolio collections without
  explicit approval. Shared Puck config powers editor and renderer.
- Portfolio drafts are local snapshots; published `Workspace.publicPage` is the
  live source. Public brand styling is scoped to the public-page wrapper.
- Use semantic design tokens. App surfaces are flat and border-led; structural
  surfaces stay sharp, while control radius comes from the app theme. Do not
  add raw color utilities, gradients, or hover-only interactions.

## i18n and UX

- Launch locales are `en`, `fil`, `id`, `ar`, and `th`. Arabic is RTL. Malay
  (`ms`) is removed. Update all active locale messages and parity tests together;
  do not reintroduce removed locales.
- Use ICU messages and logical CSS/Tailwind direction utilities for RTL
  (`ms/me/ps/pe/start/end/text-start`), not physical left/right utilities.
- Design mobile-first at 375 px. Every async surface needs loading, empty,
  error, and populated states; interactions need keyboard/focus, disabled, and
  non-hover affordances. Prefer optimistic UI for high-confidence mutations.

## Validation and release discipline

- Add or update focused tests for every code change. Mock external services,
  not Mongoose; use in-memory MongoDB where data behavior needs coverage.
- Before handoff, run affected tests, `pnpm typecheck`, and `pnpm lint`; use
  targeted checks when known unrelated repository failures make broad output
  misleading, and report any pre-existing blockers clearly.
- Verify production behavior separately from development: the current Lemon
  Squeezy build requires HTTPS origins, live Lemon Squeezy mode, matching
  Cloudflare account hashes, strong cookie secrets, and no seed/debug flags.
  Re-specify the provider checks only as part of an approved Creem or Paddle
  migration.
- Do not run seed or destructive data scripts against production without the
  explicit reviewed production procedure, backup/rollback evidence, and user
  authorization. `pnpm reindex` can drop stale indexes; review the index diff
  first.
- Branch from `dev`; use `action/<scope>` names and worktrees only under
  `.claude/worktrees/`. Do not merge to `dev` without review and explicit
  approval.

## References

- `docs/RELEASE-CHECKLIST.md` — launch gate and current provider/deploy status
- `docs/dev-reference.md` — authoritative focused architecture guidance
- `.env.example` and `lib/env.ts` — environment contract and production checks
- `docs/lemonsqueezy-integration/lemonsqueezy-setup.md` — current implemented
  billing integration
- `node_modules/next/dist/docs/` — Next.js 16 behavior; consult before coding
