# Gallurio Beta-to-Production Launch Checklist

Last updated: 2026-07-14 (reconciled after PR #58, Phase 1 decisions, the Resend/WorkOS email verification wiring, and the beta-participation/two-month-promo implementation, team-management fixes, and email/invoice branding consistency work)

Use this as the release gate for the first production deployment. Checked items are limited to repository work proven by merged code. Production accounts, credentials, servers, backups, DNS records, migrations, timers, monitors, and live transactions remain open until they are configured and tested in the target environment.

## Audited product and architecture baseline

- The authoritative billing implementation is **Lemon Squeezy**, not Paddle. Evidence: `@lemonsqueezy/lemonsqueezy.js`, `lib/lemonsqueezy/`, `app/api/billing/checkout/route.ts`, `app/api/webhooks/lemonsqueezy/route.ts`, and `docs/lemonsqueezy-integration/lemonsqueezy-setup.md`. Do not provision Paddle unless the product decision changes; a conditional migration is listed under Delegated Engineering Work.
- The saleable catalog is **Gallurio Pro monthly** and **Gallurio Pro yearly**. Checkout accepts only `plan: "pro"`; the two cadences map to separate Lemon Squeezy variant IDs. Launch pages request live variant pricing and fall back to catalog amounts when the provider lookup fails, so live checkout/display parity still requires production verification.
- The billing `starter` tier was removed from `PlanTier`, entitlements, draft caps, checkout mappings, and launch UI in PR #58. A guarded `2026-07-drop-starter-plan.ts` migration converts persisted Starter workspaces to `free`. Historical documentation and non-billing phrases such as "starter template" must not be confused with an active billing tier.
- There is no owner-initiated production downgrade flow. Lemon Squeezy's customer portal is for payment-method updates, invoices, and cancellation. Cancellation preserves Pro access until the paid period ends. A development-only plan simulator and legacy "downgrade" recovery terminology remain fail-closed in production and are tracked below.
- There is no permanent never-subscribed free product. Eligible new owners receive one month of full-Pro access once per user identity; a workspace without an active paid, beta, or unexpired grant is gated to `/subscribe`.
- The beta policy is a shared two-month beta run, not a separate timer per person. All active beta access ends together when the beta program is closed. A verified beta participant may redeem one two-month Pro promo at any time; the promo grant lasts two months from redemption. This is now code-complete: `BetaProgram` (singleton close-gate), `User.betaParticipation`/`betaPromoRedeemedAt`, the `beta2mo` promo type, `Workspace.pendingPromoGrant` (queued-grant stacking with active Pro, applied identically from both the webhook and the lifecycle sweep so entitlement never reads falsely gated), emergency revocation, and the production seed/backfill scripts all landed and are covered by tests. The legacy perpetual `beta` promo type is unchanged/untouched per the original decision to add a distinct type rather than reuse it. Running the seed/backfill scripts against production and end-to-end reconciliation remain open.
- On Lemon Squeezy cancellation, `plan` remains `pro`, status becomes `canceled`, and `lsCurrentPeriodEnd` comes from `ends_at`. On `subscription_expired` or `subscription_payment_refunded`, the webhook sets `plan: "free"`, leaves `everSubscribed: true`, clears the subscription ID and period end, and gates normal in-app access for owners and staff. From `lifecycle.lapsedAt`, the sweep sends the expiry email at T0, a reminder at T+30 days, a final one-week warning at T+51 days, and unpublishes the live public page at T+58 days; CRM data and drafts are retained.
- `subscription_payment_failed`, `past_due`, and `paused` are not by themselves sufficient to expire access. Gallurio expires access only when Lemon Squeezy reports its terminal non-payment state, or sends another provider-authoritative terminal event such as expiry/refund. The route's 12-event coverage was cross-checked against the live Lemon Squeezy dashboard's configured event list on 2026-07-14 (`c636f24`): `subscription_payment_refunded` is a real event and stays terminal; `subscription_payment_recovered` (dunning recovery) and `subscription_plan_changed` were found silently no-op'ing through the default case and are now handled. Production payload verification against a real live-mode delivery is still open.
- The app is self-hosted through the custom `server.ts` for Socket.IO. `pnpm start` sets `NODE_ENV=production`; PM2 launches that command. `/api/health` now exposes liveness and dependency-aware readiness, and the custom server performs graceful shutdown.
- Billing checkout uses Vercel Workflow DevKit with pinned Postgres World support. Startup, shutdown, readiness, production environment validation, and the CI integration command are wired in code. The production PostgreSQL service, schema bootstrap, backup/restore, monitoring, and restart-survival proof remain operational gates.
- Two scheduled jobs now exist: hourly expired-invitation seat release and daily billing lifecycle processing. Versioned systemd service/timer units are included under `deploy/systemd/`; they still need to be installed, enabled, monitored, and tested on Hetzner.
- Team management hardening (found during manual testing, 2026-07-14, `e9bcd61`/`1762aac`): a debounced already-registered-email check on the invite form; a distinct `revoked` invite-accept error (previously collapsed into `invalid`); a shared dropdown-positioning fix in `components/ui/select.tsx`/`popover.tsx` (Base UI's default `clipping-ancestors` collision boundary was mis-clipping against a `Sheet`'s scroll container — fixed with an explicit `collisionBoundary`, propagates to every dropdown in the app); a workspace-wide "View Members" sidebar; a two-step team-then-workspace removal confirmation with a persisted "don't ask again" flag; a guard blocking removal of an active team lead; and a read-only teams view for non-owner roles (previously a separate, more limited component). Verified via a new Playwright spec (`e2e/teams-page.spec.ts`, 6/6 passing at 375/768/1280) plus unit/component tests.
- Business/email/invoice branding consistency (2026-07-14, `321dd85`): the Business Details logo upload was unbounded (2000x2000/2MB, no delivery variant) — now capped to 256x256/250KB with a Cloudflare delivery transform, matching the portfolio-header logo pattern. Transactional emails now source the business logo from `Workspace.logoUrl` (previously the portfolio nav logo field) and render it beside the business/Gallurio name in both the header and a small footer mark, RTL-aware for Arabic (table-based cell reordering, not reliant on CSS `dir` alone, for Outlook compatibility). Invoice/receipt PDFs (`@react-pdf/renderer`) render the same logo-beside-name layout with an explicit `flexDirection` for RTL. Covered by `lib/email/brand.test.ts`, `lib/email/layout.test.ts`, and `lib/invoices/pdfShared.test.tsx`.

## Phase 1: Before provisioning

### Release scope and ownership

- [x] Assign the release owner, infrastructure owner, billing owner, incident lead, and rollback approver to `thefappybird`.
- [ ] Record the owner's contact and emergency escalation details outside this repository.
- [ ] Freeze the release commit and record its full SHA, source branch, build artifact location, database migration list, and rollback SHA.
- [x] Confirm the beta public host strategy: canonical app `https://www.gallurio.com`; portfolios use `https://www.gallurio.com/w/<slug>` for beta. Wildcard portfolio subdomains are deferred.
- [x] Confirm the product catalog decision: Gallurio Pro monthly and Pro yearly only; no Starter or selectable downgrade target.
- [x] Set the beta policy to a shared two-month run; beta access ends globally when the beta program is closed, with no per-user beta timer.
- [x] Define the beta benefit as one two-month Pro promo per verified beta participant, redeemable at any time after eligibility is recorded.
- [x] Implement and verify the beta-participant record, one-time promo redemption, two-month grant expiry, active-beta shutdown, stacking behavior with active Pro, and support/revocation handling. *(Done 2026-07-14: `BetaProgram`/`closeBetaProgram`, `User.betaParticipation`/`betaPromoRedeemedAt`, `beta2mo` redemption with identity-scoped one-time guard, `Workspace.pendingPromoGrant` queued-stacking applied identically from the webhook and the lifecycle sweep — end-to-end no-false-expiry invariant covered by test — and an emergency revocation action. Production seeding/backfill and live reconciliation remain open, see the code-and-data-gates item below.)*
- [x] Confirm the lapse schedule: terminal expiry gates the workspace to `/subscribe`; T+30 days sends the saved-data reminder; T+51 days sends the final warning; T+58 days unpublishes the public page while retaining CRM/draft data.
- [x] Decide that Gallurio follows Lemon Squeezy's terminal payment decision: transient failed-payment/past-due events do not expire access; a provider-authoritative terminal non-payment/expiry event does.
- [x] Verify the exact Lemon Squeezy terminal event/status payload in test mode and implement any missing mapping before production. *(Done 2026-07-14: cross-checked the route's 12 handled event kinds against the live LS dashboard's configured event list; `subscription_payment_recovered` and `subscription_plan_changed` were missing and are now wired — see `c636f24`. A real live-mode delivery has not yet been captured; sandbox-simulated payloads only.)*
- [x] Use Lemon Squeezy's PHP/API pricing as the pricing source for launch drafts and displayed Pro pricing. Do not manually introduce a second price source.
- [ ] Verify the live Lemon Squeezy dashboard, variant IDs, currency, and API response. The repository is still configured/documented for test mode and cannot prove the dashboard state.
- [x] Create review drafts for privacy, terms, refund/cancellation, beta/billing policy, and delegated engineering work under `docs/release/`.
- [ ] Obtain legal/product approval for the review drafts and reconcile approved wording into all five launch locales.
- [x] Confirm the launch locale decision: `en`, `fil`, `ms`, `id`, and `ar`; Thai remains excluded.
- [x] Create the current copy handoff drafts: `docs/release/gallurio-launch-copy-draft.md` and `docs/release/lemonsqueezy-product-copy-draft.md`.
- [ ] Verify all five launch locales across production-facing surfaces end to end. Arabic transactional email copy is now complete for the lapse/lifecycle emails (`9e98de2`) and RTL header/footer layout is unit-tested (`lib/email/layout.test.ts`); a full cross-surface locale sweep beyond what this session's Playwright/vitest coverage exercised is still open.

### Code and data gates

- [x] Merge the `action/beta-release-cleanup` implementation target: PR #58 / merge commit `914de573` covers Delegated Engineering Work #1-#12 plus the code-wiring portion of #14. #13 (Paddle) was intentionally excluded because Lemon Squeezy remains authoritative.
- [ ] Close the residual items recorded under Delegated Engineering Work, especially verified beta promo redemption, terminal Lemon Squeezy payment mapping, concurrent webhook claiming, lifecycle in-app recovery, universal email recovery/monitoring, migration-ledger gaps, cron failure alerting, full async-state coverage, and production Workflow infrastructure.
- [x] Add the guarded operator tooling for the two-month beta promo: `scripts/seed-promo-code.ts` (idempotent `beta2mo` PromoCode creation, code value never logged) and `lib/db/migrations/2026-07-beta-participation-backfill.ts` (backfills `User.betaParticipation` for pre-existing `plan:"beta"` workspace owners). Both use the shared `lib/db/scriptGuard.ts` dev/production guard. Running them against production, and reconciling redemption/eligibility end-to-end, remain open.
- [x] Add `pnpm test:integration` to `.github/workflows/ci.yml` alongside typecheck, lint, unit tests, and build.
- [ ] Pass `rtk vitest`, `pnpm test:integration`, `rtk tsc`, `rtk lint`, and `rtk next build` against the final release commit and retain the full CI logs. *(Progress 2026-07-14: typecheck clean, lint clean (0 errors; only pre-existing unrelated warnings in vendored/skill scripts and one false-positive `jsx-a11y/alt-text` on `@react-pdf/renderer`'s non-DOM `Image`), `pnpm test:integration` 4/4 passing, `pnpm build` completes successfully. `pnpm test` is 4633/4640 passing — the remaining 7 failures span `seedPortfolio`, `(auth)/_actions`, `table-booking-manager`, and `EditorShell` (the same pre-existing `EditorShell` failure noted below), none touched by this session's beta/billing/team-management/branding work. This has not yet been run against a frozen final release commit or retained as archived CI evidence — that step remains open.)*
- [ ] Run a strict tenant-isolation review of every launch-critical query and mutation: authenticated tenant scope must come from session plus MongoDB membership, and every `_id` mutation must also filter by `workspaceId`.
- [ ] Audit production bundles/routes for `lib/actions/dev.ts`, the dev-plan settings panel, sample-data toggles, seed entrypoints, billing simulators, `AUTHKIT_DEBUG`, test credentials, and test-mode provider flags. Verify all bypasses are absent, unreachable, or fail closed under `NODE_ENV=production`.
- [ ] Never run `pnpm seed` or `pnpm seed:portfolio` against production. Both refuse `NODE_ENV=production`, but operational access and the production database URI must also make accidental execution impossible.
- [x] Harden migration/reindex/backfill entrypoints with a shared database-target guard, redacted target fingerprint, explicit confirmation, dry-run handling where supported, index diffing, and consistent `DATABASE_URL` use for `scripts/backfill-inquiries.ts`.
- [ ] Review the discovered migration order and applicability: `lib/db/migrations/2026-05-default-team-bootstrap.ts`; `2026-05-bookings-team-backfill.ts` after it; `2026-05-multi-session-bookings.ts`; `2026-05-portfolio-page-shape.ts`; `2026-06-transactions-team-backfill.ts` after booking-team backfill; `2026-07-drop-starter-plan.ts`; `scripts/backfill-inquiries.ts`; and any required removed-`quoted` booking-status backfill. There is no migration ledger/runner proving which production revisions ran.
- [ ] Produce a pre-cutover database report: collections, document counts by tenant-safe aggregate, indexes, schema anomalies, existing `plan: "starter"` workspaces, legacy booking statuses, and records requiring backfill.
- [ ] Test loading, empty, populated, and error states for signup, onboarding, subscribe, billing settings, dashboard, bookings, clients, inquiries, teams, gallery, portfolio editor/public page, invitations, notifications, and account recovery.
- [ ] Test all launch-critical flows at 375 px and desktop, including keyboard/focus behavior and non-hover access.

## Phase 2: External service setup

### Hetzner production server

#### Verified bootstrap record — 2026-07-14

- **Host:** `gallurio-prod`, Ubuntu 26.04 LTS, x86_64. Current shape is **1 vCPU, 1.9 GiB RAM, and 38 GiB root disk**. It is below the 2 vCPU / 4 GiB beta minimum, so it remains an unchecked launch gate; resize before real traffic or representative load testing. A persistent 2 GiB `/swapfile` is active to reduce build/restart OOM risk during temporary setup.
- **OS and access:** system update/reboot, UTC/NTP, and hostname setup were completed. `gallurio` is the locked-password deployment user. `gallurio-admin` is the key-only break-glass admin account with sudo. Password authentication and direct root SSH login are disabled. Add a distinct second trusted administrator key before launch; the current two accounts use one operator key.
- **Firewall:** UFW is active with deny-incoming/allow-outgoing defaults. SSH is temporarily rate-limited from any IPv4/IPv6 address; tighten this to administrator/VPN IP allowlists before launch. Ports 80/443 are not open yet; port 3000 and MongoDB remain unexposed.
- **Runtime installed:** Node `v22.22.1`, npm `9.2.0`, pnpm `11.5.2`, PM2 `7.0.3`, Git `2.53.0`, build tools, and official-repository Caddy `2.11.4`. Ubuntu's packaged Corepack `0.24.0` crashed with Node 22, so Corepack is disabled and pnpm is installed directly at the recorded version.
- **Release layout:** `/var/www/gallurio/releases` is owned by `gallurio`; `/etc/gallurio/gallurio.env` is an empty `root:gallurio` 0640 environment file. No release directory, `current` symlink, production environment values, or PM2 application process exists yet.
- **Repository access:** a read-only, passphrase-free deploy key is configured for the `gallurio` user and was verified against `thefappybird/gallurio` using GitHub's published ED25519 host-key fingerprint. Do not clone or label a production release until the launch commit SHA is frozen.

- [x] Provision the initial dedicated Ubuntu LTS VPS: `gallurio-prod` on Ubuntu 26.04 LTS, x86_64. Completed 2026-07-14.
- [ ] Resize the VPS to the beta minimum of 2 vCPU and 4 GiB RAM before real traffic or representative load testing; document load-test evidence, image/storage growth assumptions, and the resize trigger. Current temporary shape is 1 vCPU / 1.9 GiB RAM / 38 GiB root disk.
- [ ] Record server ID, region, public IPv4/IPv6, rescue access, billing owner, renewal alerts, and data-processing location.
- [x] Patch the OS, enable unattended security updates, retain UTC/NTP, set hostname `gallurio-prod`, and reboot once before deployment. Completed 2026-07-14.
- [x] Create the non-root `gallurio` deployment user with a locked password; routine application operation will not run as root. A separate `gallurio-admin` key-only break-glass account holds the current administrative sudo access. Completed 2026-07-14.
- [x] Install approved SSH public keys, disable password authentication and direct root login, and verify `gallurio-admin` can connect and use sudo. Completed 2026-07-14.
- [ ] Add a distinct SSH key for a second trusted administrator and record recovery steps securely; the current `gallurio` and `gallurio-admin` accounts use one operator key.
- [x] Configure the initial host firewall: UFW has deny-incoming/allow-outgoing defaults, SSH is rate-limited, and ports 3000/MongoDB are not exposed. Completed 2026-07-14.
- [ ] Tighten SSH from the temporary global rate limit to administrator/VPN IP allowlists where practical; later add 80/443 only for the chosen Cloudflare/origin strategy.
- [x] Install a pinned Node.js version satisfying Next.js 16 (minimum 20.9), Corepack/pnpm matching the lockfile workflow, PM2, Caddy, Git, and required build tooling. Record versions with the release evidence. Verified 2026-07-14: Node `22.22.1`, pnpm `11.5.2`, PM2 `7.0.3`, Git `2.53.0`, and Caddy `2.11.4`; direct pnpm installation is intentional because Ubuntu's Corepack fails under this Node version.
- [x] Create the initial release/secrets layout: `/var/www/gallurio/releases` is owned by `gallurio`; `/etc/gallurio/gallurio.env` is root-controlled and app-readable. Completed 2026-07-14.
- [ ] Create the first immutable `releases/<sha>` checkout and the `current` symlink only after the launch commit SHA is frozen.
- [ ] Configure PM2 from `deploy/ecosystem.config.js`, set explicit memory/restart limits after measuring the build, run `pm2 save`, install the boot service with `pm2 startup`, reboot, and verify the process returns.
- [ ] Configure log rotation for PM2, Caddy, system logs, and cron/timer output. Redact cookies, tokens, authorization headers, customer data, webhook bodies, and email bodies.
- [x] Add non-sensitive liveness/readiness checks for the process, MongoDB, and Workflow World, plus graceful application shutdown.
- [ ] Monitor HTTPS reachability, readiness, disk, memory, load, certificate expiry, cron freshness, and 5xx rate from an external location.
- [ ] Provision and validate the production Workflow World before accepting checkout traffic. For Postgres World, use a dedicated production PostgreSQL database/user, install the adapter, set `WORKFLOW_TARGET_WORLD` and `WORKFLOW_POSTGRES_URL`, bootstrap its schema, start the long-lived worker during application instrumentation/startup, and monitor queue/run/hook failures.
- [ ] Back up and restore-test the Workflow database separately from MongoDB. A MongoDB snapshot alone cannot recover checkout workflow state.
- [ ] Create alert routes and thresholds, a one-page incident runbook, provider status links, and an escalation rule. Test one synthetic alert before launch.
- [ ] Enable Hetzner snapshots/backups as an infrastructure recovery layer, but do not treat VPS snapshots as MongoDB backups. Document retention and restore ownership.
- [ ] Set disk-usage alerts and a cleanup policy for old releases, package caches, PM2 logs, Caddy logs, crash dumps, and temporary upload files.

### Deployment and rollback mechanics

- [ ] Use immutable release directories or another atomic deployment method; do not build over the currently running checkout.
- [ ] Deploy with `pnpm install --frozen-lockfile`, production environment injection, `pnpm build`, and a smoke-start on an unused local port before switching traffic.
- [ ] Preserve the previous release directory and compatible environment file. Record the exact commands to repoint `current`, reload/restart PM2, and restore the prior Caddy configuration.
- [ ] Decide whether schema/data changes are backward compatible with the prior release. If not, provide a tested database rollback or make the deployment non-rollbackable with explicit approval.
- [ ] Verify Socket.IO through Caddy and Cloudflare: WebSocket upgrade, authenticated connection, reconnect after PM2 restart, and CORS restricted to `NEXT_PUBLIC_APP_URL`.
- [ ] Test process crash, `pm2 restart`, server reboot, a failed build, and a failed health check. Confirm traffic remains on or returns to the last healthy release.

### Cron and scheduled work

- [x] Add versioned systemd service/timer definitions for the hourly invitation-seat sweep and daily billing-lifecycle sweep; remove the Vercel-only cron configuration.
- [ ] Install an hourly **systemd timer** (preferred over an unobserved crontab) that calls `https://<production-host>/api/cron/release-expired-invite-seats` with `Authorization: Bearer <CRON_SECRET>`.
- [ ] Install the daily billing-lifecycle systemd timer that calls `https://<production-host>/api/cron/billing-lifecycle` with the same bearer secret.
- [ ] Keep `CRON_SECRET` out of shell history and process listings where possible; load it from a root-readable environment file or wrapper.
- [ ] Add timeout, retry/backoff, structured logging, and a failed-unit alert. Record a last-success metric or heartbeat so silent scheduler failure is detectable.
- [ ] Invoke the job once manually and verify a 200 JSON report, invalid/missing secrets are rejected, expired invitation seats are released exactly once, and concurrent/repeated runs are safe.
- [x] Remove the Vercel-only cron configuration and document systemd timers as the Hetzner scheduler.

### Domain, DNS, and Cloudflare

- [ ] Add the production zone to Cloudflare under the production-owned account; enable MFA, least-privilege roles, audit access, and billing alerts.
- [ ] Create the required `A`/`AAAA` records for the chosen app/apex hosts and a `www` record. Decide whether `www` redirects to apex or the reverse; configure and test one canonical 301/308 behavior.
- [ ] If subdomain portfolios launch, create and test the wildcard DNS record and wildcard TLS/origin coverage for `*.<base-domain>` before setting `NEXT_PUBLIC_PORTFOLIO_BASE_DOMAIN`.
- [ ] Choose proxied (orange-cloud) versus DNS-only deliberately. For proxied records, set SSL/TLS to **Full (strict)** and use a valid public or Cloudflare Origin CA certificate at Caddy; never use Flexible mode.
- [ ] Configure Caddy with real production hosts, HTTPS, security headers, request-size/timeouts appropriate to direct uploads, compression, WebSocket proxying, canonical `www`, and a config validation/reload test.
- [x] Read `CF-Connecting-IP` first and preserve it through the versioned Caddy configuration for proxied production traffic.
- [ ] Restrict the origin to Cloudflare IP ranges, Authenticated Origin Pulls, or a Tunnel before trusting that header; then prove direct-origin/header spoofing fails and two visitors receive distinct rate-limit buckets.
- [ ] Protect the origin: allow only Cloudflare IP ranges on 80/443 or use Cloudflare Tunnel/Authenticated Origin Pulls; retain a controlled bypass for certificate recovery and monitoring. Confirm direct requests to the origin IP cannot reach Gallurio with a forged `Host` or `CF-Connecting-IP` header.
- [ ] Configure Cloudflare cache rules so authenticated app pages, API routes, auth callbacks, webhook routes, Socket.IO, and dynamic public inquiry responses are not cached. Cache only explicitly safe static assets and public responses.
- [ ] Configure WAF/security settings, bot controls, rate limits for auth/public inquiry/billing endpoints, minimum TLS, HSTS only after HTTPS is stable, and alerts for origin/5xx spikes. Avoid challenges on provider webhooks and auth callbacks.
- [ ] Document every callback/webhook hostname allowed by Cloudflare, Caddy, WorkOS, Lemon Squeezy, Resend if webhooks are added, and external monitors. Run signed requests through the full proxy path.
- [ ] Validate DNS, certificate chain, HTTP-to-HTTPS redirect, `www`, IPv4/IPv6, wildcard portfolios if enabled, security headers, WebSockets, callback routes, and webhook POSTs from outside the server network.

### Cloudflare Images

- [ ] Enable Cloudflare Images in the production account and record account ID, account hash, plan, included storage/delivery, overage alerts, supported file-size limits, and deletion/retention policy.
- [ ] Create a dedicated production API token with only the account/image permissions required to create direct-upload URLs, inspect metadata, and delete images. Do not reuse a global API key or development token.
- [ ] Set and cross-check `CLOUDFLARE_ACCOUNT_ID`, `CLOUDFLARE_IMAGES_API_TOKEN`, `CLOUDFLARE_IMAGES_ACCOUNT_HASH`, and `NEXT_PUBLIC_CF_IMAGES_ACCOUNT_HASH`; both hashes must describe the same production account.
- [ ] Confirm whether delivery remains on `imagedelivery.net/<account-hash>` as the code expects. A custom delivery hostname requires code/config review; do not configure one only in the dashboard and assume the app will use it.
- [ ] Confirm public unsigned delivery (`requireSignedURLs: false`) is intentional for portfolio images, and test that tenant metadata is attached and `verifyImageOwnership` rejects a cross-workspace image ID.
- [ ] Verify direct creator upload end to end with allowed JPEG/PNG/WebP/AVIF files at boundary dimensions/sizes, rejected formats/oversize files, cancel/remove behavior, deletion, thumbnails/variants, and public delivery. The shared default is 10 MiB, while portfolio collection routes use the separate 15 MiB cap; verify the correct boundary for each surface and the Cloudflare plan limit.
- [ ] Define and run an orphan-image report/cleanup process for uploads abandoned before a `GalleryItem` is created. Do not enable destructive cleanup without a dry run and tenant-safe matching.

### Cloudflare Turnstile

- [ ] Create a production Turnstile widget restricted to every production hostname that renders auth or inquiry forms, including wildcard portfolio hosts if used.
- [ ] Set production `NEXT_PUBLIC_TURNSTILE_SITE_KEY` and `TURNSTILE_SECRET_KEY`; do not use test keys. Verify the secret is server-only.
- [ ] Test password sign-in, password sign-up, forgot password, and public inquiry with valid, missing, expired, replayed, and invalid tokens. Confirm production fails closed when the secret is absent and remains accessible to keyboard/screen-reader users. Google OAuth currently does not require a Turnstile token; approve that exemption or delegate a change.
- [ ] Validate the Siteverify response's expected production hostname/action, not only `success`, so staging/test tokens cannot be accepted in the wrong environment.

### MongoDB Atlas

- [ ] Use a separate Atlas production project/cluster or, at minimum, a separately named production database and dedicated credentials. Never reuse the development connection string.
- [ ] Create a production application database user scoped to the Gallurio database with only required read/write privileges; use separate human/admin and backup credentials.
- [ ] Restrict Atlas Network Access to the production server egress IP(s), VPN/bastion, and approved recovery locations. Do not leave `0.0.0.0/0` enabled.
- [ ] Record cluster tier, region, storage/autoscaling, connection limits, encryption, maintenance window, alert contacts, and capacity thresholds. Load test against a production-like non-production cluster.
- [ ] Enable Atlas backups with documented snapshot/PITR retention that meets the business RPO/RTO. Perform a restore into an isolated database and validate representative tenants before launch.
- [ ] Create Atlas alerts for unavailable nodes, connections, replication lag, CPU, memory, disk, query latency, and backup failure.
- [ ] Store the production database name in the URI and add a deployment check that rejects known development hosts/database names. Print only a redacted host/database fingerprint during deployment.
- [ ] Run approved migrations/backfills against a snapshot-backed staging clone first. Capture dry-run counts, execution time, tenant scope, before/after counts, and rollback commands.
- [ ] Review `pnpm reindex`: it calls `syncIndexes()` for all models and may drop stale indexes. Run only after a reviewed index diff and backup, with an explicit production environment source rather than accidentally loading a developer `.env.local`.
- [ ] Confirm all declared indexes exist after deployment, especially tenant-leading compound indexes, invitation/token uniqueness, team membership uniqueness, booking calendar queries, portfolio drafts, notifications, and TTL indexes.
- [x] Add the global `{ status: 1, expiresAt: 1 }` Invitation index required by the all-workspace expiry sweep.
- [ ] Confirm that index exists and is used on the production database after the reviewed index synchronization.
- [ ] Verify production data after cutover: sample multiple workspaces; confirm membership, bookings, clients, inquiries, gallery ownership, public pages, billing fields, locale, and counts without exposing PII in logs.

### WorkOS authentication

- [ ] Unlock/configure the WorkOS **production environment**; staging settings do not carry over. Store the production API key once in the secret store and record the production client ID.
- [ ] Configure the exact HTTPS redirect URI used by the app: `https://<production-host>/api/auth/callback`. Remove localhost, preview, tunnel, and obsolete callback URLs from production.
- [ ] Generate independent high-entropy `WORKOS_COOKIE_PASSWORD` (at least 32 characters) and `ACTIVE_WORKSPACE_COOKIE_SECRET`; do not reuse API keys or development secrets. Plan secret rotation and its session impact.
- [ ] Confirm `WORKOS_COOKIE_NAME` if customized, secure cookie behavior behind Cloudflare/Caddy, session duration, logout, active-workspace cookie clearing, and OAuth state/CSRF validation.
- [ ] Configure production AuthKit branding, application name/logo, allowed origins, sign-in methods, email verification, password reset URL, session policy, and MFA policy. Keep user-facing copy provider-neutral.
- [ ] Create a production Google Cloud project/OAuth consent screen with Gallurio name, logo, privacy/terms links, verified domains, support contacts, publishing status, and any required verification.
- [ ] Add only the redirect URI WorkOS provides for the production Google OAuth connection and the exact allowed JavaScript origins required by that integration. Remove development/test clients after production verification.
- [ ] Register `https://<production-host>/api/webhooks/workos` with a distinct production `WORKOS_WEBHOOK_SECRET` and subscribe to `email_verification.created`, the only WorkOS event currently handled. *(Progress 2026-07-14: endpoint registered and verified end-to-end against a local ngrok tunnel, subscribed to `email_verification.created` only, with its own `WORKOS_WEBHOOK_SECRET` in `.env.local`. This is dev-only plumbing — the production host registration with a distinct production secret is still open and happens at cutover.)*
- [x] Decide WorkOS default-email behavior. The code sends custom verification email through Resend; disable the matching WorkOS verification email only after the signed webhook path succeeds, or users can receive duplicates or no email. *(Done 2026-07-14: decision is Resend owns verification and password reset (both already implemented — see `lib/email/sendPasswordResetEmail.ts` and the `email_verification.created` handler in `app/api/webhooks/workos/route.ts`); WorkOS never composes/sends either. The four WorkOS "Authentication emails" toggles — Magic Auth, User invitation, Email verification, Password reset — are disabled in the WorkOS dashboard (none are used: Magic Auth and the WorkOS invitation API are never called; Gallurio's team invites are a fully custom Resend-based flow). Verified via the ngrok webhook test above: triggering resend-verification produced exactly one branded Gallurio email, no WorkOS duplicate.)*
- [ ] Verify password signup, verification/resend, password reset, Google OAuth identity linking, callback errors, MFA enrollment/challenge/recovery, sign-out, session expiry, invite acceptance, multi-workspace selection, and owner/staff authorization.
- [ ] Confirm no WorkOS Organizations are created or trusted for tenancy; MongoDB `Workspace` and `User.memberships` remain authoritative.

### Resend and email DNS

- [ ] Create a production Resend account/team, enable MFA/least privilege, create a dedicated production API key, and set usage/billing alerts. *(Progress 2026-07-14: account + production API key created. MFA/least-privilege and billing alerts not yet confirmed.)*
- [x] Verify a dedicated sending domain/subdomain and publish the exact SPF and DKIM records Resend provides. Add DMARC with reporting, begin with an observed policy, and tighten only after legitimate traffic passes. *(Done 2026-07-14: `gallurio.com` moved to Cloudflare DNS; Hostinger mailbox (`support@gallurio.com`) MX/SPF/DKIM/DMARC verified; Resend sending subdomain `mail.gallurio.com` added and DNS-verified.)*
- [x] Set `EMAIL_FROM` to a verified Gallurio sender and decide `EMAIL_REPLY_TO`. The `onboarding@resend.dev` default must never be used in production. *(Done 2026-07-14: `EMAIL_FROM=Gallurio <no-reply@mail.gallurio.com>`, `EMAIL_REPLY_TO=support@gallurio.com` set; `RESEND_WEBHOOK_SECRET` configured for the bounce/complaint endpoint. A real send through Resend has been verified working end to end.)*
- [x] Confirm WorkOS versus Resend responsibility for verification, password reset, MFA, and any provider-composed emails; avoid duplicate or missing delivery. *(Done 2026-07-14: Resend sends verification and password reset (Gallurio's own branded template); MFA has no email leg at all (WorkOS TOTP/SMS only, see `workos.multiFactorAuth.challengeFactor`), so there is nothing for Resend to own there; WorkOS's own auth-email sending is disabled dashboard-side for all four flows it offers. See the WorkOS default-email decision above for the verification test evidence.)*
- [ ] Send and inspect real production-domain emails for signup verification, password reset, team invitation, inquiry owner notification, inquiry client confirmation, booking confirmation/cancellation/decline, and notification flows. Expiry email is currently missing and is delegated work. *(Progress 2026-07-14: at least one real send confirmed delivered/working through the new production domain; signup verification separately confirmed end-to-end via the WorkOS webhook test (received the branded code email). Remaining: sweep the other listed triggers individually before full launch, and re-confirm from an actually deployed production host rather than a local ngrok tunnel.)*
- [ ] Test all five locales, text and HTML alternatives, links, reply-to behavior, light/dark clients, mobile layout, spam placement, and invalid/expired links.
- [ ] Configure delivery/bounce/complaint monitoring and alerts. If Resend webhooks are added, verify signatures, make processing idempotent, and exclude the endpoint from Cloudflare challenges/caching. *(Progress: the Resend bounce/complaint webhook is implemented — `app/api/webhooks/resend/route.ts` verifies the svix signature, dedupes via the shared `WebhookEvent` ledger, and logs `email.bounced`/`email.complained` events. Not yet done: actual alert routing on those log lines, and excluding the endpoint from Cloudflare challenges/caching, which needs the production Cloudflare setup from Phase 2's Domain/DNS section.)*
- [ ] Verify an email API failure is visible to operations and recoverable; current transport returns a failure/skipped result while many callers treat delivery as best effort.

### Lemon Squeezy billing

- [ ] Complete live-store activation, business/identity verification, tax details, bank/payout setup, support contact, statement descriptor, refund policy, terms/privacy URLs, and payout alerts.
- [ ] Create exactly one live **Gallurio Pro** subscription product with two variants: monthly and yearly. Do not create Starter or a downgrade target.
- [ ] Record live product/variant IDs, currency, tax-inclusive/exclusive presentation, price, trial policy, refund policy, dunning settings, and cancellation timing. Match them to app/legal copy.
- [ ] Create a least-privilege live API key and set `LEMONSQUEEZY_STORE_ID`, `LEMONSQUEEZY_API_KEY`, and both live Pro variant IDs. Keep test and live credentials in separate secret sets.
- [ ] Set `LEMONSQUEEZY_TEST_MODE=false` explicitly. The code defaults to test mode when unset, while production rejects test-mode webhook events.
- [ ] Register `https://<production-host>/api/webhooks/lemonsqueezy` with a unique live signing secret. Subscribe to `subscription_created`, `subscription_updated`, `subscription_cancelled`, `subscription_resumed`, `subscription_expired`, `subscription_paused`, `subscription_unpaused`, `subscription_payment_success`, `subscription_payment_failed`, `subscription_payment_refunded`, `subscription_payment_recovered`, and `subscription_plan_changed`.
- [ ] Exclude the webhook from Cloudflare cache/challenge rules. Confirm raw request bodies and `X-Signature` arrive unchanged through Cloudflare and Caddy.
- [ ] Verify unsigned/tampered/test-mode events are rejected. Verify valid events cannot update an unrelated workspace and every tenant-scoped lookup uses workspace/subscription/customer identifiers safely.
- [x] Persist a unique webhook-event ledger, return retryable 5xx responses on authoritative processing failures, redact stored payloads, and provide an operator replay script.
- [ ] Add an atomic processing claim/lease and a true simultaneous-delivery test. The unique ledger deduplicates processed events, but two requests that observe the same non-processed row can currently execute the handler concurrently.
- [ ] Configure the customer portal for payment methods, invoices, and cancellation only. Verify no plan-switch/downgrade option exposes Starter or another product.
- [ ] Document support procedures for refunds, chargebacks, duplicate charges, failed checkout, stuck workflow runs, missing webhooks, manual replay/reconciliation, cancellation, expiry, and resubscription.

### Workflow DevKit production backend

- [ ] Select and document the production World for Hetzner. Do not use `WORKFLOW_TARGET_WORLD=local`; bundled docs state Local World is development-only and loses queued steps on restart.
- [ ] If using Postgres World, provision a production PostgreSQL service isolated from development, with TLS, least-privilege credentials, network restrictions, backups/PITR, alerts, connection limits, and a tested restore.
- [x] Install/pin `@workflow/world-postgres` and wire application startup, shutdown, readiness, production env validation, and CI integration coverage.
- [ ] Bootstrap the production Postgres World schema before application activation and record adapter/schema versions with the release.
- [ ] Set `WORKFLOW_TARGET_WORLD=@workflow/world-postgres` and `WORKFLOW_POSTGRES_URL` explicitly; configure worker concurrency/pool size only after measuring checkout volume and database limits.
- [x] Start the World worker from `instrumentation.ts` and stop it through the custom server's graceful-shutdown path.
- [ ] Monitor workflow run age, failed/retried steps, parked hooks, queue depth, worker heartbeat, and Postgres health. Provide operator inspection, cancellation, and replay procedures.
- [ ] Prove durability: start Pro checkout, stop/reboot PM2 before the billing webhook, restart, deliver the signed event, and confirm the persisted run resumes, updates only the intended workspace, clears its run ID, and completes exactly once.

## Phase 3: Production configuration

### Environment-variable matrix

Secrets must live in a production secret store or root-readable environment file, never Git, PM2 config, shell history, screenshots, tickets, or logs. “Prod differs” means the production value must not be copied from development. The Workflow variables below become required only after the blocking production-World implementation is merged; their current absence is itself a launch blocker.

| Variable | Owner / source | Prod differs | Secret | Missing or wrong impact | Safe verification |
| --- | --- | --- | --- | --- | --- |
| `NODE_ENV` | Deployment; literal `production` | Yes | No | Dev bypasses/logging/test behavior may activate | Inspect PM2 environment and a non-sensitive diagnostics check |
| `PORT` | Deployment; default `3000` | Usually | No | Caddy upstream mismatch if changed | `ss`/local HTTP check; do not expose publicly |
| `NEXT_PUBLIC_APP_NAME` | Present in `.env.example`, but no production source read was found | No | No | No current runtime impact; stale configuration until consumed or removed | Confirm with repository search |
| `NEXT_PUBLIC_APP_URL` | Production canonical HTTPS origin | Yes | No | Broken email links, metadata, public URLs, Socket.IO CORS | Compare generated links and WebSocket origin |
| `NEXT_PUBLIC_PORTFOLIO_BASE_DOMAIN` | DNS/product decision; optional | Yes | No | Empty uses `/w/<slug>`; wrong value breaks subdomain portfolios | Open two portfolio URLs and inspect generated links |
| `DATABASE_URL` | Atlas production application user URI | Yes | Yes | App/workflows cannot connect; wrong value risks dev data | Redacted host/database fingerprint plus read-only health check |
| `WORKOS_API_KEY` | WorkOS production environment | Yes | Yes | Auth API and custom verification lookup fail | Production signup/callback; never print key |
| `WORKOS_CLIENT_ID` | WorkOS production application | Yes | No | Authorization/code exchange fails | Compare dashboard suffix and complete sign-in |
| `WORKOS_COOKIE_PASSWORD` | Generated secret, at least 32 chars | Yes | Yes | Session sealing/unsealing fails | Length/presence check plus sign-in/restart test |
| `ACTIVE_WORKSPACE_COOKIE_SECRET` | Generated HMAC secret | Yes | Yes | Workspace cookie, OAuth state, and socket auth fail | Presence/length check plus workspace switch/OAuth/socket test |
| `NEXT_PUBLIC_WORKOS_REDIRECT_URI` | Exact WorkOS allowed HTTPS callback | Yes | No | OAuth/password flows cannot complete | Compare exact dashboard URI and run callback |
| `WORKOS_WEBHOOK_SECRET` | WorkOS production webhook endpoint | Yes | Yes | Verification webhook rejects events | Send dashboard test event and tampered control |
| `WORKOS_COOKIE_NAME` | Optional deployment choice; default `wos-session` | Usually no | No | Mismatch can break session lookup/logout | Inspect cookie name only, never value |
| `AUTHKIT_DEBUG` | Operations; leave unset/false | Yes | No | Verbose auth logging may expose sensitive context | Assert unset in PM2 environment |
| `NEXT_PUBLIC_TURNSTILE_SITE_KEY` | Cloudflare production Turnstile widget | Yes | No | Widget cannot produce valid tokens | Inspect public key ID and complete protected forms |
| `TURNSTILE_SECRET_KEY` | Cloudflare production Turnstile secret | Yes | Yes | Production verification fails closed | Valid/invalid token tests; never print secret |
| `CLOUDFLARE_ACCOUNT_ID` | Cloudflare production account | Yes | Sensitive | Upload API calls fail or target wrong account | Compare masked ID and request one upload URL |
| `CLOUDFLARE_IMAGES_API_TOKEN` | Dedicated Images API token | Yes | Yes | Upload/inspect/delete fails | Permission-scoped upload/delete smoke test |
| `CLOUDFLARE_IMAGES_ACCOUNT_HASH` | Cloudflare Images delivery account hash | Yes | Sensitive | Server-built delivery URLs/ownership checks fail | Compare dashboard and load one image |
| `NEXT_PUBLIC_CF_IMAGES_ACCOUNT_HASH` | Same production account hash | Yes | No | Client-built image URLs fail | Inspect built URL and load one variant |
| `LEMONSQUEEZY_API_KEY` | Lemon Squeezy live store | Yes | Yes | Checkout/portal API calls fail | Live-mode API identity/store check without logging key |
| `LEMONSQUEEZY_STORE_ID` | Lemon Squeezy live store numeric ID | Yes | Sensitive | Checkout creation fails or uses wrong store | Compare ID and create controlled checkout |
| `LEMONSQUEEZY_WEBHOOK_SECRET` | Live webhook destination secret | Yes | Yes | Valid events are rejected; wrong secret is security-critical | Signed test plus tampered request |
| `LEMONSQUEEZY_VARIANT_PRO_MONTHLY_ID` | Live Pro monthly variant | Yes | Sensitive | Monthly checkout returns configuration error/wrong product | Controlled checkout and verify variant/total |
| `LEMONSQUEEZY_VARIANT_PRO_YEARLY_ID` | Live Pro yearly variant | Yes | Sensitive | Yearly checkout returns configuration error/wrong product | Controlled checkout and verify variant/total |
| `LEMONSQUEEZY_TEST_MODE` | Deployment; literal `false` | Yes | No | Unset defaults to sandbox; prod ignores test webhooks | Startup validation and controlled live checkout metadata |
| `RESEND_API_KEY` | Resend production API key | Yes | Yes | Email is silently skipped or fails | Send to controlled inbox and inspect Resend event ID |
| `EMAIL_FROM` | Resend-verified production sender | Yes | No | Sandbox sender/rejection/deliverability failure | Compare verified domain and inspect received headers |
| `EMAIL_REPLY_TO` | Product/support mailbox; optional | Usually | No | Replies may go to per-message sender/default | Reply from a controlled message |
| `CRON_SECRET` | Generated scheduler bearer secret | Yes | Yes | Cron endpoint rejects scheduler or is forgeable | Valid and invalid manual calls; never echo secret |
| `PAGEVIEW_SALT_SECRET` | Generated analytics pseudonymization secret; optional fallback is active-workspace secret | Yes | Yes | Changing fallback/secret changes visitor hashes | Presence check and aggregate pageview smoke test |
| `BETA_TESTER_ENABLED` | Product decision; optional `true` | Yes | No | Exposes production beta activation when enabled | Inspect onboarding with approved test identity |
| `WORKFLOW_TARGET_WORLD` | Deployment/Workflow adapter; production value expected to be `@workflow/world-postgres` if chosen | Yes | No | Local/dev backend can lose checkout workflows on restart | Startup diagnostics and restart-survival checkout test |
| `WORKFLOW_POSTGRES_URL` | Production Workflow PostgreSQL application user | Yes | Yes | Worker cannot persist/resume checkout workflows | Redacted host/database fingerprint plus readiness/queue test |
| `WORKFLOW_POSTGRES_JOB_PREFIX` | Workflow deployment; optional namespacing | Usually | No | Queue-name collisions if a database is shared | Inspect configured prefix, not jobs' customer payloads |
| `WORKFLOW_POSTGRES_WORKER_CONCURRENCY` | Workflow capacity tuning; optional | Usually | No | Under/over-provisioned workers | Compare metrics to documented value |
| `WORKFLOW_POSTGRES_MAX_POOL_SIZE` | Workflow/Postgres capacity tuning; optional | Usually | No | Connection exhaustion or worker starvation | Compare Postgres connections and documented value |

Script-only/development variables must not be injected into the application process: `SEED_OWNER_*`, `SUB_EXPIRED_*`, `SEED_PORTFOLIO_SLUG`, `LEMONSQUEEZY_SIM_URL`, and development/test passwords. `scripts/backfill-inquiries.ts` now uses `DATABASE_URL` via `connectDB()` (the earlier `MONGODB_URI` mismatch was resolved in the `action/beta-release-cleanup` branch). Future/unused placeholders such as Sentry, PostHog, Upstash, and `FIGMA_ACCESS_TOKEN` are not production requirements until code actually consumes them.

### Secret and configuration validation

- [ ] Generate a production environment file from the matrix and have two people compare names—not values—against actual code reads and `.env.example`.
- [x] Add fail-fast runtime startup validation for production-required variables, HTTPS URLs, secret lengths, live/test-mode consistency, matching Cloudflare hashes, production Workflow settings, and forbidden seed/debug variables.
- [ ] Execute that validation using the final production secret set and retain the redacted startup/readiness evidence.
- [ ] Verify file ownership/mode, PM2 environment inheritance, restart persistence, and that `pm2 env`, logs, crash reports, and deployment output do not reveal secrets.
- [ ] Rotate any credential ever placed in chat, a ticket, shell history, repository, CI log, screenshot, or shared development environment.
- [ ] Store a break-glass copy and rotation runbook. Test rotation in staging for WorkOS cookies/state, billing webhooks, Resend, Turnstile, Cloudflare Images, MongoDB, cron, and analytics salt.

## Phase 4: Deployment and cutover

### Ordered cutover sequence

- [ ] **1. Freeze and verify code:** select release SHA; complete delegated blockers; pass tests, typecheck, lint, build, security/tenant review, locale parity, and 375 px checks.
- [ ] **2. Protect data:** take/verify Atlas snapshot; record counts/indexes; dry-run migrations/backfills on a clone; approve rollback compatibility.
- [ ] **3. Prepare services:** finish Hetzner, Atlas, the production Workflow World/Postgres backend, WorkOS, Resend, Cloudflare Images, Turnstile, Lemon Squeezy live store, monitoring, backups, and secret-store setup without directing public traffic.
- [ ] **4. Stage environment:** install the production environment on the server, run startup validation, verify no development/test credentials or flags, and keep live billing webhooks disabled until the app is healthy.
- [ ] **5. Deploy release:** install from lockfile, build in an immutable release directory, start on a local/staging port, run health/readiness and server-side smoke checks, then atomically switch PM2/Caddy.
- [ ] **6. Apply data changes:** run only approved idempotent migrations/backfills and reviewed index synchronization; capture before/after results.
- [ ] **7. Activate DNS/TLS:** point/proxy DNS, verify Full (strict), canonical host, wildcard portfolios if applicable, origin protection, visitor IPs, WebSockets, caching exclusions, and external monitoring.
- [ ] **8. Activate callbacks/webhooks:** enable WorkOS and Lemon Squeezy production endpoints, exempt them from challenges/cache, send signed tests, and verify logs/DB state without PII.
- [ ] **9. Activate live billing:** confirm live mode, live variants, exact prices/currency/tax, customer portal, dunning, and payouts; then allow production checkout traffic.
- [ ] **10. Run smoke tests:** execute the post-deployment and billing suites below with controlled accounts and clean up test workspaces/subscriptions according to policy.
- [ ] **11. Observe:** maintain an elevated monitoring window covering auth, email, uploads, database, cron, Socket.IO, checkout, webhooks, expiry/replay, 4xx/5xx, CPU/memory/disk, and support channels.
- [ ] **12. Approve or roll back:** release owner records go/no-go. If a gate fails, stop checkout/webhooks as appropriate, revert traffic/code, restore data only when necessary, and communicate status.

## Phase 5: Post-deployment verification

### Platform and infrastructure

- [ ] External health monitor is green over HTTPS; certificate, DNS, canonical redirect, security headers, Cloudflare proxy, Caddy, PM2, MongoDB, and WebSockets are healthy.
- [ ] Reboot the server during a controlled window and confirm Caddy, PM2, the app, monitoring, and timers recover without manual intervention.
- [ ] Trigger a controlled application error and cron failure; verify logs are redacted, rotated, searchable, and alerts reach the incident channel.
- [ ] Confirm disk/memory/CPU/connection baselines and record scale thresholds after representative load.
- [ ] Verify Atlas snapshot completion and perform or schedule the first isolated restore test.

### Authentication and tenancy

- [ ] Create a new owner with email/password, receive one branded verification email, verify, finish onboarding, sign out/in, reset password, enroll/challenge MFA if enabled, and revoke a session.
- [ ] Sign in with production Google OAuth; verify consent branding, callback destination, identity linking, cookies, and removal of development origins/credentials.
- [ ] Create two workspaces/users and prove cross-tenant IDs cannot read/update bookings, clients, inquiries, gallery assets, teams, drafts, notifications, or billing state.
- [ ] Invite staff, receive/accept a single-use invite, verify the correct workspace/team/role, reduced navigation, forbidden owner routes, revocation, and expired invite cleanup.

### Core product and public surfaces

- [ ] Test owner and staff journeys for dashboard, bookings/calendar/reschedule, clients, inquiries/conversion, teams, notifications, settings, and sign-out in all loading/empty/error/populated states.
- [ ] Create/edit/publish Home, Gallery, and Contact; verify draft isolation, Cloudflare Images upload/ownership/deletion, public SEO/noindex, inquiry submission, emails, and public URL strategy.
- [ ] Verify public inquiry Turnstile, validation, honeypot, rate limiting with distinct visitor IPs behind Cloudflare, transaction creation, owner/client emails, and error recovery.
- [ ] Verify all five locales, including Arabic RTL behavior, and 375 px behavior on launch-critical paths. Check Unicode output for corruption; do not ship mojibake.
- [ ] Confirm public portfolios and data behavior for active Pro, never-subscribed free, beta, canceled-but-not-expired, expired, refunded, paused, and past-due workspaces matches the approved policy.

### Email delivery

- [ ] Verify Resend shows successful events and received headers pass SPF, DKIM, and DMARC for every critical template.
- [ ] Test a suppressed/bounced recipient and an API outage; confirm operations can see the failure and users receive a recoverable in-app outcome where required.
- [ ] Verify every email link uses the production HTTPS origin, respects locale, and contains no localhost, preview, test token, or provider-facing internal name.

## Phase 6: Billing verification

- [ ] In Lemon Squeezy test mode/staging, test Pro monthly and yearly checkout, duplicate clicks/rate limiting, abandoned overlay/workflow cleanup, application/worker/Postgres restart during an in-flight checkout, webhook replay, portal, cancellation, resume, renewal, payment failure/recovery, pause/unpause, refund, expiry, and resubscription.
- [ ] In production, make one controlled real Pro monthly purchase and one Pro yearly purchase/refund where financially and legally appropriate. Confirm displayed and charged amount/currency/tax, receipt, payout record, workspace mapping, and no cross-tenant update.
- [ ] Confirm `subscription_created`/`updated` activates Pro, persists customer/subscription/status/period fields, sets `everSubscribed`, resumes/clears the checkout workflow, and remains correct on duplicate/out-of-order delivery.
- [ ] Cancel through the customer portal. Confirm future renewal stops, `lsSubscriptionStatus` becomes `canceled`, period end matches Lemon Squeezy, and Pro access continues until that time.
- [ ] Trigger/simulate expiry after cancellation. Confirm `plan` becomes `free`, `everSubscribed` stays true, subscription ID/period clear, owners and staff are routed to localized `/subscribe`, data is retained, and resubscription is possible.
- [ ] Verify the approved expiry messaging: advance warning, at-expiry in-app state, owner/staff behavior, support/export route, and owner email. This cannot pass until the delegated expiry messaging work is complete.
- [ ] Test an over-entitlement expired workspace. Confirm no team/member/data deletion occurs automatically and access/recovery exactly matches policy.
- [ ] Test `past_due`, payment failure/recovery, `paused`, `unpaused`, refund, and webhook loss/replay against the approved grace policy. Confirm no indefinite unintended Pro access.
- [ ] Prove Starter cannot be selected through UI, direct checkout POST, customer portal, live product catalog, webhook variant mapping, tests, messages, or production configuration.
- [ ] Verify there is no downgrade workflow. Cancellation is allowed; resubscription purchases Pro; internal expiry-to-free state is an access boundary, not a selectable plan change.
- [ ] Reconcile Lemon Squeezy subscription/customer IDs and statuses against MongoDB for every smoke-test workspace; document a safe reconciliation/replay procedure.

## Phase 7: Rollback readiness

- [ ] Define rollback triggers: health failure, auth outage, tenant leak, data corruption, broken uploads/email, billing mismatch, webhook loss, high 5xx, resource exhaustion, or unsafe migration.
- [ ] Keep the previous release built and startable. Test atomic code rollback and Caddy/PM2 rollback before launch.
- [ ] Document how to disable new checkouts without blocking existing customer-portal access or losing signed webhook events.
- [ ] Document provider rollback/containment: DNS/proxy bypass, WorkOS callback rollback, Resend sender/key rollback, Cloudflare Images token rollback, Turnstile emergency handling, Lemon Squeezy webhook disable/replay, and Atlas credential rotation.
- [ ] For each migration/backfill, state whether rollback is code-only, reverse migration, or point-in-time restore. Never restore the whole production database to fix one tenant without explicit incident approval.
- [ ] Test Atlas restore into isolation and the application against that restored database without sending email, accepting live billing, or mutating production providers.
- [ ] Prepare customer/support communication templates for outage, delayed email, payment issue, expiry error, security incident, rollback, and recovery.
- [ ] After any rollback, reconcile webhook events, workflow runs, email failures, uploads, cron jobs, and database writes that occurred while versions differed.

## Delegated Engineering Work

PR #58 merged the beta-release cleanup implementation on 2026-07-13. The checked lines below record the code that landed; unchecked lines are the remaining engineering, production, or acceptance-test work. A section is not launch-complete merely because its code portion is checked.

### PR #58 completion record

- [x] **#1 Starter core removal:** removed the billing tier from current types/entitlements/UI and added a guarded data migration.
- [x] **#2 Production downgrade exclusion:** production checkout remains Pro-only and dev plan mutation fails closed in production.
- [x] **#3 Webhook durability foundation:** added the event ledger, retryable failures, payload redaction, dedupe-after-processing, and replay tooling.
- [x] **#4 Lapse lifecycle foundation:** added the daily sweep, staged emails, subscribe gating, refund/expiry handling, and delayed public-page unpublish.
- [x] **#5 Free-entry model:** implemented one month of full-Pro access once per user identity and proactive grant expiry.
- [x] **#6 Environment validation:** added tested, fail-fast production startup validation.
- [x] **#7 Deployment health foundation:** added liveness/readiness, graceful shutdown, Cloudflare visitor-IP handling, and Caddy guidance.
- [x] **#8 Email failure foundation:** production no longer silently skips missing transport; critical paths expose failures and WorkOS webhook processing uses a retryable ledger.
- [x] **#9 Database-script safety:** added shared target guards, redacted fingerprints, dry-run/index-diff support, and consistent application DB configuration.
- [x] **#10 Scheduled-job foundation:** added transactional/paginated invitation-seat processing, its supporting index, and versioned systemd units for both jobs.
- [x] **#11 Launch copy/pricing foundation:** aligned launch copy with the one-month/Pro-only model and reads both live Lemon Squeezy variants with a fallback.
- [x] **#12 Async-state foundation:** added route loading skeletons and a shared accessible empty-state primitive to the targeted launch surfaces.
- [ ] **#13 Paddle migration:** intentionally deferred/not applicable while Lemon Squeezy remains the signed launch provider.
- [x] **#14 Workflow code wiring:** pinned Postgres World and wired startup, shutdown, readiness, env validation, and CI integration execution.

### 1. Remove legacy Starter billing state

- **Priority:** blocking
- **Likely files/modules:** `lib/db/models/Workspace.ts`, `lib/plans/entitlements.ts`, `lib/page-builder/drafts.ts`, `lib/auth/assertCanAddTeam*`, `app/[locale]/(app)/settings/billing/_panel*`, teams plan props/components, portfolio draft actions, billing/workflow/webhook tests, `messages/{en,fil,ms,id,ar}.json`, `docs/dev-reference.md`, and Lemon Squeezy docs. Do not confuse billing Starter with ordinary phrases such as “starter template” or “starter items.”
- **Current behavior after PR #58:** current billing types, entitlements, draft caps, checkout mappings, and launch UI use `free | beta | pro`; `2026-07-drop-starter-plan.ts` handles persisted Starter workspaces. `docs/dev-reference.md` and historical design documents still contain stale billing-tier references.
- [ ] Remove or clearly archive stale billing Starter documentation, then dry-run and apply the migration to the approved production target.
- **Required behavior:** persisted billing tiers and launch UI contain only the approved free/beta/Pro states; no Starter product, selector, transition, copy, or production variant exists.
- **Why:** stale plan state can create contradictory access, copy, migration, and webhook behavior.
- **Acceptance criteria:** audit search has no billing-plan Starter references; existing `plan: "starter"` documents have a reviewed migration target; checkout and webhook mapping accept only Pro variants; production catalog/portal cannot expose Starter.
- **Tests:** model validation/migration, entitlements, team/draft caps, checkout rejection, webhook mapping, billing UI, tenant isolation, and locale parity.
- **Locales:** yes, all five.

### 2. Remove user-initiated downgrade flows and UI

- **Priority:** blocking
- **Likely files/modules:** `lib/actions/dev.ts`, `app/[locale]/(app)/settings/dev-plan/_panel.tsx`, `app/[locale]/(app)/teams/_components/downgrade-block-modal.tsx`, teams-page state/props, billing panel, related tests and messages.
- **Current behavior after PR #58:** production checkout/catalog remain Pro-only and the development plan action fails closed in production. The dev-only plan switcher and `DowngradeBlockModal` terminology still exist for entitlement recovery/testing.
- [ ] Decide whether the dev-only switcher may remain. If “no downgrade flow” includes development tooling and recovery terminology, remove/rename those surfaces and their locale keys in a follow-up PR.
- **Required behavior:** users can purchase Pro, manage payment details/invoices, cancel renewal, and resubscribe; they cannot choose a lower plan. Expiry-to-free remains a system access state, not a user-selectable downgrade.
- **Why:** the launch product explicitly has no downgrade flow and no Starter tier.
- **Acceptance criteria:** no production or dev UI offers a plan downgrade; portal configuration exposes cancellation but no product switch; cancellation/expiry/resubscription remain tested.
- **Tests:** billing settings, portal action, dev-action removal, cancellation/expiry, direct request validation, locale parity.
- **Locales:** yes, all five.

### 3. Make Lemon Squeezy webhooks durable and idempotent

- **Priority:** blocking
- **Likely files/modules:** `app/api/webhooks/lemonsqueezy/route.ts`, `lib/lemonsqueezy/webhook.ts`, `lib/workflows/subscriptionCheckout*`, Workspace/billing event persistence or queue/reconciliation modules, replay/admin script, and webhook tests.
- **Current behavior after PR #58:** verified events are persisted in a unique ledger, processed events dedupe, handler failures are recorded and return 500, payloads are redacted, and operators have a replay script. A concurrent request can still process the same non-processed ledger row because processing is not claimed atomically.
- [ ] Add an atomic processing claim/lease and a true concurrent-delivery regression test before declaring exactly-once application complete.
- **Required behavior:** durably record/deduplicate events and process with retries/dead-letter/replay, or return retryable failure until the authoritative update commits. Preserve raw-body signature verification and tenant-safe routing.
- **Why:** a transient database or workflow failure can permanently lose activation, renewal, refund, or expiry.
- **Acceptance criteria:** duplicate/out-of-order events are safe; injected DB failure is retried/replayable; operations can list/reconcile failures; no unrelated tenant can be updated; provider receives 2xx only after durable acceptance.
- **Tests:** signature, event-ID dedupe, transaction/failure injection, retries, replay, out-of-order lifecycle, workflow resume, tenant isolation, and production test-mode rejection.
- **Locales:** no.

### 4. Complete expiry, dunning, paused, and refund policy UX

- **Priority:** blocking
- **Likely files/modules:** `app/api/webhooks/lemonsqueezy/route.ts`, `lib/lemonsqueezy/status.ts`, `lib/billing/access.ts`, `lib/auth/{requireOrg,ownerContext,apiOrgContext}.ts`, subscribe/billing pages, notification/email modules, Workspace fields if needed, and all lifecycle tests.
- **Current behavior after PR #58:** cancellation keeps Pro until expiry; expiry/refund anchors the lapse lifecycle; a daily sweep sends staged owner emails, gates normal access, retains CRM/drafts, and later unpublishes the live public page. Past-due/paused retain Pro until a terminal event. The requested in-app lifecycle notification and explicit support/export recovery surface are not implemented.
- **Progress 2026-07-14:** Arabic lifecycle/lapse email copy landed (`9e98de2`); a support runbook covering beta eligibility/promo recovery/expiry/resubscription/accidental-unpublish was written (`docs/release/beta-billing-support-runbook.md`, `8ddeb9b`). The in-app notification surface and explicit support/export recovery UI remain unimplemented.
- [ ] Add the remaining localized in-app notification/support/export recovery UX and verify lifecycle timer overlap cannot duplicate emails.
- **Required behavior:** implement the approved grace policy, pre-expiry/at-expiry messaging, owner email and in-app notification, staff behavior, support/export/resubscribe access, public portfolio policy, and explicit data/team retention. Never delete teams or customer data merely because payment expired.
- **Why:** expiry is a first-class launch scenario and current behavior is only partially communicated/recoverable.
- **Acceptance criteria:** lifecycle state table is encoded and documented; cancellation, dunning, expiry, refund, resubscription, owner/staff, over-cap data, and public pages match policy; localized messages and emails deliver; webhook replay remains safe.
- **Tests:** time boundaries, each provider status/event, notification/email failure, all roles, over-cap teams, public access, resubscribe, tenant isolation, locale parity.
- **Locales:** yes, all five.

### 5. Resolve free trial and beta-grant contradictions

- **Priority:** blocking
- **Likely files/modules:** `lib/actions/onboarding.ts`, `lib/billing/{grantPlan,checkGrantExpiry,access}.ts`, `lib/db/models/Workspace.ts`, `lib/lemonsqueezy/plans.ts`, onboarding/subscribe/pricing components, promo-code modules, legal/marketing messages and tests.
- **Current behavior after PR #58:** eligible owners receive one month of full-Pro access once per user identity; plain free workspaces are gated; the daily sweep enforces expiry; beta remains an explicit flag-gated grant path; promo redemption exists but the `beta` code grants perpetual beta and does not verify historical beta participation.
- **Progress 2026-07-14:** the two-month `beta2mo` promo type, identity-level `betaParticipation`/`betaPromoRedeemedAt` guard, global `closeBetaProgram()`, and active-Pro stacking via `pendingPromoGrant` all landed with tests (Waves 0-3, `5f05c42`…`f4357c0`). The legacy perpetual `beta` promo type is intentionally left as-is, not reused, per the original decision.
- [x] Replace the perpetual beta promo path with the approved two-month Pro promo, persist an identity-level beta-participant record before beta closes, and enforce one redemption per eligible participant.
- [x] Make the production beta-close operation global: stop new beta activation, end active beta access together, preserve all user/workspace data, and keep the participant promo redeemable according to the approved policy.
- [x] Add the production backfill for beta participants who predate the participation record: `lib/db/migrations/2026-07-beta-participation-backfill.ts`. Running it against production remains open (see the code-and-data-gates checklist item).
- **Required behavior:** implement one coherent free/beta/trial policy, including the two-month global beta window, participant eligibility evidence, two-month promo expiry from redemption, active-Pro stacking behavior, conversion to paid Pro, and production flag behavior.
- **Why:** access enforcement, customer expectations, and billing/legal copy currently disagree.
- **Acceptance criteria:** one state table covers free, active beta, closed-beta participant, two-month promo, active/canceled/terminal-expired Pro; no unenforced promise remains; global beta closure and time-based promo expiry are reliable and idempotent.
- **Tests:** beta-participant capture, global close, grant expiry, promo redemption, duplicate/concurrent redemption, active-Pro stacking, gating, entitlement limits, clocks/time zones, production flag, tenant isolation, and locale parity.
- **Locales:** yes, all five.

### 6. Add fail-fast production environment validation

- **Priority:** blocking
- **Likely files/modules:** a server-only environment schema loaded before startup, `server.ts`, billing/auth/storage/email initialization, `deploy/ecosystem.config.js`, `.env.example`, and validation tests.
- **Current behavior after PR #58:** `server.ts` runs a tested central environment validator at runtime startup. Production requires the launch service matrix, HTTPS origins, strong secrets, live Lemon Squeezy mode, matching Cloudflare hashes, a non-local Workflow World, and rejects seed/debug variables.
- [ ] Run the validator with the final production secret set and retain redacted startup/readiness evidence.
- **Required behavior:** production refuses to start with missing/invalid credentials, non-HTTPS origins/callbacks, test billing mode, dev/test keys, mismatched Cloudflare hashes, weak cookie secrets, or forbidden seed/debug flags.
- **Why:** runtime-only failures create a superficially healthy but unusable or unsafe launch.
- **Acceptance criteria:** schema covers the matrix, secrets never log, optional variables are explicit, production and test fixtures are separate, and PM2 health fails on invalid configuration.
- **Tests:** required/optional combinations, URL/length/boolean validation, redaction, production test-mode rejection, and development behavior.
- **Locales:** no.

### 7. Add health/readiness and deployment-safe proxy handling

- **Priority:** blocking
- **Likely files/modules:** new health/readiness route(s), `server.ts`, `deploy/Caddyfile`, PM2 config, public inquiry client-IP extraction/rate limiter, and deployment tests/docs.
- **Current behavior after PR #58:** `/api/health` provides liveness and Mongo/Workflow readiness; the custom server shuts down HTTP, Socket.IO, Workflow, and Mongo gracefully; visitor IP uses `CF-Connecting-IP`; Caddy documents the required Cloudflare-only origin boundary.
- [ ] Configure the origin restriction and external monitor, then verify spoof resistance, WebSocket reconnection, PM2 restart, and server reboot in the deployed environment.
- **Required behavior:** non-sensitive liveness/readiness signals, graceful shutdown/restart, correct trusted visitor IP behind a Cloudflare-restricted origin, WebSockets, and monitorable Caddy/PM2 behavior.
- **Why:** rollback/monitoring cannot distinguish a running process from a usable app, and incorrect IP trust breaks abuse controls.
- **Acceptance criteria:** external monitor detects app/DB failure; direct origin/header spoofing cannot forge visitor identity; two visitors remain distinct; WebSockets reconnect through proxy; config validates before reload.
- **Tests:** health success/failure/redaction, trusted/untrusted proxy headers, rate limits, graceful shutdown, WebSocket integration.
- **Locales:** no.

### 8. Make email failures observable and recoverable

- **Priority:** high
- **Likely files/modules:** `lib/email/send.ts`, all transactional email callers, `app/api/webhooks/workos/route.ts`, notification persistence/operations UI, optional Resend webhook route, and email tests.
- **Current behavior after PR #58:** missing Resend configuration is fatal in production, transport failures are redacted/observable, critical callers expose recoverable outcomes, and WorkOS webhook email processing uses the event ledger with retryable failures. Some best-effort callers still discard delivery results; no Resend bounce/complaint webhook or universal retry/status UI exists.
- **Progress 2026-07-14:** `app/api/webhooks/resend/route.ts` now verifies the Resend svix signature, dedupes via the shared `WebhookEvent` ledger, and logs `email.bounced`/`email.complained` events (`116cd5b`, `d8245c8`). Still open: routing those log lines to an actual alert channel, and excluding the endpoint from Cloudflare challenges/caching (needs the production Cloudflare setup from Phase 2).
- [ ] Define recovery for remaining best-effort callers and configure/test Resend delivery, bounce, complaint, and alert handling.
- **Required behavior:** startup blocks missing production transport, critical messages have durable status/retry or a safe resend path, and bounce/complaint/API failures alert operations without rolling back already committed business data.
- **Why:** signup verification, password reset, invitations, and expiry communication can silently disappear.
- **Acceptance criteria:** each critical email has a defined failure outcome and resend/recovery path; provider/webhook retries are safe; PII is redacted; delivery dashboards/alerts are tested.
- **Tests:** missing config in production, 4xx/5xx/network failure, retry/dedupe, bounce/complaint, mutation success with visible email failure, locale parity.
- **Locales:** yes for new/changed user copy in all five.

### 9. Harden production migrations, index sync, and database targeting

- **Priority:** high
- **Likely files/modules:** `lib/db/reindex.ts`, `scripts/backfill-inquiries.ts`, migration runner/manifest, deployment scripts, `.env.example`, and script tests.
- **Current behavior after PR #58:** migrations/reindex/backfill use a shared guarded target check; reindex supports reviewed diffs/dry-run; inquiry backfill uses `DATABASE_URL`; the Starter migration is guarded and idempotent. There is still no ordered migration ledger/runner, and not every historical migration has equivalent dry-run/resume behavior.
- [ ] Create the release migration manifest/evidence, rehearse against a restored clone, review index removals, and add missing dry-run/resume support where required.
- **Required behavior:** explicit environment/cluster fingerprint, dry-run and counts, reviewed migration ordering, tenant-safe filters, resumability/idempotency, index diff approval, and audit output with no PII.
- **Why:** a correct application deployed against the wrong database or an unreviewed index drop is a production data incident.
- **Acceptance criteria:** scripts refuse known dev targets, require explicit production confirmation, use consistent env names, run against a restored clone, and emit before/after evidence.
- **Tests:** target guards, dry run, idempotency, partial failure/resume, tenant isolation, index diff behavior.
- **Locales:** no.

### 10. Make the hourly invitation-seat job operationally reliable

- **Priority:** high
- **Likely files/modules:** `lib/db/jobs/release-expired-invite-seats.ts`, cron route, deployment timer unit/script, metrics/logging, and tests.
- **Current behavior after PR #58:** the job claims/releases transactionally, batches with a cursor, retries recoverably, and uses a matching global index. Versioned systemd units replace Vercel cron assumptions. Installation, last-success/failure alerting, and reboot proof remain open; per-item failures currently return an HTTP 200 report, so `curl --fail` alone will not alert.
- [ ] Install/enable the units, add a real failure alert/health signal (including partial failures), and prove reboot, overlap, retry, and operator replay on Hetzner.
- **Required behavior:** transactionally couple/recover the invitation transition and seat releases, batch/paginate the sweep, add the matching index, and provide observable retryable execution with last-success/failure metrics and operator replay.
- **Why:** partial or silent failure can permanently leave expired invitations reserving seats, and an unbounded scan will degrade with production growth.
- **Acceptance criteria:** systemd timer survives reboot; injected seat-release failure is recoverable; overlapping/repeated calls are safe; global query uses a reviewed index; batches finish/restart safely; invalid auth fails; failure alerts and release counts reconcile.
- **Tests:** authentication, Mongo transaction rollback/retry, concurrency, idempotency, pagination, partial failure, multi-tenant sweep, query/index evidence, metrics/log redaction.
- **Locales:** no.

### 11. Align launch-facing pricing, legal, and billing copy, derive prices from lemonsqueezy instead of a static value.

- **Priority:** blocking
- **Likely files/modules:** marketing pricing page/components, compliance pages/messages, onboarding plan/subscribe/billing panels, `messages/{en,fil,ms,id,ar}.json`, `docs/release/gallurio-launch-copy-draft.md`, `docs/release/lemonsqueezy-product-copy-draft.md`, and Lemon Squeezy setup docs.
- **Current behavior after PR #58:** launch-facing marketing/onboarding/billing copy reflects the one-month free-Pro entry model and Pro monthly/yearly catalog. Pricing requests live Lemon Squeezy variant values but deliberately falls back to static catalog amounts when lookup fails.
- [ ] Verify final legal/refund/expiry wording and prove displayed currency/amount/tax equals the live store; decide whether production may fall back or should fail closed on pricing lookup errors.
- **Required behavior:** public, legal, onboarding, billing, cancellation, refund, trial/beta, and expiry copy matches the approved Pro-only live product.
- **Why:** contradictory pricing and subscription terms are a conversion, support, and compliance risk.
- **Acceptance criteria:** one reviewed pricing/currency/tax/cancellation/expiry story across all public and app surfaces; no paid Starter references; real checkout totals match displayed copy.
- **Tests:** rendered pricing/legal pages, link checks, checkout-copy parity, locale-key parity, Unicode/RTL regression only for supported scope.
- **Locales:** yes, all five.

### 12. Complete launch-critical loading/error/empty-state coverage

- **Priority:** medium
- **Likely files/modules:** route segments for clients, teams, gallery, portfolio/editor, notifications, subscribe/billing/onboarding/auth, plus shared error/loading components and component tests.
- **Current behavior after PR #58:** clients, teams, notifications, portfolio, and subscribe gained tested loading skeletons; targeted tables/lists use a shared accessible empty-state primitive. The full gallery/auth/onboarding error/retry inventory and 375 px/keyboard evidence are still missing.
- [ ] Complete the remaining loading/error/retry/disabled-state inventory and focused 375 px plus desktop browser verification.
- **Required behavior:** every launch-critical async surface has accessible loading, empty, error/retry, populated, disabled, and focus behavior at 375 px and desktop.
- **Why:** network/provider failures are expected during launch and must not become blank or stuck screens.
- **Acceptance criteria:** state inventory is complete; errors surface actionable recovery; no hover-only controls; screenshots and keyboard checks exist for critical paths.
- **Tests:** component/route state tests and focused Playwright flows at 375 px plus desktop.
- **Locales:** yes for any added user copy in all five.

### 13. Conditional Paddle migration only if the product decision changes

- **Priority:** later, but blocking before launch if Paddle is reaffirmed
- **Likely files/modules:** replace `@lemonsqueezy/lemonsqueezy.js`, `lib/lemonsqueezy/*`, checkout/webhook routes, billing actions/UI/copy, workflow payloads/steps, Workspace `ls*` fields and migration, env schema/example, tests, and provider documentation.
- **Current behavior:** Lemon Squeezy is implemented end to end and is the repository authority; Paddle exists only in stale project guidance.
- **Required behavior:** if Paddle is selected, produce and execute a deliberate provider migration with live price IDs for Pro monthly/yearly, raw-body HMAC verification, durable webhooks/workflow resume, customer portal/cancellation, data migration/reconciliation, and removal of Lemon Squeezy code/config.
- **Why:** silently mixing provider guidance and implementation can charge customers incorrectly or lose subscription state.
- **Acceptance criteria:** a signed architecture decision names one provider; only that provider appears in dependencies, env, routes, fields, UI, legal copy, tests, and operations; migration/cutover/rollback is rehearsed.
- **Tests:** signature, price mapping, checkout/workflow, webhook retry/idempotency, cancellation/expiry/refund/dunning, tenant isolation, migration, locale parity.
- **Locales:** yes, all five.

### 14. Configure a production Workflow World for durable checkout

- **Priority:** blocking
- **Likely files/modules:** `package.json`/lockfile, `next.config.ts`, new `instrumentation.ts` or custom-server lifecycle wiring, environment schema/example, `deploy/ecosystem.config.js`, CI, `lib/workflows/subscriptionCheckout*`, operations scripts/docs, and integration tests.
- [ ] Provision the production Postgres service, bootstrap its schema, configure backups/monitoring, and prove checkout survival across application/worker restart before checking this engineering item complete.
- **Current behavior:** `@workflow/world-postgres` is a runtime dependency, `instrumentation.ts` starts the World on boot (`lib/workflows/world.ts`: `startWorld`/`stopWorld`/`worldReady`), `lib/env.ts` requires `WORKFLOW_TARGET_WORLD`/`WORKFLOW_POSTGRES_URL` in production and fails closed if `WORKFLOW_TARGET_WORLD` is still the Local World, and CI runs `pnpm test:integration`. Dev still defaults to the implicit Local World (env unset). Remaining gap: this is code-level wiring only — the actual production Postgres database still needs to be provisioned, its schema bootstrapped (`pnpm exec workflow-postgres-setup`), and the restart-survival test below still needs to be run against real infra before launch.
- **Required behavior:** use a production-supported self-hosted World (normally Postgres World on Hetzner), bootstrap and start its long-lived worker, back up/monitor it, fail readiness when unavailable, and include Workflow integration/restart tests in CI.
- **Why:** checkout runs and hooks can be lost across PM2 restart/reboot, invalidating the claimed durable billing flow.
- **Acceptance criteria:** production never selects Local World; adapter/schema/env/worker are deployed; in-flight checkout survives app and worker restarts; duplicate webhook resumes once; workflow data restore is tested; queue/run failures alert; CI runs the integration suite.
- **Tests:** adapter configuration, bootstrap/idempotency, worker startup/shutdown, app/DB restart survival, hook resume/dedupe, failure/retry, tenant isolation, backup restore, and CI integration job.
- **Locales:** no.

## Open Decisions / Assumptions

- Lemon Squeezy is assumed to remain the launch billing provider because it is the only implemented provider. Paddle guidance is treated as stale until a signed product/architecture decision says otherwise.
- The beta host decision is `https://www.gallurio.com/w/<slug>` for now. Wildcard portfolio subdomains and custom hostnames are deferred until after beta.
- The live Pro currency, monthly/yearly amounts, taxes, trial, dunning, refund, and payout configuration cannot be confirmed from code. The live API/dashboard must remain authoritative; static PHP fallback values are not proof of live checkout configuration.
- The code now implements one free month, optional beta grants, active/canceled Pro, dunning retention, a staged lapse lifecycle, the two-month global beta-close, and the participant-only two-month promo (with active-Pro stacking). Final legal/support copy approval is still open.
- Payment expiry follows the Lemon Squeezy terminal decision, not the first failed-payment notification; the exact terminal event/status mapping must be proven in provider test mode.
- Public-page unpublish timing and CRM/draft retention are implemented, but data export and support access after subscription expiry are not fully defined.
- Hetzner size is a beta starting assumption, not capacity evidence; revise it after a representative load test.
- Cloudflare visitor-IP handling is implemented, but the production origin restriction and explicit WebSocket/webhook/cache rules still need deployment proof.
- Launch locales are `en`, `fil`, `ms`, `id`, and `ar`; Thai remains excluded. Arabic transactional email parity for lapse/lifecycle emails and RTL logo layout are implemented (2026-07-14); a full cross-surface locale sweep is still open.
- Backup retention and RPO/RTO, monitoring vendors, incident contacts, support SLA, and maintenance window must be chosen outside the repository.
- A Resend bounce/complaint webhook now exists (`app/api/webhooks/resend/route.ts`); routing its log lines to an actual alert channel and a durable webhook/event queue beyond the existing ledger are not currently present.
- No codebase evidence proves that production accounts, DNS, credentials, backups, alerts, live products, or webhooks have already been configured; therefore none are checked.

## Official operational references

- [Next.js installation and Node.js requirements](https://nextjs.org/docs/app/getting-started/installation)
- [Cloudflare Full (strict) SSL](https://developers.cloudflare.com/ssl/origin-configuration/ssl-modes/full-strict/)
- [Cloudflare origin protection](https://developers.cloudflare.com/fundamentals/security/protect-your-origin-server/)
- [Cloudflare visitor IP headers](https://developers.cloudflare.com/fundamentals/reference/http-headers/)
- [Cloudflare Images direct creator uploads](https://developers.cloudflare.com/images/storage/upload-images/direct-creator-upload/)
- [WorkOS staging versus production environments](https://workos.com/docs/authkit/environments)
- [WorkOS custom emails](https://workos.com/docs/authkit/custom-emails)
- [Resend domain verification](https://resend.com/docs/dashboard/domains/introduction)
- [Lemon Squeezy webhook delivery/retries](https://docs.lemonsqueezy.com/help/webhooks/webhook-requests)
- [Lemon Squeezy subscription statuses](https://docs.lemonsqueezy.com/help/products/subscriptions)
