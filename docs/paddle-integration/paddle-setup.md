# Paddle Dashboard Setup — Plug-and-Play Guide

Follow these steps in order. By the end you will have all six env vars and a working sandbox checkout. Code is already committed — only dashboard config and `.env.local` are needed.

---

## Environment variables reference

| Variable | Where in dashboard | Example prefix |
|---|---|---|
| `PADDLE_API_KEY` | Developer tools → Authentication → Server-side API key | `pdl_sdbx_…` / `pdl_live_…` |
| `PADDLE_WEBHOOK_SECRET` | Developer tools → Notifications → per-destination secret | `pdl_ntfset_…` |
| `NEXT_PUBLIC_PADDLE_CLIENT_TOKEN` | Developer tools → Authentication → Client-side token | `test_…` / `live_…` |
| `NEXT_PUBLIC_PADDLE_ENV` | literal — set to `sandbox` or `production` | `sandbox` |
| `PADDLE_PRICE_STARTER_ID` | Catalog → Products → Gallurio Starter → price row | `pri_…` |
| `PADDLE_PRICE_PRO_ID` | Catalog → Products → Gallurio Pro → price row | `pri_…` |

---

## Step 1 — Create a Paddle account and switch to Sandbox

1. Go to [paddle.com](https://paddle.com) → **Get started** → fill in the form.
2. Verify your email.
3. In the dashboard header, click the environment toggle and select **Sandbox**. All subsequent steps are done in Sandbox mode. The live account is a separate environment you configure at production cutover (Step 8).

---

## Step 2 — Create products and prices

Paddle requires pre-created Price IDs for subscription billing — Gallurio can't pass inline pricing like HitPay allowed.

### Gallurio Starter

1. **Catalog → Products → + New product**
   - Name: `Gallurio Starter`
   - Tax category: `Software as a Service (SaaS)`
   - Save.
2. On the product page → **+ New price**
   - Billing period: **Monthly**
   - Base currency: **PHP** (Philippine Peso)
   - Amount: `250.00`
   - Trial: none
   - Save.
3. Copy the `pri_…` ID that appears on the price row → this is `PADDLE_PRICE_STARTER_ID`.

### Gallurio Pro

Repeat the same steps:
- Name: `Gallurio Pro`, amount `500.00 PHP`.
- Copy `pri_…` → `PADDLE_PRICE_PRO_ID`.

### Localized pricing (optional — recommended before Gulf launch)

One price ID serves all markets. Paddle applies the first matching rule: country override → automatic currency conversion → PHP base.

To add a country-specific amount (e.g. AED for UAE):

1. Open the price row → **Edit price** → **Price overrides** → **+ Add override**.
2. Select country (e.g. `United Arab Emirates`), set currency `AED` and amount (e.g. `35.00`).
3. Repeat for SA/QA/KW/OM/BH as needed.
4. To enable automatic conversion for countries without an override: **Catalog → Price settings → Automatically convert prices** → toggle on. Paddle converts from PHP using live exchange rates.

No new env vars — the same `pri_…` ID handles all markets.

---

## Step 3 — Copy authentication keys

1. **Developer tools → Authentication**
2. **API keys → New API key.** Paddle keys are scoped, and permissions **cannot be edited after creation** — so grant the right permissions now (or create a new key). The subscription-checkout flow needs **write** access to customers, subscriptions, and transactions:
   - `customer.write` ← without this you get `403 forbidden: not authorized to create customer`
   - `subscription.read` + `subscription.write`
   - `transaction.read` + `transaction.write`
   - `price.read`, `product.read`
   - For sandbox/dev, granting **full access** is fine.
   Copy the **Server-side API key** → `PADDLE_API_KEY` (starts `pdl_sdbx_` in sandbox). It's shown only once.
3. Copy the **Client-side token** → `NEXT_PUBLIC_PADDLE_CLIENT_TOKEN` (starts `test_` in sandbox).

> After changing `PADDLE_API_KEY`, **restart the dev server** — env vars don't hot-reload.

---

## Step 4 — Set the default payment link (required for overlay checkout)

Paddle's JavaScript overlay only opens when the current domain matches the allowed list.

1. **Checkout → Checkout settings → Default payment link**
2. Set to your dev tunnel URL (e.g. `https://abcd.cfargotunnel.com`) **or** `http://localhost:3000` for simple local testing without a tunnel.
3. Save.

Without this step the overlay will silently fail to open.

---

## Step 5 — Create a webhook notification destination

1. **Developer tools → Notifications → + New destination**
2. **Type**: URL
3. **URL**: `<your tunnel>/api/webhooks/paddle` (e.g. `https://abcd.cfargotunnel.com/api/webhooks/paddle`)
4. **Subscribed events**: check `subscription.*` (all sub-events) and `transaction.completed`. Usage type: **All**.
5. Save.
6. Copy the **destination secret** (`pdl_ntfset_…`) → `PADDLE_WEBHOOK_SECRET`.

**Sandbox testing without a tunnel:** use the dashboard's **Simulations** tab (Developer tools → Simulations) to fire test events directly at your registered URL. Alternatively, `pnpm paddle:sim <kind> <workspaceId>` fires a signed event at `http://localhost:3000/api/webhooks/paddle` without needing a registered destination — see Step 7.

**Webhook authentication note:** the route uses `paddle.webhooks.unmarshal(rawBody, PADDLE_WEBHOOK_SECRET, signature)` where `signature` is the `Paddle-Signature` header (`ts=…;h1=…`). The HMAC covers `"${ts}:${rawBody}"`. Replay protection: events older than 5 seconds are rejected. The route is Node runtime (never Edge).

---

## Step 6 — Populate `.env.local`

```env
PADDLE_API_KEY=pdl_sdbx_...
PADDLE_WEBHOOK_SECRET=pdl_ntfset_...
NEXT_PUBLIC_PADDLE_CLIENT_TOKEN=test_...
NEXT_PUBLIC_PADDLE_ENV=sandbox
PADDLE_PRICE_STARTER_ID=pri_...
PADDLE_PRICE_PRO_ID=pri_...
```

Restart the dev server. The billing UI will now use real Paddle sandbox pricing.

---

## Step 7 — Local testing

### Tunnel setup

The Paddle.js overlay and webhooks both require a publicly routable URL in sandbox:

```bash
cloudflared tunnel --url http://localhost:3000
```

Register the resulting `https://…cfargotunnel.com` URL in Step 4 (checkout settings) and Step 5 (webhook destination). `cloudflared` is already listed in `next.config.ts`'s `allowedDevOrigins`.

### Webhook simulator

Paddle has no Stripe-CLI-style replayer. The sim script fires a signed event directly at the local handler:

```bash
# Trigger subscription.activated (simulates Paddle calling back after checkout)
pnpm paddle:sim subscription-active <workspaceId>

# Trigger with specific price ID
pnpm paddle:sim subscription-active <workspaceId> pri_your_starter_id

# Trigger subscription.updated
pnpm paddle:sim subscription-updated <workspaceId>

# Trigger subscription.canceled
pnpm paddle:sim subscription-canceled <workspaceId>

# Trigger transaction.completed
pnpm paddle:sim transaction-completed <workspaceId>
```

The script reads `PADDLE_WEBHOOK_SECRET` from `.env.local` and sends the correct `Paddle-Signature: ts=…;h1=…` header. If the secret is unset, it sends unsigned — the dev webhook accepts unsigned events when `PADDLE_WEBHOOK_SECRET` is empty (non-production only).

Override the target URL:
```env
PADDLE_SIM_URL=https://your-tunnel.cfargotunnel.com/api/webhooks/paddle
```

### Sandbox test card

Use `4242 4242 4242 4242` with any future expiry and any 3-digit CVC in the Paddle checkout overlay.

### Full flow verification

1. Start dev server + tunnel.
2. Sign up a new workspace → go to onboarding → select Starter plan.
3. Paddle overlay opens → pay test card → overlay fires `checkout.completed` event → app redirects to `/onboarding/done`.
4. The durable `subscriptionCheckoutWorkflow` is waiting for `resumeHook`. The `subscription.activated` webhook arrives (from sandbox) and calls `resumeHook` → workflow step writes `plan: "starter"` to the workspace.
5. The done page calls `reconcilePaddleSubscription` as a fallback — workspace shows Starter.
6. Run `pnpm paddle:sim subscription-canceled <workspaceId>` → workspace drops to free.
7. Inspect workflow runs: `npx workflow inspect runs` (requires the workflow dev server).

---

## Step 8 — Production cutover

1. Switch to **Live** mode in the Paddle dashboard header.
2. Repeat Steps 2–5 in the Live environment:
   - Create Gallurio Starter and Pro products/prices with the same PHP amounts.
   - Copy the new Live API key and client token.
   - Create a webhook destination pointing at `https://[your-domain]/api/webhooks/paddle`.
   - Copy the new destination secret.
3. Add per-country price overrides on the live prices if PPP pricing is desired (AED for AE, etc.).
4. **Link a PHP payout bank account**: Settings → Payouts → + Add payout method → wire transfer → provide Philippine bank account details. Paddle will wire net proceeds in PHP.
5. Confirm Paddle's Merchant of Record coverage includes PH (RA 12023 / 12% VAT) and UAE (5% VAT) — Paddle handles these automatically as MoR.
6. Update `.env.local` / Vercel project env vars to the Live values and set `NEXT_PUBLIC_PADDLE_ENV=production`.
7. Run one real-card Starter checkout to confirm: plan upgrades → `subscription.activated` webhook fires → workflow run completes → `/onboarding/done` shows Starter plan.
