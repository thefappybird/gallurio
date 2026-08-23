# Module: Billing

Subscription billing for Gallurio workspaces. Live implementation is **Lemon Squeezy**; Creem and a possible Paddle sole-proprietor application remain candidates until one can legitimately activate live payments — see CLAUDE.md's Billing section for the provider-decision constraints before touching this area.

## Data model

- `Workspace.plan`: `free | pro | beta`. No Starter tier (removed, never restore).
- Lemon Squeezy fields on `Workspace`: `lsSubscriptionId`, `lsCustomerId`, `lsSubscriptionStatus` (`active|canceled|past_due|paused|trialing|null`), `lsCurrentPeriodEnd`, `lsLastEventAt` (webhook ordering gate — an older event can never undo a newer one).
- Beta/lifecycle fields on `Workspace`: `everSubscribed`, `planGrantExpiresAt`, `codesRedeemed[]` (ref `PromoCode`), `pendingPromoGrant: { grantMonths, queuedAt }`, `lifecycle: { lapsedAt, warned7dAt, expiredNotifiedAt, remind1moAt, remind7wkAt, wipedAt }`.
- `User.betaParticipation: { recordedAt, source }` — durable, identity-scoped record of beta participation (not just `Workspace.plan`). `User.betaPromoRedeemedAt` guards one-time redemption per identity. `User.freeTrialConsumedAt` guards the one-month free-Pro grant.
- `PromoCode`: `code` (unique), `type: lifetime|yearly|monthly|beta|beta2mo`, `expiresAt`, `revokedAt`.
- `Transaction`: payment/subscription ledger row — `amount`, `currency`, `method: lemonsqueezy|cash|card|remit|transfer|other`, `lsOrderId`/`lsSubscriptionId` (sparse), linked to `Booking`/`Client`/`Team`.
- `WebhookEvent`: idempotency ledger — unique `{provider, eventKey}`, `status: received|processing|processed|failed`, `claimToken`/`claimedAt`/`leaseExpiresAt` (2-minute claim-lease), `attemptCount`, redacted `payload`.

## Checkout + webhook architecture

- Checkout is **synchronous**: `POST /api/billing/checkout` authenticates, rate-limits, resolves the Pro variant, and returns a Lemon Squeezy-hosted checkout URL directly. Non-onboarding checkout completions pass through `/billing/return`, which performs an authenticated Lemon Squeezy reconciliation before forwarding to the requested in-app route; this is a redirect-race safety net, not a replacement for webhooks. No durable workflow engine, no separate billing database.
- Webhook: `app/api/webhooks/lemonsqueezy/route.ts`. Raw-body HMAC-SHA256 verification against `X-Signature` before parsing, Zod-validated envelope, Node runtime. Always ack 200 after signature verification even if the handler fails (never 500 into a provider retry loop).
- Durability = at-least-once delivery + idempotent, effectively-once application via the `WebhookEvent` claim-lease ledger: at most one live worker applies a given event; an expired-lease worker can never overwrite a newer claimant's outcome. Ordering is enforced by comparing `attributes.updated_at` against `Workspace.lsLastEventAt` (`applyOrderedWorkspaceUpdate()`).
- All 12 registered events, via a typed handler registry (`lib/lemonsqueezy/webhookHandlers.ts`): `subscription_created|updated|cancelled|resumed|expired|paused|unpaused|payment_success|payment_failed|payment_refunded|payment_recovered|plan_changed`.
  - `subscription_cancelled` — status-only; access continues until `ends_at`, does not downgrade.
  - `subscription_expired` / `subscription_payment_refunded` — downgrade `plan` to free (expired bypasses the team-cap guard).
  - `subscription_updated` — catch-all snapshot for any attribute change.
- Status mapping: LS `on_trial→trialing`, `active→active`, `paused→paused`, `past_due|unpaid→past_due`, `cancelled|expired→canceled`.

## Setup (env vars)

`LEMONSQUEEZY_API_KEY`, `LEMONSQUEEZY_STORE_ID`, `LEMONSQUEEZY_WEBHOOK_SECRET`, `LEMONSQUEEZY_VARIANT_PRO_MONTHLY_ID`, `LEMONSQUEEZY_VARIANT_PRO_YEARLY_ID`, `LEMONSQUEEZY_TEST_MODE`, `PAID_BILLING_ENABLED`. Webhook callback: `https://<domain>/api/webhooks/lemonsqueezy`. Set `PAID_BILLING_ENABLED=true` only with live Lemon Squeezy credentials and `LEMONSQUEEZY_TEST_MODE=false`; production then rejects any event with `meta.test_mode === true`. This gate is independent of `BETA_TESTER_ENABLED`, so free beta access can remain open while paid checkout is live.

