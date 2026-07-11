/**
 * Lemon Squeezy webhook simulator.
 *
 * Lemon Squeezy has no Stripe-CLI-style replayer. This script builds a Lemon
 * Squeezy event payload and POSTs it to the local webhook handler with a
 * valid X-Signature header so we can iterate without round-tripping the
 * sandbox dashboard.
 *
 * Usage:
 *   pnpm lemonsqueezy:sim subscription-created <workspaceId> [variantId]
 *   pnpm lemonsqueezy:sim subscription-updated <workspaceId> [variantId]
 *   pnpm lemonsqueezy:sim subscription-cancelled <workspaceId>
 *   pnpm lemonsqueezy:sim subscription-expired <workspaceId>
 *   pnpm lemonsqueezy:sim subscription-payment-success <workspaceId>
 *
 * Targets http://localhost:3000/api/webhooks/lemonsqueezy by default —
 * override with LEMONSQUEEZY_SIM_URL.
 *
 * Signing: X-Signature header is HMAC-SHA256 hex digest of the raw body using
 * LEMONSQUEEZY_WEBHOOK_SECRET. If the secret is unset the script sends
 * unsigned — the dev webhook accepts unsigned events when
 * LEMONSQUEEZY_WEBHOOK_SECRET is empty (non-production only).
 */
import { createHmac, randomBytes } from "node:crypto";
import { config as loadEnv } from "dotenv";

loadEnv({ path: ".env.local" });
loadEnv();

const TARGET =
  process.env.LEMONSQUEEZY_SIM_URL ?? "http://localhost:3000/api/webhooks/lemonsqueezy";
const SECRET = process.env.LEMONSQUEEZY_WEBHOOK_SECRET ?? "";

const USAGE = `
Usage:
  pnpm lemonsqueezy:sim subscription-created         <workspaceId> [variantId]
  pnpm lemonsqueezy:sim subscription-updated         <workspaceId> [variantId]
  pnpm lemonsqueezy:sim subscription-cancelled       <workspaceId>
  pnpm lemonsqueezy:sim subscription-expired         <workspaceId>
  pnpm lemonsqueezy:sim subscription-payment-success <workspaceId>
`.trim();

type LemonSqueezyEvent = {
  meta: {
    event_name: string;
    custom_data: Record<string, unknown> | null;
    test_mode: boolean;
  };
  data: {
    id: string;
    attributes: Record<string, unknown>;
  };
};

function simId(prefix: string): string {
  return `${prefix}_sim_${randomBytes(6).toString("hex")}`;
}

function buildEvent(args: string[]): LemonSqueezyEvent {
  const [kind, workspaceId, variantIdArg] = args;

  if (!kind || !workspaceId) {
    console.error(USAGE);
    process.exit(1);
  }

  const now = new Date();
  const renewsAt = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000).toISOString();

  const variantId =
    variantIdArg ?? process.env.LEMONSQUEEZY_VARIANT_PRO_MONTHLY_ID ?? "1001";

  const baseAttributes = {
    status: "active",
    customer_id: 555,
    variant_id: Number(variantId),
    renews_at: renewsAt,
    user_email: "sim@example.com",
  };

  if (kind === "subscription-created") {
    return {
      meta: { event_name: "subscription_created", custom_data: { workspaceId }, test_mode: true },
      data: { id: simId("sub"), attributes: baseAttributes },
    };
  }

  if (kind === "subscription-updated") {
    return {
      meta: { event_name: "subscription_updated", custom_data: { workspaceId }, test_mode: true },
      data: { id: simId("sub"), attributes: baseAttributes },
    };
  }

  if (kind === "subscription-cancelled") {
    return {
      meta: {
        event_name: "subscription_cancelled",
        custom_data: { workspaceId },
        test_mode: true,
      },
      data: {
        id: simId("sub"),
        attributes: {
          status: "cancelled",
          customer_id: 555,
          ends_at: renewsAt,
        },
      },
    };
  }

  if (kind === "subscription-expired") {
    return {
      meta: {
        event_name: "subscription_expired",
        custom_data: { workspaceId },
        test_mode: true,
      },
      data: {
        id: simId("sub"),
        attributes: { status: "expired", customer_id: 555 },
      },
    };
  }

  if (kind === "subscription-payment-success") {
    return {
      meta: {
        event_name: "subscription_payment_success",
        custom_data: { workspaceId },
        test_mode: true,
      },
      data: {
        id: simId("sub"),
        attributes: { renews_at: renewsAt },
      },
    };
  }

  console.error(`Unknown kind: ${kind}\n\n${USAGE}`);
  process.exit(1);
}

function sign(body: string): string {
  if (!SECRET) return "";
  return createHmac("sha256", SECRET).update(body).digest("hex");
}

async function main() {
  const args = process.argv.slice(2);

  if (args.length === 0) {
    console.error(USAGE);
    process.exit(1);
  }

  const event = buildEvent(args);
  const body = JSON.stringify(event);
  const signature = sign(body);

  console.log(`-> POST ${TARGET}`);
  console.log(`   event_name: ${event.meta.event_name}`);
  if (!SECRET) {
    console.warn(
      "   LEMONSQUEEZY_WEBHOOK_SECRET unset — sending unsigned (dev only)."
    );
  }

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };
  if (signature) {
    headers["X-Signature"] = signature;
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
