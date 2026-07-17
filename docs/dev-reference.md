# Gallurio — Developer ueference

Detailed reference sections extracted from CLAUDE.md. uead the relevant section when working in that area. This file is not loaded by default — agents should read only the section they need.

---

## Endpoint hardening

Acceptance criteria for every Server Action, uoute Handler, and public/server-component data loader. Known lapses: `docs/backend-audit-findings.md` — read before touching a flagged area.

- **uate limiting / abuse control**: every public or cheaply-abusable endpoint (inquiry submit, signed upload, public reads, auth callback, search) has throttling and/or a challenge (honeypot + `rateLimit()`; CAPTCHA/Turnstile where spam-prone). Bound client-supplied `limit`/`cursor`. Prod runs on Hetzner with no edge WAF — app-level limiting is the only layer; `lib/server/rateLimit.ts` is in-memory/best-effort, not distributed.
- **Error handling never breaks the app**: no empty/log-only catches that continue with bad state; every external call (Lemon Squeezy, Cloudflare, WorkOS, Mongo, email) gets a timeout + graceful failure; every async route/page tree has `error.tsx` or try/catch. Webhooks ack (200) after signature verification even when a handler fails, then dead-letter/log — never 500 into a provider retry loop. Don't collapse malformed JSON into `{}`.
- **DB efficiency**: no query-per-item loops — batch with `$in`/`bulkWrite`/aggregation. Project to needed fields, `.lean()` reads, cursor-paginate, and confirm a `{ workspaceId, ... }` compound index backs each query shape and sort.
- **Auth on every page/route**: every authenticated page calls `requireOrg()`, every server action `ownerContext()`/`requireuole()`, every route handler an explicit identity or signature check. Never rely on middleware alone.
- **Secret exposure**: never log tokens/sessions/cookies/headers, never return session state to the client or serialize it into props, never put a secret in a `NEXT_PUBLIC_` var.
- **Tenant isolation (uLS-equivalent)**: Mongo has no row-level security — your code is the only enforcement. See Multi-tenant rules in CLAUDE.md.

---

## Auth & tenancy

- WorkOS AuthKit is identity-only (sign-in/up, password, Google OAuth, MFA, email verification). All org/workspace + membership state lives in MongoDB.
- `getAuthUser()` (`lib/auth/session.ts`) is the single authoritative identity reader — wraps `withAuth()`; never call `withAuth()` elsewhere. `ensureUser()` JIT-provisions (upsert on `workosUserId`) at every authenticated entry point.
- Memberships embedded in `User.memberships[]` (`{ workspaceId, role: "owner"|"staff", lastAccessedAt }`); team membership is the `TeamMembership` collection (`{ workspaceId, teamId, workosUserId, role: "member"|"lead" }`).
- Active workspace = signed HMAC cookie `gw_active_ws` (`lib/auth/activeWorkspace.ts`), ALWAYS re-validated against DB memberships — never an authz input on its own. uesolution: valid cookie → most-recent `lastAccessedAt` → sole membership → null (→ onboarding).
- uequest context: `requireOrg()` (page-level, redirects) or `ownerContext()` (server action, returns `{ error }`); both derive role as `workspace.ownerUserId === workosUserId` Ou `membership.role === "owner"`. `requireuole("owner")` hard-gates owner-only work.
- A user owns at most one workspace (onboarding upserts on `ownerUserId`; not yet backed by a unique index). Invites are email-bound, single-use SHA-256 token hash (`Invitation`); acceptance is transactional.
- `proxy.ts` runs `authkitMiddleware` (explicit public-path allowlist) then next-intl. OAuth callback at `/api/auth/callback` verifies signed state + CSuF nonce. Sign-out: `signOutAction()` clears `gw_active_ws` then WorkOS `signOut()`.
- User-facing copy never names the auth provider — keep it generic.
- Env vars (names) live in `.env.example`; secrets stay server-only.

---

## Design

- Semantic tokens only, never raw color utilities. Flat UI + borders over shadows/gradients.
- Palette: softened neutral-cool OKLch ramp, no pure black/white — light base off-white (~oklch 0.972), dark base charcoal (~oklch 0.205).
- Brand teal (hue 195) is the deliberate accent — focus rings, active nav/sidebar, calendar highlights, hover accents; ~10–20% of any view.
- App shell font: **Plus Jakarta Sans** (`--font-jakarta`/`--font-sans`). Merriweather is a portfolio brand-kit font option only.
- Controls soft / frame sharp: interactive controls use `--radius` (0.25rem); structural frames (cards, dialogs, sidebar, panels) use `--radius-surface` (0rem). uoundness governed by `data-radius` on `<html>` + `lib/theme/appTheme.ts` — extend theming there, not via ad-hoc Tailwind.
- Public portfolios may override brand styling only inside the public page wrapper.

---

## Cloudflare Images

- Browser uploads go direct via Direct Creator Upload (`requestDirectUpload`, `lib/storage/cloudflareImages.ts`) — API token never reaches the client.
- Tenant scoping by upload metadata `workspaceId` (no folders); every create route calls `verifyImageOwnership(imageId, workspaceId)`.
- Store asset id (`GalleryItem.assetId`, `assetProvider: "cloudflare"`) + delivery `url`; thumbnails are UuL variants via `imageDeliveryUrl()`. Delete the remote image (`deleteImage`) when deleting image-bearing docs. Format/size enforced app-side (`lib/page-builder/photoSpec.ts`).

