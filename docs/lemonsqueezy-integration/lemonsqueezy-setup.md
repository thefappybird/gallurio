# Lemon Squeezy Billing — Setup & Architecture

Gallurio currently bills tenants (workspace owners) in code via **Lemon Squeezy**, a Merchant of
Record (MoR) — it collects payments worldwide, remits VAT/GST/sales tax in
every jurisdiction it supports, and pays out net proceeds to Gallurio.
This document describes the current Lemon Squeezy implementation. For live launch, Lemon Squeezy, Creem, and a possible Paddle sole-proprietor application are candidates. Use this setup only if Lemon Squeezy is explicitly selected after live eligibility and approval verification; Creem and Paddle are not integrated today. This was a hard cutover with no live subscribers, so there was no data migration.

**Currently running in test/sandbox mode** (`LEMONSQUEEZY_TEST_MODE=true`) —
pre-launch, no real subscribers.

---

## Part A — Manual dashboard setup (do this outside of code)

### 1. Create a Lemon Squeezy account + store

1. Sign up at [lemonsqueezy.com](https://www.lemonsqueezy.com).
2. Create a store (**Settings → Stores → + New store**). Copy the numeric
   **Store ID** → `LEMONSQUEEZY_STORE_ID`.
3. **Store currency / PHP support**: confirm in **Settings → Store → Currency**
   whether the store can be set to PHP. Lemon Squeezy's supported store
   currencies vary by account region — if PHP isn't offered as a store
   currency, fall back to **USD** as the store currency and keep displaying
   PHP amounts in the app UI only (Lemon Squeezy still converts/charges the
   card in the store's settlement currency; the checkout overlay shows the
   card's local currency automatically). Verify this in the dashboard before
   creating variants — it determines whether the ₱250/₱2,500 amounts below
   are entered as PHP or converted to their USD equivalent.

### 2. Create the Pro product + variants

1. **Products → + New product**. Name: `Gallurio Pro`.
2. Add two variants (**Subscription** billing type):
   - **Monthly**: ₱250 (or USD equivalent, per Part A.1) / month.
   - **Yearly**: ₱2,500 (or USD equivalent) / year.
3. Copy each variant's numeric ID from the variant row:
   - Monthly → `LEMONSQUEEZY_VARIANT_PRO_MONTHLY_ID`
   - Yearly → `LEMONSQUEEZY_VARIANT_PRO_YEARLY_ID`

### 3. Generate an API key

**Settings → API** → **+ Create API key**. Copy it → `LEMONSQUEEZY_API_KEY`.
Keys are shown once; scope to the store created above if the dashboard offers
per-store scoping.

### 4. Register the webhook

1. **Settings → Webhooks → + New webhook**.
2. **Callback URL**: `https://[your-domain]/api/webhooks/lemonsqueezy` (or your
   dev tunnel URL for local testing, e.g.
   `https://abcd.cfargotunnel.com/api/webhooks/lemonsqueezy`).
3. **Events**: subscribe to `subscription_created`, `subscription_updated`,
   `subscription_cancelled`, `subscription_resumed`, `subscription_unpaused`,
   `subscription_paused`, `subscription_expired`,
   `subscription_payment_success`, `subscription_payment_failed`,
   `subscription_payment_refunded`, `subscription_payment_recovered`,
   `subscription_plan_changed`.
4. Copy the **signing secret** → `LEMONSQUEEZY_WEBHOOK_SECRET`.

### 5. Enable test mode

Lemon Squeezy has no separate sandbox API base URL — a single
account serves both test and live data, gated by a `testMode` flag on each
checkout/API call and a `meta.test_mode` boolean on webhook payloads. Toggle
**test mode** on in the dashboard header while iterating, and keep
`LEMONSQUEEZY_TEST_MODE=true` in non-production `.env` files (unset or
anything other than the literal string `"false"` also counts as test mode —
the app errs toward sandbox).

### 6. Local testing

- **Webhook replay without a tunnel**:
  `pnpm lemonsqueezy:sim subscription-created <workspaceId> [variantId]` signs
  a Lemon Squeezy-shaped payload with `LEMONSQUEEZY_WEBHOOK_SECRET` and POSTs
  it straight at `http://localhost:3000/api/webhooks/lemonsqueezy` (override
  with `LEMONSQUEEZY_SIM_URL`). Also supports `subscription-updated`,
  `subscription-cancelled`, `subscription-expired`,
  `subscription-payment-success`.
- **Full flow**: dev server (+ tunnel if testing the real checkout overlay) →
  sign up → onboarding plan step → pick Pro → checkout overlay opens against
  the real Lemon Squeezy test-mode checkout URL → pay with a Lemon Squeezy
  test card → `Checkout.Success` event redirects to `/onboarding/done` →
  `reconcileLemonSqueezySubscription` (safety net) or the
  `subscription_created` webhook (primary path) upgrades the workspace.

### 7. Production cutover

1. Turn test mode off (`LEMONSQUEEZY_TEST_MODE=false`, and un-toggle test mode
   in the dashboard if it's account-wide there).
2. Re-verify the webhook destination points at the production domain.
3. Confirm payout details are configured (**Settings → Payouts**).
4. Run one real-card Pro checkout end to end and confirm the workspace
   upgrades and `docs/RELEASE-CHECKLIST.md` billing items are all checked.

---

## Part B — Architecture

### Checkout flow (synchronous — no durable workflow)

1. Client (settings billing panel or onboarding plan step) `POST`s
   `/api/billing/checkout` with `{ plan, cadence, onboarding? }`.
2. The route (`app/api/billing/checkout/route.ts`) authenticates, rate-limits
   by workspace, resolves the target `variantId` from `lib/lemonsqueezy/plans.ts`
   (`PLAN_CATALOG`), calls `createSubscriptionCheckout()`
   (`lib/lemonsqueezy/client.ts` — hits the Lemon Squeezy SDK's
   `createCheckout(storeId, variantId, …)` with
   `checkoutData: { email, name, custom: { workspaceId } }` and `testMode`;
   Lemon Squeezy resolves/creates the customer from the checkout email itself,
   no pre-create step), and returns `{ checkoutUrl, workspaceId }` directly —
   no workflow start/suspend/hook step. The client opens `checkoutUrl` in the
   Lemon Squeezy overlay (`lemon.js`) — no client-side API key needed.
3. The user pays in the overlay. Lemon Squeezy fires `subscription_created` to
   the registered webhook, echoing `meta.custom_data.workspaceId` back.
4. The webhook handler (`app/api/webhooks/lemonsqueezy/route.ts`) atomically
   claims the event in the `WebhookEvent` ledger (unique
   `{provider, eventKey}`, 2-minute processing lease), dispatches to
   `LEMONSQUEEZY_WEBHOOK_HANDLERS[event.meta.event_name]`
   (`lib/lemonsqueezy/webhookHandlers.ts`), and marks the ledger row
   `processed` only after the handler succeeds — a handler failure marks it
   `failed` and returns 500 so Lemon Squeezy redelivers.
5. `/onboarding/done` also calls `reconcileLemonSqueezySubscription()` as a
   best-effort safety net for the race between checkout completing and the
   webhook arriving — it looks up the subscription by the owner's email via
   `listActiveSubscriptionsForEmail()` (no stored customerId to key off, since
   none is pre-created), then applies the same `applySubscriptionSnapshot()`
   helper the webhook uses, so the two paths can never drift.

### Webhook event handling — the cancelled-vs-expired distinction

This is the main lifecycle distinction to keep in mind, and the handler is not a naive status mapper:

- **`subscription_cancelled`** fires the instant the user cancels, but the
  subscription's `status` stays `cancelled` and **access continues until
  `ends_at`** (the period they already paid for). The handler only updates
  `lsSubscriptionStatus: "canceled"` (+ `lsCurrentPeriodEnd` from `ends_at` if
  present) — it does **not** touch `plan`.
- **`subscription_expired`** is the event that means access has actually
  ended. This is the one that downgrades `plan` to `"free"`, bypassing the
  team-cap guard entirely (an expired subscription must never leave an
  over-cap team on paid entitlements — that's a billing leak, not a UX
  nicety). It also consumes any pending promo grant, or otherwise sets a
  15-day post-expiry free-plan grace grant.
- **`subscription_payment_refunded`** is handled the same way as
  `subscription_expired` — a refund means the customer got their money back,
  so access is revoked immediately rather than waiting for a separate
  cancellation. Note this event's `data` resource is a *subscription-invoice*,
  not a subscription: `event.data.id` is the invoice's own id, and the real
  subscription id is in `attributes.subscription_id` instead (the shared
  workspace-resolution helper checks that field first for this reason).
- `subscription_created` / `subscription_updated` / `subscription_plan_changed`
  all run the same upsert path (`applySubscriptionSnapshot()`): route by
  `meta.custom_data.workspaceId` with a defence-in-depth check against a
  different existing subscription id on that workspace, resolve the plan tier
  from `variant_id`, and apply the team-cap guard before promoting `plan`.
  `subscription_updated` is treated as the catch-all snapshot — it fires on
  ANY attribute change, so it must converge cancellation/expiry/pause/
  dunning/activation/plan-change state even if a granular companion event is
  delayed.
- `subscription_paused` / `subscription_payment_failed` are status-only
  updates that keep Pro access. `subscription_unpaused` / `subscription_resumed`
  are status-only updates that also clear the lapse-lifecycle timestamps.
- `subscription_payment_success` / `subscription_payment_recovered` both
  best-effort bump status to `active` and clear lapse-lifecycle timestamps; they
  only touch `lsCurrentPeriodEnd` when the payload actually carries a usable
  `renews_at` — `subscription_updated` is the authoritative period-end source
  since Lemon Squeezy also fires it on renewal.
- Every timestamped update is applied through `applyOrderedWorkspaceUpdate()`
  (`lib/billing/webhookOrdering.ts`), which compares the event's
  `attributes.updated_at` (falling back to `created_at`) against
  `Workspace.lsLastEventAt` so an older/out-of-order event can never overwrite
  a newer subscription state. A missing timestamp is still processed
  (degraded fallback) for compatibility.

### Status mapping

Raw Lemon Squeezy status → Gallurio's internal `LemonSqueezySubscriptionStatus`
enum (`lib/lemonsqueezy/status.ts`):

| Lemon Squeezy | Internal |
|---|---|
| `on_trial` | `trialing` |
| `active` | `active` |
| `paused` | `paused` |
| `past_due` | `past_due` |
| `unpaid` | `past_due` |
| `cancelled` | `canceled` |
| `expired` | `canceled` |

### Webhook signature verification

Lemon Squeezy's SDK has no verification helper — `lib/lemonsqueezy/webhook.ts`
verifies manually: `HMAC-SHA256(rawBody, LEMONSQUEEZY_WEBHOOK_SECRET)` hex
digest compared to the `X-Signature` header via `crypto.timingSafeEqual`. Raw
body is read before parsing (Node runtime, `dynamic = "force-dynamic"`). Dev
convenience: if `LEMONSQUEEZY_WEBHOOK_SECRET` is unset and `NODE_ENV` isn't
`production`, the route accepts an unsigned body with a console warning — this
throws in production. Response codes: `401` on an invalid signature, `400` on
a verified-but-malformed envelope, `200` for an unmodelled event name (acked
and ignored, no mutation), `200` for a duplicate/in-flight event (see below),
`500` on a handler exception (so Lemon Squeezy redelivers), `200` only after
the handler succeeds and the ledger row is marked `processed`.

A production-only guard rejects `meta.test_mode === true` events (acked `200`,
ignored) so a misconfigured test-mode checkout can never grant a real
customer paid access.

### Idempotency — the claim-lease ledger

Lemon Squeezy delivers **at-least-once** (redelivers on any non-2xx response
or timeout) — the guarantee here is idempotent, effectively-once
*application*, not exactly-once execution. Every verified event is claimed in
`WebhookEvent` (`lib/db/models/WebhookEvent.ts`) keyed by a unique
`{provider, eventKey}` before any handler runs:

- A genuinely-new `eventKey`, a `failed` row, or a `processing` row whose
  2-minute `leaseExpiresAt` has passed can be claimed (atomic
  `findOneAndUpdate` with `upsert`).
- A `processed` row or a `processing` row with a live lease matches nothing,
  so the claim attempt collides on the unique index (`E11000`) — that
  delivery acks `200` with `deduped: true` or `processing: true` and performs
  no handler call.
- Completion/failure writes are filtered on `{_id, claimToken}` together, so a
  worker whose lease already expired can never overwrite a newer claimant's
  outcome.
- `scripts/replay-lemonsqueezy-event.ts` lets an operator manually replay a
  specific `failed` ledger row (also useful alongside a dashboard "resend").

### Env vars

`LEMONSQUEEZY_API_KEY`, `LEMONSQUEEZY_STORE_ID`, `LEMONSQUEEZY_WEBHOOK_SECRET`,
`LEMONSQUEEZY_VARIANT_PRO_MONTHLY_ID`, `LEMONSQUEEZY_VARIANT_PRO_YEARLY_ID`,
`LEMONSQUEEZY_TEST_MODE`. No `NEXT_PUBLIC_*` var is needed — the client never
holds a Lemon Squeezy credential; it just opens the server-generated
`checkoutUrl` in the `lemon.js` overlay.
