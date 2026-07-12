---
name: lemonsqueezy-dev
description: How Gallurio's Lemon Squeezy subscription billing works and how to run/test checkout locally in sandbox mode. Use when touching checkout, the webhook handler, plan/pricing, or debugging a local dev checkout that hangs, times out, or redirects to Lemon Squeezy's own site instead of back into the app.
---

# Lemon Squeezy billing (local dev)

Gallurio's subscription billing is Lemon Squeezy (migrated off Paddle — no PH
business entity yet; Paddle requires one, Lemon Squeezy accepts individuals).
Test/sandbox mode is the default (`LEMONSQUEEZY_TEST_MODE` unset or `true`).

## File map

- `lib/lemonsqueezy/client.ts` — SDK wrapper: `createSubscriptionCheckout`,
  `getLemonSqueezySubscription`, `cancelLemonSqueezySubscription`,
  `listActiveSubscriptionsForEmail`.
- `lib/lemonsqueezy/plans.ts` — `PLAN_CATALOG` (only `free` and `pro`; pro has
  a monthly + yearly variant, nothing else). `planForVariantId` maps an LS
  variant back to our internal tier.
- `lib/lemonsqueezy/status.ts` — maps LS's 7 subscription statuses
  (`on_trial|active|paused|past_due|unpaid|cancelled|expired`) to our 5-value
  enum (`active|canceled|past_due|paused|trialing`).
- `lib/lemonsqueezy/webhook.ts` — manual HMAC-SHA256 verify (LS's SDK has no
  built-in verify helper) + `HANDLED_LEMONSQUEEZY_EVENTS`.
- `app/api/webhooks/lemonsqueezy/route.ts` — webhook handler. 10 events are
  wired up: `subscription_created/updated/cancelled/expired/paused/unpaused/
  resumed/payment_failed/payment_success/payment_refunded`. `payment_refunded`
  is routed to the same handler as `expired` — a refund revokes access
  immediately. Everything else (orders, disputes, license keys, affiliates)
  is acked 200 and ignored — there's nothing listening. Note:
  `subscription_payment_*` events are *subscription-invoice* resources, not
  subscriptions — `event.data.id` is the invoice's own id there, and the real
  subscription id is `attributes.subscription_id` instead; the shared
  `resolveWorkspaceFilter` helper checks that field first.
- `app/api/billing/checkout/route.ts` — Route Handler that starts the durable
  checkout workflow and calls Lemon Squeezy to create the checkout.
- `lib/workflows/subscriptionCheckout.ts` — Vercel Workflow DevKit `"use
  workflow"` function; suspends on a `createHook` until the webhook resumes it
  (or `reconcileLemonSqueezySubscription` in `lib/actions/onboarding.ts`
  reconciles it as a race-condition safety net when the user lands on
  `/onboarding/done`).
- `hooks/use-lemon-squeezy-checkout.ts` — shared client hook. Loads
  `lemon.js`, wires `LemonSqueezy.Setup({eventHandler})`, listens for
  `Checkout.Success`, exposes `open(url)`. Used by both the onboarding plan
  step and Settings → Billing.
- `lib/actions/billing.ts` — `getSubscriptionManageUrlAction` fetches a
  fresh (24h-lived) Lemon Squeezy Customer Portal URL for the workspace's
  active subscription. Settings → Billing links to it for cancel/update
  payment method/view invoices — all handled on LS's side, no custom
  cancel UI. Cancellation itself is **not** wired up as an in-app action;
  it only exists via that portal link.

## Env vars (`.env.local`)

```
LEMONSQUEEZY_API_KEY=
LEMONSQUEEZY_STORE_ID=
LEMONSQUEEZY_WEBHOOK_SECRET=
LEMONSQUEEZY_VARIANT_PRO_MONTHLY_ID=
LEMONSQUEEZY_VARIANT_PRO_YEARLY_ID=
LEMONSQUEEZY_TEST_MODE=true
```

Generate a webhook signing secret locally, no need to ask LS for one:
`openssl rand -hex 32`. Paste the same value into the LS dashboard's webhook
"Signing secret" field and into `LEMONSQUEEZY_WEBHOOK_SECRET`.

## Webhook dashboard: which events to enable

Check only the 10 handled events (see file map above). Leave the rest
unchecked — `affiliate_activated`, `customer_updated`, `dispute_*`,
`order_*`, `subscription_payment_recovered`, `subscription_plan_changed`,
`license_key_*` are all unhandled today.

## Post-payment redirect