Local webhook testing without a real Lemon Squeezy round-trip: `pnpm lemonsqueezy:sim subscription-created <workspaceId>` (POSTs to `http://localhost:3000/api/webhooks/lemonsqueezy`, override target with `LEMONSQUEEZY_SIM_URL`). See the `lemonsqueezy-dev` skill for the full local sandbox-checkout walkthrough.

## Beta program lifecycle (free-mode / beta-mode launch model)

One month of free Pro on signup, then a hard gate to `/subscribe`. No permanent free tier. Beta close does **not** delete workspace/CRM/bookings/gallery/team data — only the public page eventually goes offline.

Lapse timeline (both "free month expired" and "lapsed paid Pro" funnel into the same lifecycle): T0 gate + notify → T+30d saved-data reminder email → T+51d public-page-offline warning → T+58d unpublish the public page only (all CRM/portfolio data retained so republish works immediately on resubscription). `Workspace.lifecycle.*` timestamps are stamped by a daily sweep job; `isEntitled()` is the single source of truth for whether a workspace currently has access (active subscription OR future `planGrantExpiresAt` OR `plan === "beta"` with no grant expiry).

Ops commands (`docs/BETA-OPERATIONS.md` content, consolidated here):
- Toggle new beta activation: `BETA_TESTER_ENABLED` env var (`false` stops new signups from choosing beta; existing beta access only ends via explicit close).
- Announce close ≥7 days ahead: `pnpm beta:schedule-end -- --ends-at=<ISO> --operator=<name> --allow-dev` — shows an app-wide banner to beta workspaces from T-7d.
- Close beta: set `BETA_TESTER_ENABLED=false`, then `pnpm beta:close -- --operator=<name> --allow-dev --confirm-close` (add `--i-understand-production` against a prod-like DB). Moves beta workspaces to free (or applies a queued promo grant), starts the lifecycle sweep, removes the banner.
- Base promo codes (idempotent seed): `pnpm promo:seed-base -- --allow-dev` creates `MONTHPRO2026` (1mo), `YEARPRO2026` (1yr), `LIFETIME2026` (perpetual), `BETA2PRO` (2mo, server-enforced one-time per verified beta identity).
- Create an ad-hoc promo: `pnpm seed:promo -- --code=<CODE> --title="<title>" --type=monthly|yearly|lifetime|beta|beta2mo --allow-dev [--expires-at=<ISO>]`.
- Manual one-time redemption override (support recovery): `pnpm promo:allow-redemption -- --workspace-id=<id> --code=<code> --operator=<ticket> --reason="<why>" --allow-dev` — requires operator + reason, writes an activity record, never logs the code itself.

Support/recovery playbook: eligibility = `User.betaParticipation.recordedAt` non-null + `BetaProgram.closedAt` null. Promo recovery = case-insensitive `PromoCode.code` lookup, check `revokedAt`/`expiresAt`; clearing a wrongly-set `revokedAt` needs a matching manual `Workspace.planGrantExpiresAt`/`pendingPromoGrant` fix. Resubscription does **not** auto-republish the public page (`publicPage.publishedAt` stays whatever it was) — confirm `lifecycle.wipedAt` is null before manually republishing after an accidental unpublish.

## Known deferrals

- **Gulf currency precision**: `formatMoney` hard-codes `maximumFractionDigits: 0` (test-pinned for PHP MVP). 3-decimal Gulf currencies (KWD/BHD/OMR) and 2-decimal ones (AED/SAR/QAR) render rounded. Display-only; billing itself is by Lemon Squeezy `variantId`, unaffected. Fix alongside the Arabic/Gulf UX work — see `docs/modules/i18n-design.md`.
- **Provider decision**: keep Lemon Squeezy code release-safe; do not add Creem/Paddle config, claim either is integrated, or build a generic payment-provider abstraction before an explicit decision. A switch is a scoped migration (checkout + webhooks + schema/env/docs/test audit), not a config toggle.
- **Launch copy**: current English pricing/lifecycle-email copy lives in `messages/en.json` (`marketing.*` namespaces) and was drafted against Lemon Squeezy as the named Merchant of Record; copy is provider-name-generic until a provider is formally selected. Confirm lifecycle-email locale coverage before enabling paid billing.
