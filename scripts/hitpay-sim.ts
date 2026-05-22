/**
 * HitPay webhook simulator.
 *
 * HitPay doesn't ship a Stripe-CLI-style replayer. This script POSTs a signed
 * event to the local webhook handler so we can iterate without round-tripping
 * the sandbox dashboard.
 *
 * Usage:
 *   pnpm hitpay:sim subscription-active <recurring_billing_id> [amount]
 *   pnpm hitpay:sim subscription-cancelled <recurring_billing_id>
 *   pnpm hitpay:sim charge <recurring_billing_id>
 *
 * Targets http://localhost:3000/api/webhooks/hitpay by default — override with
 * HITPAY_SIM_URL.
 */
import { createHmac } from "node:crypto";
import { config as loadEnv } from "dotenv";
loadEnv({ path: ".env.local" });
loadEnv();

const TARGET = process.env.HITPAY_SIM_URL ?? "http://localhost:3000/api/webhooks/hitpay";
const SALT = process.env.HITPAY_WEBHOOK_SALT ?? "";

type Payload = { type: string; data: Record<string, unknown> };

function build(args: string[]): Payload {
  const [kind, id, amountArg] = args;
  if (!kind) throw new Error("Pass a kind: subscription-active|subscription-cancelled|charge");
  if (!id) throw new Error("Pass a recurring_billing_id");

  const nextBillingAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();

  if (kind === "subscription-active") {
    return {
      type: "recurring_billing.subscription_updated",
      data: {
        id,
        status: "active",
        amount: amountArg ? Number(amountArg) : 499,
        currency: "PHP",
        next_billing_at: nextBillingAt,
      },
    };
  }
  if (kind === "subscription-cancelled") {
    return {
      type: "recurring_billing.subscription_updated",
      data: { id, status: "cancelled" },
    };
  }
  if (kind === "charge") {
    return {
      type: "charge.created",
      data: {
        id: `chg_${Date.now()}`,
        recurring_billing_id: id,
        amount: amountArg ? Number(amountArg) : 499,
        currency: "PHP",
        status: "succeeded",
        next_billing_at: nextBillingAt,
      },
    };
  }
  throw new Error(`Unknown kind: ${kind}`);
}

async function main() {
  const args = process.argv.slice(2);
  const payload = build(args);
  const body = JSON.stringify(payload);
  const signature = SALT ? createHmac("sha256", SALT).update(body).digest("hex") : "";

  console.log(`→ POST ${TARGET}`);
  console.log(`  event: ${payload.type}`);
  if (!SALT) {
    console.warn("  HITPAY_WEBHOOK_SALT unset — sending unsigned (dev only).");
  }

  const res = await fetch(TARGET, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(signature ? { "Hitpay-Signature": signature } : {}),
    },
    body,
  });

  const text = await res.text();
  console.log(`← ${res.status} ${res.statusText}`);
  console.log(text);
  process.exit(res.ok ? 0 : 1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