Lemon Squeezy defaults to redirecting to **its own** hosted order page after
a successful payment unless told otherwise. That's `productOptions.redirectUrl`
on the checkout (`createCheckout`'s `checkout` param), separate from
`checkoutOptions.embed` (which controls the overlay UI). `createSubscriptionCheckout`
takes a `redirectUrl` and the checkout route computes it from the request's
own origin: `/onboarding/done` when the body has `onboarding: true`, else
`/settings/billing`. If checkout ever redirects to lemonsqueezy.com's orders
page instead of back into the app, this is the field to check first.

## Testing through a Cloudflare quick tunnel

If your test browser is on a different device than the dev server (or you
need LS to deliver webhooks to a public URL), you're likely running
`cloudflared tunnel --url http://localhost:3000`. Two things about
`trycloudflare.com` quick tunnels:

- **The hostname changes every restart.** `next.config.ts`'s
  `allowedDevOrigins` must list the *current* tunnel hostname or Next's dev
  server blocks cross-origin requests to `/_next/*` internal assets (HMR,
  RSC). Update it after every tunnel restart.
- **The tunnel has an idle/total timeout well under a minute of true
  first-hit latency.** The checkout-open step itself doesn't need the tunnel
  at all — only the post-payment webhook does (an inbound call from LS back
  to your app). If checkout is timing out through the tunnel, that's almost
  always the local dev-server latency below, not the tunnel being flaky.

## Local dev-server latency: what's normal vs. a bug

The first real hit to any route that touches the workflow (`/api/billing/checkout`,
the internal `/.well-known/workflow/v1/flow`) pays a one-time Turbopack
compile cost in this dev process's lifetime — can be tens of seconds. This is
normal Next.js dev-mode on-demand compilation, not a bug: click again and it
should return in under a second, because the route stays compiled for the
rest of that server process.

What is **not** normal, and was traced to real bugs in this session:

- **`workflow` package must be current.** `4.2.6` has multiple relevant bugs,
  fixed by `4.6.0`: a runaway "Discovering workflow directives" rescan loop
  (workflow loader running on every JS/TS file with lazy discovery on),
  wrong monorepo/workspace-root resolution, and — most damaging — orphaned
  hook-token claims from a crashed process turning into a
  `HookConflictError` that compounds on every subsequent checkout attempt
  (71s → 75s → 2.4min → 4.8min → …, observed firsthand). Keep this package
  current; `package.json` already declares `^4.2.6` so `pnpm update workflow
  @workflow/vitest` is enough once a newer patch is out.
- **Set `PORT` explicitly.** The local world (`@workflow/world-local`) makes
  a loopback HTTP call back into the app to enqueue steps, and needs the dev
  server's port. `server.ts` already defaults `port` to 3000 internally via
  `process.env.PORT ?? '3000'`, but that never actually sets the env var —
  so the workflow package can't read it and falls back to OS-level port
  auto-detection. `package.json`'s `dev` script sets `PORT=3000` explicitly
  for this reason.
- **`turbopack.root` / `outputFileTracingRoot`.** This repo is a monorepo
  with git worktrees under `.claude/worktrees/`, each with its own
  `pnpm-workspace.yaml`. Next.js auto-detects the *outer* monorepo root as
  the workspace root unless told otherwise, which drags every sibling
  worktree's `node_modules` into Turbopack's and the workflow package's file
  scanning. `next.config.ts` pins both to this directory.
- **Never force-kill (`Stop-Process -Force` / `taskkill /F`) the dev server
  mid-checkout.** A killed process leaves `.workflow-data/.locks` and
  parked hook-token claims behind — exactly the orphaned-run scenario above.
  `.workflow-data/` is local-only durable-run state (already gitignored),
  safe to `rm -rf .workflow-data` (alongside `.next`) if a checkout attempt
  ever starts taking minutes instead of seconds — that's the state
  corruption, not a fresh bug.
- **`cancelInFlightCheckout`** (in the checkout route) already exists
  specifically to cancel a prior abandoned run before starting a new one —
  it's a real safety net, but it can only clean up runs the package's own
  hook-conflict recovery lets it see. On old/buggy versions it silently
  wasn't enough; on `4.6.0`+ it's reliable.

## Verifying the raw Lemon Squeezy API in isolation

If checkout is slow/failing and you're not sure whether it's Lemon Squeezy or
local dev-server plumbing, call the SDK directly, bypassing Next/Workflow
entirely:

```js
import { lemonSqueezySetup, createCheckout } from "@lemonsqueezy/lemonsqueezy.js";
lemonSqueezySetup({ apiKey: process.env.LEMONSQUEEZY_API_KEY });
const { data, error } = await createCheckout(storeId, variantId, {
  checkoutData: { email: "test@example.com" },
  checkoutOptions: { embed: true },
  testMode: true,
});
```

A real LS sandbox checkout call typically returns in well under a second.
If that's fast but the app's own `/api/billing/checkout` is slow, the
problem is local dev-server plumbing (see above), not your LS credentials.
