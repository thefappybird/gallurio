import { Paddle, Environment } from "@paddle/paddle-node-sdk";

let instance: Paddle | null = null;

export function getPaddle(): Paddle {
  if (instance) return instance;
  const apiKey = process.env.PADDLE_API_KEY;
  if (!apiKey) {
    throw new Error("Missing env var PADDLE_API_KEY");
  }
  const environment =
    process.env.NEXT_PUBLIC_PADDLE_ENV === "production"
      ? Environment.production
      : Environment.sandbox;
  instance = new Paddle(apiKey, { environment });
  return instance;
}

export async function ensurePaddleCustomer(opts: {
  email: string;
  name?: string;
  existingCustomerId?: string | null;
}): Promise<string> {
  if (opts.existingCustomerId) return opts.existingCustomerId;

  const paddle = getPaddle();
  try {
    const customer = await paddle.customers.create({
      email: opts.email,
      name: opts.name ?? null,
    });
    return customer.id;
  } catch (err: unknown) {
    // Paddle returns a 409 when a customer with that email already exists.
    // Fall back to a list lookup and return the first match.
    const isConflict =
      err instanceof Error &&
      (err.message.includes("409") ||
        err.message.toLowerCase().includes("already exists") ||
        err.message.toLowerCase().includes("conflict"));

    if (isConflict) {
      const collection = paddle.customers.list({ email: [opts.email] });
      const page = await collection.next();
      if (page.length > 0) return page[0].id;
    }
    throw err;
  }
}

export function getSubscription(id: string) {
  return getPaddle().subscriptions.get(id);
}

export function cancelSubscription(id: string) {
  return getPaddle().subscriptions.cancel(id, {
    effectiveFrom: "next_billing_period",
  });
}

export async function listActiveSubscriptionsForCustomer(customerId: string) {
  const collection = getPaddle().subscriptions.list({
    customerId: [customerId],
    status: ["active", "trialing"],
  });

  const results = [];
  let page = await collection.next();
  while (page.length > 0) {
    results.push(...page);
    if (!collection.hasMore) break;
    page = await collection.next();
  }
  return results;
}
