# Paddle + Vercel Workflow DevKit Integration Design

> **Update:** The booking inquiry flow no longer uses quote negotiation. Inquiries now follow a simple two-step path (inquiry → draft booking → owner approves via the Create-Booking modal). See [`docs/booking-inquiry-lifecycle.md`](../../booking-inquiry-lifecycle.md). The Workflow DevKit content below applies only to subscription checkout.

**Date:** 2026-06-01
**Status:** Approved for implementation
**Scope:** Replace HitPay subscription billing with Paddle MoR; add Vercel Workflow DevKit for durable subscription checkout.

---

## 1. Context and Motivation

### Why replace HitPay

Gallurio targets Philippine event businesses but plans to expand to UAE and global markets. HitPay is limited to Southeast Asia for merchant payouts and has no MoR offering — meaning Gallurio would need to register for VAT/GST in every country where it has subscribers. Philippine RA 12023 (effective June 2025) mandates 12% VAT on digital services; UAE 5% VAT is triggered from the first B2C sale to a UAE customer.

Paddle acts as the Merchant of Record: they collect payments globally, remit taxes in 80-100+ jurisdictions, and wire net payouts to a Philippine bank account via SWIFT. Gallurio's legal exposure is limited to the PHP subscription tier it defines — Paddle handles the rest.

### Why add Vercel Workflow DevKit

The subscription checkout flow is long-running and multi-party: after the owner clicks Upgrade and completes the Paddle checkout, Gallurio must wait for the `subscription.activated` webhook before updating the workspace plan. There is a non-deterministic delay between browser action and webhook arrival. Without durability, a server restart or cold start between the two events loses the correlation.

The Vercel Workflow DevKit (`workflow` package) provides durable, resumable async functions that survive Vercel cold starts and deploys. The subscription checkout flow becomes a first-class workflow function with a deterministic hook token.

---

## 2. Out of Scope

- **Marketplace payments (client → workspace owner):** Not in MVP. Workspace owners collect payment from their clients outside the app (bank transfer, GCash, cash, their own payment processor). Gallurio's role ends at a confirmed booking.
- **Paddle Connect / split payments:** Not needed without marketplace.
- **In-app notifications:** Deferred — spec at `docs/notifications-scope.md`.
- **Deposit collection:** v1.1.
- **Contract / e-signature:** Not in MVP.

---

## 3. Architecture

```
lib/paddle/
  client.ts        ← Paddle Node SDK wrapper (typed helper functions)
  webhook.ts       ← HMAC-SHA256 signature verification
  plans.ts         ← PHP pricing catalog (replaces lib/hitpay/plans.ts)

app/api/
  billing/
    checkout/route.ts       ← POST: create Paddle checkout, start workflow
  webhooks/
    paddle/route.ts         ← POST: verify signature, route events, resume hooks

lib/workflows/
  subscriptionCheckout.ts   ← durable checkout confirmation wait

lib/workflows/steps/
  billing.ts        ← updateWorkspacePlan(), sendBillingNotification()
  booking.ts        ← confirmBooking(), cancelBooking()
```

**Deleted after Paddle is confirmed working:**
- `lib/hitpay/` (entire folder)
- `app/api/webhooks/hitpay/route.ts`

**HitPay deletion is a separate PR** — do not delete until the Paddle webhook handler is live and tested in production.

---

## 4. Data Model

### Workspace — replace HitPay fields with Paddle fields

**Remove:**
```typescript
hitpayRecurringBillingId?: string;
hitpayRecurringReference?: string;
hitpayRecurringStatus?: "pending" | "active" | "cancelled" | "completed" | "closed" | "failed";
hitpayCurrentPeriodEnd?: Date;
```

**Add:**
```typescript
paddleSubscriptionId?: string;
paddleCustomerId?: string;
paddleSubscriptionStatus?: "active" | "canceled" | "past_due" | "paused" | "trialing";
paddleCurrentPeriodEnd?: Date;
paddleCheckoutWorkflowRunId?: string;   // in-flight checkout workflow run; cleared on activation
```

**Keep unchanged:** `plan: "free" | "starter" | "pro"` — the plan field is provider-agnostic.

---

## 5. Billing Flow — Paddle Subscription Checkout

### 5.1 Environment variables (replace HitPay vars)

| Variable | Value |
|---|---|
| `PADDLE_API_KEY` | Paddle sandbox/production API key |
| `PADDLE_WEBHOOK_SECRET` | Paddle webhook secret (from dashboard) |
| `PADDLE_API_BASE` | `https://sandbox-api.paddle.com` (dev) / `https://api.paddle.com` (prod) |
| `NEXT_PUBLIC_PADDLE_CLIENT_TOKEN` | Client-side Paddle.js token |
| `PADDLE_PRICE_STARTER_ID` | Paddle price ID for Starter plan (from dashboard) |
| `PADDLE_PRICE_PRO_ID` | Paddle price ID for Pro plan (from dashboard) |

### 5.2 Plan catalog — `lib/paddle/plans.ts`

```typescript
export const PADDLE_PLANS = {
  starter: {
    name: "Gallurio Starter",
    priceId: process.env.PADDLE_PRICE_STARTER_ID!,
    amountPhp: 99900,      // ₱999/month in centavos — display only
    interval: "month",
  },
  pro: {
    name: "Gallurio Pro",
    priceId: process.env.PADDLE_PRICE_PRO_ID!,
    amountPhp: 199900,
    interval: "month",
  },
} as const;
```

Unlike HitPay, Paddle requires pre-created price IDs in the dashboard — inline pricing is not supported for recurring billing. Price IDs live in environment variables for sandbox vs. production parity.

