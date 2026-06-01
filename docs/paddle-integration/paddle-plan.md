# Plan — Migrate billing from HitPay → Paddle (with durable checkout via Vercel Workflow DevKit)

## Context

Gallurio bills tenants via **HitPay**, which only does merchant payouts in Southeast Asia and is **not a Merchant of Record (MoR)**. As Gallurio expands to UAE/global, that would force VAT/GST registration in every country (PH RA 12023: 12% VAT on digital services; UAE: 5% from the first B2C sale). **Paddle is an MoR** — it collects payments worldwide, remits taxes in 80–100+ jurisdictions, and wires net PHP payouts via SWIFT. Gallurio's tax exposure shrinks to the PHP tier it defines.

This task migrates subscription billing (Gallurio → tenant) from HitPay to Paddle, and wraps the browser→webhook activation gap in a **durable Vercel Workflow** so a cold start/deploy can't lose the correlation. Scope is **billing only** — the quote-negotiation booking lifecycle from the design doc is explicitly out of scope. We're pre-production (sandbox, no live subscribers), so HitPay is **removed cleanly**, not kept alongside.

**Goal: plug-and-play.** All code + tests land now (Paddle mocked in tests); env vars stay blank. Going live later is just: create Paddle dashboard objects → paste 6 keys → register the webhook.

Reference: approved design doc `docs/superpowers/specs/2026-06-01-paddle-workflow-integration-design.md`. **This plan corrects several Paddle API details the design doc got wrong** (see "Design-doc corrections" below) — follow this plan where they differ.

### Decisions (from user)
1. Scope = **Billing + durable checkout workflow** (no quote negotiation).
2. Checkout UX = **Paddle.js overlay/inline** (in-app, not redirect).
3. Deliverable = **full code scaffolding + tests + setup doc**, env stubbed.
4. HitPay = **clean replace now** (delete code, fields, sim, rename `Transaction.method`).
5. Base pricing = **₱250 Starter / ₱500 Pro** (PHP base; Paddle localizes per-country — see below).
6. Country support = **expand to the Gulf now** (Anglosphere AU/CA/NZ/GB/US are already supported; SEA stays). Add AE/SA/QA/KW/OM/BH.
7. Arabic (`ar`) + RTL = **deferred to its own task**, but documented. Prepare the country→locale plumbing safely (Gulf→`en` interim).