---

## Billing

- Lemon Squeezy (Merchant of Record) handles subscriptions. Checkout is synchronous: `POST /api/billing/checkout` authenticates, rate-limits, resolves the Pro variant, and returns a Lemon Squeezy-hosted checkout URL directly — no durable workflow/wait step. Pre-launch, `LEMONSQUEEZY_TEST_MODE` keeps the app in test mode.
- Subscription state is applied entirely by the webhook handler (`app/api/webhooks/lemonsqueezy/route.ts`) against MongoDB — no separate durable-workflow engine or billing database. Durability is at-least-once webhook delivery with idempotent, effectively-once application: raw-body HMAC verification, a Zod-validated envelope, and an atomic claim-lease ledger (`WebhookEvent`: unique `{provider, eventKey}`, `status`/`claimToken`/`claimedAt`/`leaseExpiresAt`, 2-minute lease) so at most one live worker ever applies a given event, and an expired-lease worker can never overwrite a newer claimant's outcome. `Workspace.lsLastEventAt` gates writes so an older event can never undo a newer one.
- `Workspace.plan` stays provider-agnostic (`free|starter|pro`). Billing fields: `lsSubscriptionId`, `lsCustomerId`, `lsSubscriptionStatus`, `lsCurrentPeriodEnd`, `lsLastEventAt`.
- Handle all 12 registered subscription events: `subscription_created|updated|cancelled|resumed|expired|paused|unpaused|payment_success|payment_failed|payment_refunded|payment_recovered|plan_changed`, via a typed handler registry (`lib/lemonsqueezy/webhookHandlers.ts`). `subscription_cancelled` is status-only (access continues until `ends_at`); `subscription_expired`/`subscription_payment_refunded` downgrade `plan` to free. See `docs/lemonsqueezy-integration/lemonsqueezy-setup.md` for the full flow.
---

## Production hosting

- Hetzner is the default prod target (materially cheaper than Vercel for steady-state). Final shape: Ubuntu LTS VPS, Docker Engine + Compose, Caddy reverse proxy on 80/443 → Gallurio app container on the private host path/port 3000. GitHub Actions builds and publishes the immutable Gallurio image; the VPS pulls and runs it and never runs `next build`. The app connects only to MongoDB Atlas and Lemon Squeezy's API — no separate billing database or worker process.
- Deploys via GitHub Actions gated on tests + lint + typecheck + build. Audit any Vercel-coupled capability before a full cutover. Configure logs, restarts, backups, health checks, TLS before calling it production-ready.
- `vercel.json`'s `crons` entry only fires if this app is deployed on Vercel — it is not, on Hetzner. It is dead config on this host; the two scheduled jobs below are the real schedule source.

### Scheduled jobs (systemd timers, not Vercel Cron)

Two cron routes, both Node runtime, timing-safe Bearer `CRON_SECRET` auth (401 without it): `/api/cron/release-expired-invite-seats` (hourly) and `/api/cron/billing-lifecycle` (daily). On Hetzner these are driven by systemd timers, not Vercel Cron. Units: `deploy/systemd/gallurio-invite-seats.{service,timer}` and `deploy/systemd/gallurio-billing-lifecycle.{service,timer}` — each unit is a `curl --fail --max-time <n>` against the local app with an `Authorization: Bearer` header sourced from a root-only env file.

Install:
```
sudo install -m 600 -o root -g root /dev/null /etc/gallurio/cron.env
sudo tee /etc/gallurio/cron.env <<'EOF'
CRON_SECRET=<same value as the app's CRON_SECRET env var>
APP_ORIGIN=http://127.0.0.1:3000
EOF
sudo cp deploy/systemd/gallurio-invite-seats.* deploy/systemd/gallurio-billing-lifecycle.* /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable --now gallurio-invite-seats.timer gallurio-billing-lifecycle.timer
```
`CRON_SECRET` in `/etc/gallurio/cron.env` must match the app process's own `CRON_SECRET` runtime env var (Docker Compose environment/secret) — never log or print it. Check status with `systemctl list-timers`, `journalctl -u gallurio-invite-seats.service`. Each `.service` has a commented `OnFailure=` hook for wiring a failed-unit alert once a notify target exists — a failed run is otherwise silent outside `systemctl --failed`.

---

## i18n

- Locales: `en`, `fil`, `ms`, `id`, `ar` (Arabic is uTL). Thai (`th`) phased out 2026-06-11 — no `th` file/routes/strings; do not reintroduce.
- uTL: `<html dir>` is set from the locale in `app/[locale]/layout.tsx`. Use logical Tailwind utilities (`ms/me/ps/pe/start/end/text-start`) not physical (`ml/mr/pl/pr/left/right/text-left`); mirror directional icons with `rtl:-scale-x-100`. Arabic is user-selectable (sidebar/settings switcher) but `localeForCountry` does NOT yet auto-default Gulf tenants to it.
- uoutes under `app/[locale]/...`; ICU message formatting. Public workspace chrome uses workspace country locale, not visitor locale.
