/**
 * Paddle webhook simulator.
 *
 * Paddle has no Stripe-CLI-style replayer. This script builds a Paddle event
 * payload and POSTs it to the local webhook handler with a valid
 * Paddle-Signature header so we can iterate without round-tripping the
 * sandbox dashboard.
 *
 * Usage:
 *   pnpm paddle:sim subscription-active <workspaceId> [priceId]
 *   pnpm paddle:sim subscription-updated <workspaceId> [priceId]
 *   pnpm paddle:sim subscription-canceled <workspaceId>
 *   pnpm paddle:sim transaction-completed <workspaceId>
 *
 * Targets http://localhost:3000/api/webhooks/paddle by default — override with
 * PADDLE_SIM_URL.
 *
 * Signing: Paddle-Signature header is `ts=<unixSeconds>;h1=<hmac>` where hmac
 * = HMAC-SHA256 of `"${ts}:${body}"` using PADDLE_WEBHOOK_SECRET. If the
 * secret is unset the script sends unsigned — the dev webhook accepts unsigned
 * events when PADDLE_WEBHOOK_SECRET is empty (non-production only).
 */
import { createHmac, randomBytes } from "node:crypto";
import { config as loadEnv } from "dotenv";

loadEnv({ path: ".env.local" });
loadEnv();

const TARGET =
  process.env.PADDLE_SIM_URL ?? "http://localhost:3000/api/webhooks/paddle";
const SECRET = process.env.PADDLE_WEBHOOK_SECRET ?? "";

const USAGE = `
Usage:
  pnpm paddle:sim subscription-active   <workspaceId> [priceId]
  pnpm paddle:sim subscription-updated  <workspaceId> [priceId]
  pnpm paddle:sim subscription-canceled <workspaceId>
  pnpm paddle:sim transaction-completed <workspaceId>
`.trim();

type PaddleEvent = {
  event_type: string;
  data: Record<string, unknown>;
};

function simId(prefix: string): string {
  return `${prefix}_sim_${randomBytes(6).toString("hex")}`;
}

function buildEvent(args: string[]): PaddleEvent {
  const [kind, workspaceId, priceIdArg] = args;

  if (!kind || !workspaceId) {
    console.error(USAGE);
    process.exit(1);
  }

  const now = new Date();
  const periodStart = now.toISOString();
  const periodEnd = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000).toISOString();
  const nextBilledAt = periodEnd;

  const priceId =
    priceIdArg ??
    process.env.PADDLE_PRICE_STARTER_ID ??
    "pri_sim_starter";

  const baseSubscription = {
    id: simId("sub"),
    customer_id: simId("ctm"),
    items: [
      {
        price: { id: priceId },
        quantity: 1,
      },
    ],
    current_billing_period: {
      starts_at: periodStart,
      ends_at: periodEnd,
    },
    next_billed_at: nextBilledAt,
    custom_data: { workspaceId },
  };

  if (kind === "subscription-active") {
    return {
      event_type: "subscription.activated",
      data: {
        ...baseSubscription,
        status: "active",
      },
    };
  }

  if (kind === "subscription-updated") {
    return {
      event_type: "subscription.updated",
      data: {
        ...baseSubscription,
        status: "active",
      },
    };
  }

  if (kind === "subscription-canceled") {
    return {
      event_type: "subscription.canceled",
      data: {
        id: simId("sub"),
        customer_id: simId("ctm"),
        status: "canceled",
        custom_data: { workspaceId },
      },
    };
  }

  if (kind === "transaction-completed") {
    return {
      event_type: "transaction.completed",
      data: {
        id: simId("txn"),
        customer_id: simId("ctm"),
        status: "completed",
        custom_data: { workspaceId },
        details: {
          totals: { grand_total: "25000", currency_code: "PHP" },
        },
      },
    };
  }

  console.error(`Unknown kind: ${kind}\n\n${USAGE}`);
  process.exit(1);
}

function sign(ts: number, body: string): string {
  if (!SECRET) return "";
  const payload = `${ts}:${body}`;
  return createHmac("sha256", SECRET).update(payload).digest("hex");
}

async function main() {
  const args = process.argv.slice(2);

  if (args.length === 0) {
    console.error(USAGE);
    process.exit(1);
  }

  const event = buildEvent(args);
  const body = JSON.stringify(event);
  const ts = Math.floor(Date.now() / 1000);
  const hmac = sign(ts, body);
  const signatureHeader = hmac ? `ts=${ts};h1=${hmac}` : "";

  console.log(`-> POST ${TARGET}`);
  console.log(`   event_type: ${event.event_type}`);
  if (!SECRET) {
    console.warn(
      "   PADDLE_WEBHOOK_SECRET unset — sending unsigned (dev only)."
    );
  }

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };
  if (signatureHeader) {
    headers["Paddle-Signature"] = signatureHeader;
  }

  const res = await fetch(TARGET, {
    method: "POST",
    headers,
    body,
  });

  const text = await res.text();
  console.log(`<- ${res.status} ${res.statusText}`);
  console.log(text);

  process.exit(res.ok ? 0 : 1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