### Localized pricing — one price ID, not per-location IDs (user asked)
Paddle charges different amounts per country/currency from a **single price ID** via `unit_price_overrides` (per-country amount+currency) + optional automatic currency conversion. Selection order: country override → auto-conversion → base price. So env keeps exactly **two** price IDs (`PADDLE_PRICE_STARTER_ID`/`PADDLE_PRICE_PRO_ID`); per-market price points (e.g. ₱250 in PH, a tuned AED amount in UAE) are configured in the dashboard on those same prices. The setup doc covers adding overrides. ([Localize prices](https://developer.paddle.com/build/products/offer-localized-pricing/))

### Design-doc corrections (grounded in developer.paddle.com + Workflow DevKit bundled docs)
- **Webhook auth**: Paddle signs `"{ts}:{rawBody}"` (HMAC-SHA256, secret `pdl_ntfset_…`), header `Paddle-Signature: ts=…;h1=…`, 5s replay tolerance. Use `paddle.webhooks.unmarshal(rawBody, secret, signature)` — **not** a hand-rolled HMAC over the bare body. Read `req.text()` before verifying (route stays Node runtime, `dynamic = "force-dynamic"`).
- **No `PADDLE_API_BASE`**: `new Paddle(apiKey, { environment })` where `environment` derives from `NEXT_PUBLIC_PADDLE_ENV` (`sandbox`|`production`).
- **Pre-created Price IDs required** (no inline pricing for subscriptions) → `PADDLE_PRICE_STARTER_ID` / `PADDLE_PRICE_PRO_ID`.
- **Activation event**: grant on `subscription.activated`; the webhook ALSO directly + idempotently writes workspace state for `subscription.updated/canceled/past_due/paused` (renewals/cancels arrive with no in-flight workflow — same as HitPay does today).
- **Correlation**: `customData: { workspaceId }` passed at `Checkout.open` flows through to `event.data.customData.workspaceId`. Store `paddleCustomerId` once as the durable link.
- **Workflow package**: imports are `workflow`, `workflow/api`, `workflow/next`, `@workflow/vitest` (per the installed-version skill — confirm exact subpaths against `node_modules/workflow/docs/` at implementation).

---

## Environment variables (final)

| Variable | Source in Paddle dashboard | Example prefix |
|---|---|---|
| `PADDLE_API_KEY` | Developer tools → Authentication (server key) | `pdl_sdbx_…` / `pdl_live_…` |
| `PADDLE_WEBHOOK_SECRET` | Developer tools → Notifications (per-destination secret) | `pdl_ntfset_…` |
| `NEXT_PUBLIC_PADDLE_CLIENT_TOKEN` | Developer tools → Authentication (client token, browser-safe) | `test_…` / `live_…` |
| `NEXT_PUBLIC_PADDLE_ENV` | literal | `sandbox` / `production` |
| `PADDLE_PRICE_STARTER_ID` | Catalog → Products → Starter price | `pri_…` |
| `PADDLE_PRICE_PRO_ID` | Catalog → Products → Pro price | `pri_…` |

Remove: `HITPAY_API_KEY`, `HITPAY_WEBHOOK_SALT`, `HITPAY_API_BASE`, `HITPAY_SIM_URL`. Update `.env.example`.

---

## Packages & build config

```bash
pnpm add @paddle/paddle-node-sdk @paddle/paddle-js workflow
pnpm add -D @workflow/vitest
pnpm remove   # nothing to remove for hitpay (it was fetch-based, no dep)
```

- `next.config.ts`: wrap export with `withWorkflow(nextConfig)` from `workflow/next` (confirm subpath in bundled docs). Keep existing config object intact.
- New `vitest.integration.config.ts` using the `workflow()` plugin from `@workflow/vitest` (`include: ["**/*.integration.test.ts"]`, `testTimeout: 60_000`). Add a `test:integration` script to `package.json`. **Note**: `vi.mock()` does not work under the workflow plugin — integration tests use real step fns against in-memory Mongo.

---

## New code

### `lib/paddle/client.ts` (replaces `lib/hitpay/client.ts`)
Singleton `getPaddle()` → `new Paddle(env.PADDLE_API_KEY, { environment: NEXT_PUBLIC_PADDLE_ENV === "production" ? Environment.production : Environment.sandbox })`. Typed helpers:
- `ensurePaddleCustomer(email, name): Promise<string>` — reuse `Workspace.paddleCustomerId` if set, else `paddle.customers.create(...)` (catch "customer already exists" → list by email).
- `getSubscription(id)`, `cancelSubscription(id)` (`{ effectiveFrom: "next_billing_period" }`), `listActiveSubscriptionsForCustomer(customerId)` (for eager reconcile).

### `lib/paddle/plans.ts` (replaces `lib/hitpay/plans.ts`)
Keep `PLAN_CATALOG` shape/i18n keys/`entitlements` **identical** (so `plan-form.tsx` and entitlement logic are untouched). Add `priceId` per paid entry (read from env). `amount` (PHP) stays for **display only** — set Starter `250`, Pro `500`. (Real charge amount comes from Paddle's per-country overrides, not this number.)
- Replace `planForAmount(amount)` → **`planForPriceId(priceId): PlanTier`** (maps the two env price IDs → `starter`/`pro`, unknown → `free`). Keep `isPaidPlan`, `getPlanCatalog`.

### `lib/paddle/webhook.ts` (replaces `lib/hitpay/webhook.ts`)
- `verifyAndParsePaddleEvent(rawBody, signature)`: returns the unmarshalled event or `null`. Uses `getPaddle().webhooks.unmarshal(rawBody, PADDLE_WEBHOOK_SECRET, signature)`. Dev convenience: if `PADDLE_WEBHOOK_SECRET` unset and not production, `JSON.parse(rawBody)` unsigned (mirrors current HitPay dev bypass) and warn.
- Export the handled `EventName` set.

### `lib/workflows/subscriptionCheckout.ts` + `lib/workflows/steps/billing.ts`
- `subscriptionCheckoutWorkflow(workspaceId, plan)` — `"use workflow"`. `const hook = createHook<{subscriptionId; customerId; status; periodEnd; priceId}>({ token: \`paddle-checkout-${workspaceId}\` }); const event = await hook;` then `await updateWorkspacePlanStep(workspaceId, event)` and `await clearCheckoutRunStep(workspaceId)`.
- `steps/billing.ts` — `"use step"` fns doing the Mongo writes (full Node access). `updateWorkspacePlanStep` sets plan + paddle fields idempotently; `clearCheckoutRunStep` unsets `paddleCheckoutWorkflowRunId`.

### `app/api/billing/checkout/route.ts` (rewrite)
`POST { plan: "starter"|"pro", onboarding? }`:
1. `requireOrg({ allowDuringOnboarding: true })`, validate plan via `isPaidPlan` + `getPlanCatalog`.
2. Resolve customer email/name from Clerk (keep existing logic).
3. `customerId = await ensurePaddleCustomer(email, name)`; persist `paddleCustomerId`.
4. `const run = await start(subscriptionCheckoutWorkflow, [workspaceId, plan])`; save `paddleCheckoutWorkflowRunId = run.runId`, `paddleSubscriptionStatus = "trialing"`-ish? → leave status null until webhook.
5. Return `{ priceId, customerEmail }` (client reads `NEXT_PUBLIC_*` itself). No redirect URL — overlay handles UX.

### `app/api/webhooks/paddle/route.ts` (replaces `app/api/webhooks/hitpay/route.ts`)
- `runtime="nodejs"`, `dynamic="force-dynamic"`. `rawBody = await req.text()`; `event = verifyAndParsePaddleEvent(rawBody, req.headers.get("paddle-signature"))`; 401 if null/invalid.
- Switch on `event.eventType`:
  - `subscription.activated` → direct idempotent workspace write (plan from `planForPriceId(items[0].price.id)`, status `active`, `paddleSubscriptionId`, `paddleCurrentPeriodEnd = current_billing_period.ends_at`) **and** `resumeHook(\`paddle-checkout-${workspaceId}\`, {...})` if `customData.workspaceId` present.
  - `subscription.updated` → update status/plan/period end (handles renewals, upgrades).
  - `subscription.canceled` → plan `free`, clear subscription fields.
  - `subscription.past_due` / `subscription.paused` → set status only.
  - `transaction.completed` → informational; bump period end if available.
- **Port the team-cap downgrade guard** verbatim from the HitPay route (refuse paid→lower-paid swap when `currentTeamCount > newPlan.maxTeams`; cancellations bypass and always downgrade). Reuse `planEntitlements` from `lib/plans/entitlements`.
- Workspace lookup filter: `customData.workspaceId` → fallback `paddleSubscriptionId` → fallback `paddleCustomerId`. Always `{ _id/paddle*, }` scoped; never trust unscoped. Return `{ received: true }` for unhandled events (no Paddle retries).

---

## Modified code

- **`lib/db/models/Workspace.ts`** — remove the 4 `hitpay*` fields + `HITPAY_RECURRING_STATUSES`/`HitpayRecurringStatus`. Add: `paddleSubscriptionId` (String, indexed sparse), `paddleCustomerId` (String, indexed sparse), `paddleSubscriptionStatus` (enum `["active","canceled","past_due","paused","trialing"]` + null), `paddleCurrentPeriodEnd` (Date), `paddleCheckoutWorkflowRunId` (String). Export `PADDLE_SUBSCRIPTION_STATUSES` / `PaddleSubscriptionStatus`. `plan` field unchanged.
- **`lib/db/models/index.ts`** — swap the re-exported status const/type names.
- **`lib/db/models/Transaction.ts`** — `method` enum `["hitpay",…]` → `["paddle","cash","transfer","other"]`; `hitpayPaymentId`→`paddlePaymentId`, `hitpayRecurringBillingId`→`paddleSubscriptionId`.
- **`lib/validators/workspace.ts`** — (1) rename `HITPAY_COUNTRY_VALUES`/`HitpayCountry` → provider-neutral `BILLING_COUNTRY_VALUES`/`SupportedCountry`, neutralize the error message ("Pick a country where HitPay operates" → "Pick a supported country"). (2) **Add the Gulf** to the country list: `AE, SA, QA, KW, OM, BH` (Anglosphere AU/CA/NZ/GB/US + SEA already present). (3) **Add the Gulf currencies** to `SUPPORTED_CURRENCIES`: `AED, SAR, QAR, KWD, OMR, BHD`. (4) Extend `COUNTRY_TO_CURRENCY` (AE→AED, SA→SAR, QA→QAR, KW→KWD, OM→OMR, BH→BHD). Update every importer of the renamed const: `lib/db/models/Workspace.ts` (currency enum), `lib/validators/booking.ts`, `lib/validators/workspace.test.ts`, the two country selectors below.
- **Country selector UIs** — add Gulf entries to `COUNTRY_LABELS` and switch the renamed const import in both `app/[locale]/(onboarding)/onboarding/business/business-form.tsx` and `app/[locale]/(app)/settings/workspace/_business-form.tsx` (options + currency-autofill are already derived from the const + `COUNTRY_TO_CURRENCY`, so no structural change).
- **`lib/i18n/localeForCountry.ts`** — add Gulf cases returning **`"en"` for now** (interim — Arabic chrome ships with the deferred RTL task). Leave a comment pointing to `docs/deferred-scope/arabic-rtl.md` with the exact one-line flip (`case "AE": case "SA": … return "ar"`). **Do NOT** add `"ar"` to `lib/i18n/routing.ts` yet — without `messages/ar.json` it would break locale resolution. Gulf currencies KWD/BHD/OMR are 3-decimal; `formatMoney` already passes the currency through to `Intl.NumberFormat` so no formatter change is needed (note `maximumFractionDigits: 0` rounds display — acceptable for whole-amount UI).
- **`lib/actions/onboarding.ts`** — `selectFreePlanAction` clears paddle fields instead of hitpay. Rename/rewrite the done-page reconcile helper → `reconcilePaddleSubscription(workspaceId)` using `listActiveSubscriptionsForCustomer`.
- **`app/[locale]/(onboarding)/onboarding/plan/plan-form.tsx`** — paid plan: `POST /api/billing/checkout` → `initializePaddle({ token, environment })` → `paddle.Checkout.open({ items:[{priceId,quantity:1}], customer:{email}, customData:{workspaceId} })`; on `checkout.completed` event → `router.push("/onboarding/done")`. Keep the dev escape hatch (`devActivatePlanAction`). Ensure four states (idle/loading/error/disabled) on the upgrade buttons.
- **`app/[locale]/(onboarding)/onboarding/done/page.tsx`** — call `reconcilePaddleSubscription`; rename `ref` param handling.
- **`app/[locale]/(app)/settings/_actions.ts`** — `deleteWorkspaceAction`: best-effort `cancelSubscription(paddleSubscriptionId)` when `paddleSubscriptionStatus === "active"`.
- **Settings billing surface** (the `/settings/billing?checkout=success` page the audit found) — wire the same overlay-based upgrade + a "Manage subscription" affordance; mirror plan-form logic. Verify at 375px.
- **`app/[locale]/(app)/settings/dev-plan/_panel.tsx`** — import `PLAN_CATALOG` from `lib/paddle/plans`.
- **`lib/actions/dev.ts`** — `devActivatePlanAction` sets paddle fields (status `active`, period end +30d) / clears on free; keep the team-cap guard mirror.
- **`scripts/hitpay-sim.ts` → `scripts/paddle-sim.ts`** — build a Paddle event payload (`subscription.activated` / `subscription.updated` / `subscription.canceled` / `transaction.completed`), sign `"{ts}:{body}"` HMAC-SHA256 with `PADDLE_WEBHOOK_SECRET`, set `Paddle-Signature: ts=…;h1=…`, POST to `http://localhost:3000/api/webhooks/paddle`. Rename `package.json` script → `paddle:sim`.
- **`.env.example`**, **`CLAUDE.md`** (Billing section), **`docs/teams/phase-2-team-model-and-settings.md`** (guard reference) — update HitPay → Paddle wording.

---

## New documentation (the "plug-and-play" deliverable)

### `docs/paddle-setup.md`
Step-by-step, in order:
1. **Create Paddle account** → verify → switch to **Sandbox**.
2. **Catalog → Products**: create "Gallurio Starter" and "Gallurio Pro" products; under each add a **recurring monthly Price with PHP base** (₱250 / ₱500). Copy the two `pri_…` IDs → `PADDLE_PRICE_STARTER_ID` / `PADDLE_PRICE_PRO_ID`.
2a. **Localized pricing (optional per market)**: on each price, add **unit price overrides** for target countries (e.g. an AED amount for AE) and/or enable **automatic currency conversion**. One price ID serves all markets — no extra env vars. Paddle applies: country override → auto-conversion → PHP base.
3. **Developer tools → Authentication**: copy the **server API key** (`PADDLE_API_KEY`) and **client-side token** (`NEXT_PUBLIC_PADDLE_CLIENT_TOKEN`).
4. **Checkout → Checkout settings → Default payment link**: set to your dev tunnel/localhost (required for the overlay to open).
5. **Developer tools → Notifications** (or **Simulations** for sandbox testing): create a `url` destination → your tunnel `…/api/webhooks/paddle`, subscribe to `subscription.*` + `transaction.completed`, usage type `all`. Copy the `pdl_ntfset_…` secret → `PADDLE_WEBHOOK_SECRET`.
6. Set `NEXT_PUBLIC_PADDLE_ENV=sandbox`. Paste all 6 vars into `.env.local`.
7. Local testing: tunnel via cloudflared/hookdeck; use the dashboard **webhook simulator** or `pnpm paddle:sim <kind> <workspaceId>`; sandbox **test card** `4242 4242 4242 4242`.
8. Production cutover: swap to live keys/env, recreate products/prices/destination in the live account, confirm PHP payout bank account linked, run one real-card Starter checkout.

### `docs/deferred-scope/` — separate-scope documentation (user requested)
A folder of short, self-contained docs so future sessions can pick each up cleanly. Each states: what it is, why it's deferred, what to build, and the files/APIs involved.
- **`quote-negotiation.md`** — summarize the 3-stage durable booking flow from `docs/booking-inquiry-lifecycle.md`: Stage 1 draft booking (exists), Stage 2 owner "Send Quote" → `quoteNegotiationWorkflow` (`lib/workflows/`), Stage 3 client response. Booking model additions (`quotes[]`, `currentQuoteRound`, `activeQuoteHookToken`), status values, and the server actions/routes to add. Notes it reuses the same Workflow DevKit we install here.
- **`client-portal.md`** — **explain what it is** (it was unclear to you): a **branded, no-login page** at `/w/[orgSlug]/quote/[bookingId]?token=…` where the **end client** (the tenant's customer — not the tenant) views a quote and either confirms or counters. Auth is a deterministic hook token validated against `Booking.activeQuoteHookToken`; no Clerk session. Covers page content, the confirm/counter API routes, and the "no longer active" state.
- **`booking-hook-tokens.md`** — the Workflow DevKit `createHook`/`resumeHook` token scheme for the booking flow (`booking-client-{id}-r{round}`, `booking-owner-{id}-r{round}`), why deterministic tokens survive cold starts, and how the portal validates them.
- **`resend-email.md`** — transactional email via Resend for the booking flow (templates: `inquiry-new`, `booking-quote`, `booking-confirmed-*`, `booking-countered-owner`, `booking-requote`, `booking-declined`). Env + sender domain setup; deferred until the quote flow is built.
- **`marketplace-paddle-connect.md`** — **answers your question: NOT needed.** Paddle Connect / marketplace is only for *splitting payments to / paying out third parties* (i.e. tenants' clients paying tenants through Gallurio). Gallurio only does **Gallurio→tenant monthly subscriptions**, which standard Paddle Billing covers fully. Tenants collect from their own clients **outside the app** (bank/GCash/cash). Revisit only if in-app marketplace payments ever enter scope.
- **`arabic-rtl.md`** — the deferred Arabic locale + RTL task. Exact steps: add `"ar"` to `routing.locales`, create `messages/ar.json`, set `dir={locale === "ar" ? "rtl" : "ltr"}` on `<html>` in `app/[locale]/layout.tsx`, flip the Gulf cases in `localeForCountry` from `"en"` → `"ar"`, audit components for logical CSS / mirroring. Records *why* it was split out of the billing PR (RTL is cross-cutting UI).

### `docs/RELEASE-CHECKLIST.md` additions
- [ ] Live Paddle keys (`PADDLE_API_KEY`, `PADDLE_WEBHOOK_SECRET`, `NEXT_PUBLIC_PADDLE_CLIENT_TOKEN`, `NEXT_PUBLIC_PADDLE_ENV=production`).
- [ ] Production Price IDs set (`PADDLE_PRICE_STARTER_ID`/`PADDLE_PRICE_PRO_ID`).
- [ ] Production webhook destination registered at `https://[domain]/api/webhooks/paddle`.
- [ ] PHP payout bank account linked in Paddle.
- [ ] Live Starter checkout with real card → plan upgrades, webhook fires, workflow run completes.
- [ ] Confirm Paddle MoR covers PH (RA 12023) and UAE VAT before marketing there.
- [ ] Configure live per-country price overrides (e.g. AED for AE) on the production prices if PPP pricing is desired.
- [ ] Arabic/RTL locale shipped (tracked in `docs/deferred-scope/arabic-rtl.md`) before marketing in Arabic-primary markets.

---

## Tests (Paddle + Workflow mocked/in-memory; never mock Mongoose)

- `lib/paddle/webhook.test.ts` — valid sig passes (compute `"{ts}:{body}"` HMAC with a test secret), tampered body rejected, missing header rejected, expired ts rejected.
- `lib/paddle/plans.test.ts` — `planForPriceId` maps the two env IDs → tiers; unknown → `free`.
- `app/api/webhooks/paddle/route.test.ts` — activation upgrades plan; cancellation downgrades to free; **team-cap guard** refuses paid→lower-paid when over cap; **tenant isolation** (workspace A's event can't touch workspace B). Mock the SDK `unmarshal` to return crafted events; real in-memory Mongo for writes.
- `lib/workflows/subscriptionCheckout.integration.test.ts` — `@workflow/vitest`: `start(subscriptionCheckoutWorkflow,[wsId,"starter"])` → `waitForHook(run,{token})` → `resumeHook(token,{...})` → assert `Workspace.plan==="starter"` + `paddleCheckoutWorkflowRunId` cleared.
- `lib/validators/workspace.test.ts` — extend: each Gulf country resolves to its currency via `COUNTRY_TO_CURRENCY`; `country`/`currency` enums accept the new values and reject junk.
- `lib/i18n/localeForCountry.test.ts` — Gulf countries currently map to `"en"` (guards the interim behavior; the Arabic task will update this test alongside the flip).
- Update existing: `settings/_actions.test.ts` (mock `cancelSubscription`), `lib/db/queries/publicPage.test.ts` (seed paddle fields, assert excluded from public doc), `dashboard-metrics.test.ts` + `transactions-by-method-bar.test.ts` (`"hitpay"`→`"paddle"`, label "HitPay"→"Paddle"). Any test importing `HITPAY_COUNTRY_VALUES` updates to the renamed const.

---

## Locales
`plan-form` keeps existing `plans.*` keys (unchanged). Add new strings (overlay loading/error, "Manage subscription", billing status) to **all five** catalogs `messages/{en,fil,ms,id,th}.json`. ICU for any plural/gender.

---

## Build sequence
1. Packages + `next.config.ts` wrap + `vitest.integration.config.ts`.
2. Workspace/Transaction/validators model changes (incl. country/currency rename + Gulf expansion) + `localeForCountry` Gulf cases + index.ts exports (+ `pnpm typecheck` to surface every consumer of the renamed const).
3. `lib/paddle/{client,plans,webhook}.ts` + unit tests.
4. `lib/workflows/*` + integration test.
5. Checkout route + Paddle webhook route + route test.
6. UI wiring: plan-form overlay, settings billing, dev panel, onboarding done reconcile, dev/onboarding actions.
7. `scripts/paddle-sim.ts`, `.env.example`, docs (`paddle-setup.md`, `docs/deferred-scope/*`, RELEASE-CHECKLIST, CLAUDE.md), locales.
8. Delete all `lib/hitpay/*`, hitpay route/test, old sim. Final `pnpm typecheck && pnpm lint && pnpm test`.

## Verification
- `pnpm typecheck` clean (catches every renamed field/import).
- `pnpm test` (unit) + `pnpm test:integration` (workflow) green.
- Manual sandbox once keys exist: onboarding → pick Starter → overlay opens → pay test card → `checkout.completed` → land on done page showing Starter → confirm webhook upgraded workspace + workflow run completed (`npx workflow inspect runs`). Then `pnpm paddle:sim subscription-canceled <workspaceId>` → workspace drops to free.
- 375px check: plan-form + settings billing upgrade flows.

## Out of scope (document only, in `docs/deferred-scope/`, do not build)
Quote-negotiation workflow, client portal, booking hook tokens, Resend emails, marketplace/Paddle Connect (not needed), Arabic `ar` catalog + RTL layout, deposit collection. *(Country/currency expansion to the Gulf IS in scope and built now.)*
