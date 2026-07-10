# Lemon Squeezy Billing — Setup & Architecture

Gallurio bills tenants (workspace owners) via **Lemon Squeezy**, a Merchant of
Record (MoR) — it collects payments worldwide, remits VAT/GST/sales tax in
every jurisdiction it supports, and pays out net proceeds to Gallurio.
Lemon Squeezy replaced Paddle because Gallurio has no registered PH business
entity yet: Paddle requires one, Lemon Squeezy accepts an individual/sole
proprietor seller. This is a hard cutover — no live Paddle subscribers existed,
so there was no data migration.

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
   `subscription_payment_success`, `subscription_payment_failed`.
4. Copy the **signing secret** → `LEMONSQUEEZY_WEBHOOK_SECRET`.

### 5. Enable test mode

Lemon Squeezy has no separate sandbox API base URL like Paddle's — a single
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

### Checkout flow (checkout-URL + durable-workflow-hook)

1. Client (settings billing panel or onboarding plan step) `POST`s
   `/api/billing/checkout` with `{ plan, cadence, onboarding? }`.
2. The route (`app/api/billing/checkout/route.ts`):
   - Resolves the target `variantId` from `lib/lemonsqueezy/plans.ts`
     (`PLAN_CATALOG`).
   - Cancels any in-flight checkout workflow run for this workspace (looked
     up by the deterministic hook token `ls-checkout-<workspaceId>`) so an
     abandoned checkout can't block a retry.
   - Starts `subscriptionCheckoutWorkflow(workspaceId, plan)` — a durable
     Vercel Workflow run (`lib/workflows/subscriptionCheckout.ts`) that
     creates a hook on that same `ls-checkout-<workspaceId>` token and
     suspends, surviving cold starts/deploys.
   - Calls `createSubscriptionCheckout()` (`lib/lemonsqueezy/client.ts`),
     which hits the Lemon Squeezy SDK's `createCheckout(storeId, variantId, …)`
     with `checkoutData: { email, name, custom: { workspaceId } }` and
     `testMode`. Lemon Squeezy resolves/creates the customer from the checkout
     email itself — there is no customer pre-create step (unlike Paddle).
   - Returns `{ checkoutUrl, workspaceId }`. The client opens `checkoutUrl` in
     the Lemon Squeezy overlay (`lemon.js`) — no client-side API key needed.
3. The user pays in the overlay. Lemon Squeezy fires `subscription_created` to
   the registered webhook, echoing `meta.custom_data.workspaceId` back.
4. The webhook handler (`app/api/webhooks/lemonsqueezy/route.ts`) upserts the
   workspace's subscription fields, applies the team-cap downgrade guard
   before promoting `plan`, and calls `resumeHook("ls-checkout-<workspaceId>", …)`
   to wake the suspended workflow, which persists subscription bookkeeping
   fields via `lib/workflows/steps/billing.ts` and clears
   `lsCheckoutWorkflowRunId`.
5. `/onboarding/done` also calls `reconcileLemonSqueezySubscription()` as a
   best-effort safety net for the race between checkout completing and the
   webhook arriving — it looks up the subscription by the owner's email via
   `listActiveSubscriptionsForEmail()` (no stored customerId to key off, since
   none is pre-created).

### Webhook event handling — the cancelled-vs-expired distinction

This is the one place Lemon Squeezy's lifecycle differs meaningfully from
Paddle's, and the handler is NOT a naive rename of the old Paddle logic:

- **`subscription_cancelled`** fires the instant the user cancels, but the
  subscription's `status` stays `cancelled` and **access continues until
  `ends_at`** (the period they already paid for). The handler only updates
  `lsSubscriptionStatus: "canceled"` (+ `lsCurrentPeriodEnd` from `ends_at` if
  present) — it does **not** touch `plan`.
- **`subscription_expired`** is the event that means access has actually
  ended. This is the one that downgrades `plan` to `"free"`, bypassing the
  team-cap guard entirely (an expired subscription must never leave an
  over-cap team on paid entitlements — that's a billing leak, not a UX
  nicety).
- `subscription_created` / `subscription_updated` run the same upsert path:
  route by `meta.custom_data.workspaceId` with a defence-in-depth check
  against a different existing subscription id on that workspace, resolve the
  plan tier from `variant_id`, apply the team-cap guard before promoting
  `plan`, and `resumeHook()` on creation.
- `subscription_paused` / `subscription_unpaused` / `subscription_resumed` /
  `subscription_payment_failed` are status-only updates.
- `subscription_payment_success` best-effort bumps status to `active`; it only
  touches `lsCurrentPeriodEnd` when the payload actually carries a usable
  `renews_at` — `subscription_updated` is the authoritative period-end source
  since Lemon Squeezy also fires it on renewal.

### Status mapping

Raw Lemon Squeezy status → Gallurio's internal `LemonSqueezySubscriptionStatus`
enum (`lib/lemonsqueezy/status.ts`, duplicated inline in
`lib/workflows/steps/billing.ts` — see that file's header comment for why the
`@workflow/vitest` bundler forces the duplication):

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
throws in production. The route always acks `200` after a successful
signature check, even if the handler itself throws, except for a genuinely
invalid signature (`401`) or an unhandled handler exception (`500`, so Lemon
Squeezy retries) — unmodelled event names are acked `200` and ignored.

### Env vars

`LEMONSQUEEZY_API_KEY`, `LEMONSQUEEZY_STORE_ID`, `LEMONSQUEEZY_WEBHOOK_SECRET`,
`LEMONSQUEEZY_VARIANT_PRO_MONTHLY_ID`, `LEMONSQUEEZY_VARIANT_PRO_YEARLY_ID`,
`LEMONSQUEEZY_TEST_MODE`. No `NEXT_PUBLIC_*` var is needed — the client never
holds a Lemon Squeezy credential; it just opens the server-generated
`checkoutUrl` in the `lemon.js` overlay.