### 5.3 Checkout flow

```
Owner clicks Upgrade (Settings → Billing)
       ↓
POST /api/billing/checkout  { plan: "starter" | "pro" }
  → requireOrg() → validate plan
  → paddle.createCheckoutSession({ priceId, customerId?, email, metadata: { workspaceId } })
  → start(subscriptionCheckoutWorkflow, [workspaceId, sessionId])
  → save run ID to Workspace.paddleCheckoutWorkflowRunId
  → return { url: checkoutUrl }
       ↓
Client redirects to Paddle-hosted checkout
       ↓
Owner completes payment on Paddle's page
       ↓
Paddle fires POST /api/webhooks/paddle  event: subscription.activated
  → verify HMAC signature
  → resumeHook(`paddle-checkout-${workspaceId}`, { subscriptionId, customerId, status, periodEnd, planId })
       ↓
Workflow wakes → step: updateWorkspacePlan() → clears paddleCheckoutWorkflowRunId
```

### 5.4 `subscriptionCheckoutWorkflow`

```typescript
// lib/workflows/subscriptionCheckout.ts
import { createHook } from "workflow";
import { updateWorkspacePlanStep } from "./steps/billing";

export async function subscriptionCheckoutWorkflow(
  workspaceId: string,
  sessionId: string
) {
  "use workflow";

  const hook = createHook<{
    subscriptionId: string;
    customerId: string;
    status: string;
    periodEnd: string;
    planId: string;
  }>({ token: `paddle-checkout-${workspaceId}` });

  const event = await hook;

  await updateWorkspacePlanStep(workspaceId, {
    subscriptionId: event.subscriptionId,
    customerId: event.customerId,
    status: event.status,
    periodEnd: new Date(event.periodEnd),
    plan: planIdToPlanSlug(event.planId),
  });
}
```

Step functions (`"use step"`) handle all DB writes and external calls — workflow function is orchestration only.

### 5.5 Paddle webhook events handled

| Event | Action |
|---|---|
| `subscription.activated` | Resume checkout workflow; set plan active |
| `subscription.updated` | Update plan, status, period end |
| `subscription.canceled` | Downgrade to free; clear subscription fields |
| `subscription.past_due` | Set status `past_due` (Paddle handles dunning) |
| `transaction.completed` | Log successful charge (informational) |

**Passive billing failure handling:** Paddle's own dunning logic retries failed charges. Gallurio only reacts to final state changes (`subscription.canceled`, `subscription.past_due`) — no active retry logic needed.

---

## 6. Package Installation

```bash
pnpm add @paddle/paddle-node-sdk @paddle/paddle-js
pnpm add workflow @workflow/next
```

`@workflow/next` provides the `withWorkflow` wrapper for `next.config.ts`.

---

## 7. `next.config.ts` changes

```typescript
import { withWorkflow } from "@workflow/next";

const nextConfig = { /* existing config */ };
export default withWorkflow(nextConfig);
```

---

## 8. Testing

### Billing
- Unit test `lib/paddle/webhook.ts` — valid signature passes, tampered body rejected, missing header rejected
- Unit test `lib/paddle/plans.ts` — planIdToPlanSlug maps correctly for all known price IDs
- Integration test `subscriptionCheckoutWorkflow` — use `@workflow/vitest`, `waitForHook`, `resumeHook` to simulate Paddle webhook arrival; assert Workspace.plan updated correctly
- Tenant isolation: workspace A's checkout webhook cannot update workspace B's plan

### General
- `pnpm typecheck` must pass after Workspace model field changes
- All five locales updated for any new UI strings (billing pages)

---

## 9. Migration / Cutover

1. Install packages, set up Paddle sandbox credentials in `.env.local`
2. Implement `lib/paddle/` and `app/api/webhooks/paddle/route.ts`
3. Implement `subscriptionCheckoutWorkflow` and wire checkout route
4. Test end-to-end in sandbox (Paddle test cards, simulated webhooks)
5. Add all items requiring live Paddle to `docs/RELEASE-CHECKLIST.md`
6. **After production confirmation:** open separate PR to delete `lib/hitpay/`, `app/api/webhooks/hitpay/route.ts`, and remove HitPay Workspace fields

---

## 10. Release Checklist Additions

Items that cannot be tested in dev mode:

- [ ] Paddle sandbox → production credential swap (`PADDLE_API_KEY`, `PADDLE_WEBHOOK_SECRET`, `PADDLE_API_BASE`, `NEXT_PUBLIC_PADDLE_CLIENT_TOKEN`)
- [ ] Paddle price IDs created in production dashboard; `PADDLE_PRICE_STARTER_ID` / `PADDLE_PRICE_PRO_ID` env vars set
- [ ] Paddle webhook endpoint registered in production dashboard pointing to `https://[domain]/api/webhooks/paddle`
- [ ] PHP payout currency confirmed in Paddle dashboard (PHP bank account linked)
- [ ] Live test: complete a Starter checkout with a real card, verify plan upgrades and webhook fires
- [ ] Confirm Paddle MoR covers Philippines VAT remittance (RA 12023 compliance)
- [ ] Confirm UAE subscribers are covered by Paddle's MoR tax remittance before marketing to UAE

---

## 11. Open Questions (resolved)

| Question | Decision |
|---|---|
| Provider abstraction layer? | No — Paddle is the only provider; delete HitPay cleanly |
| Marketplace payments (client → owner)? | Out of scope for MVP; owners collect payment themselves |
| Billing failure handling? | Passive — Paddle dunning; Gallurio reacts to final state only |
| In-app notifications? | Deferred — separate scope at `docs/notifications-scope.md` |
