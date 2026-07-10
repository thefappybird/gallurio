import {
  lemonSqueezySetup,
  createCheckout,
  getSubscription,
  cancelSubscription,
  updateSubscription,
  listSubscriptions,
} from "@lemonsqueezy/lemonsqueezy.js";

let configured = false;

function ensureConfigured(): void {
  if (configured) return;
  const apiKey = process.env.LEMONSQUEEZY_API_KEY;
  if (!apiKey) {
    throw new Error("Missing env var LEMONSQUEEZY_API_KEY");
  }
  lemonSqueezySetup({
    apiKey,
    onError: (err) => console.error("[lemonsqueezy] SDK error:", err.message),
  });
  configured = true;
}

// Test mode defaults ON (sandbox) — err toward sandbox unless explicitly
// disabled. Matches the "beta test, no real users yet" instruction.
function isTestMode(): boolean {
  return process.env.LEMONSQUEEZY_TEST_MODE !== "false";
}

export async function createSubscriptionCheckout(opts: {
  variantId: string;
  email: string;
  name?: string;
  workspaceId: string;
}): Promise<string> {
  ensureConfigured();
  const storeId = process.env.LEMONSQUEEZY_STORE_ID;
  if (!storeId) {
    throw new Error("Missing env var LEMONSQUEEZY_STORE_ID");
  }

  const { data, error } = await createCheckout(storeId, opts.variantId, {
    checkoutData: {
      email: opts.email,
      name: opts.name,
      custom: { workspaceId: opts.workspaceId },
    },
    checkoutOptions: { embed: true },
    testMode: isTestMode(),
  });

  if (error || !data) {
    throw error ?? new Error("Lemon Squeezy checkout creation failed");
  }

  const url = data.data.attributes.url;
  if (!url) {
    throw new Error("Lemon Squeezy checkout response missing url");
  }
  return url;
}

export async function getLemonSqueezySubscription(id: string) {
  ensureConfigured();
  return getSubscription(id);
}

// Cancel is NOT immediate — LS keeps `status: cancelled` with access continuing
// until `ends_at`. See lib/lemonsqueezy/status.ts and the webhook route for the
// cancelled-vs-expired handling.
export async function cancelLemonSqueezySubscription(id: string) {
  ensureConfigured();
  return cancelSubscription(id);
}

export async function resumeLemonSqueezySubscription(id: string) {
  ensureConfigured();
  return updateSubscription(id, { cancelled: false });
}

// Reconciliation lookup — Lemon Squeezy resolves/creates the customer from the
// checkout email, so we never persist a customerId at checkout time. This is
// the replacement for Paddle's customerId-based listActiveSubscriptionsForCustomer.
export async function listActiveSubscriptionsForEmail(email: string) {
  ensureConfigured();
  const storeId = process.env.LEMONSQUEEZY_STORE_ID;
  const { data, error } = await listSubscriptions({
    filter: { userEmail: email, storeId },
  });
  if (error || !data) return [];
  return data.data;
}
