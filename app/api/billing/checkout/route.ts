import { NextResponse } from "next/server";
import { z } from "zod";
import { requireOrg } from "@/lib/auth/requireOrg";
import { getAuthUser } from "@/lib/auth/session";
import { isPaidBillingAvailable } from "@/lib/billing/availability";
import { connectDB } from "@/lib/db/mongoose";
import { createSubscriptionCheckout } from "@/lib/lemonsqueezy/client";
import { getProVariantsForTier, isPaidPlan } from "@/lib/lemonsqueezy/plans";
import { tierForCountry } from "@/lib/pricing/pricingTier";
import { rateLimit } from "@/lib/server/rateLimit";
import { sanitizeLocalReturnTo } from "@/lib/http/localReturnTo";
import { hasActivatedOnboardingPlan } from "@/lib/onboarding/planActivation";

export const runtime = "nodejs";

// Authenticated but cheaply repeatable and each hit calls the external Lemon
// Squeezy API — key by workspace (stable, derived from the validated
// session) rather than IP.
const RATE_LIMIT = { limit: 5, windowMs: 5 * 60_000 };

const bodySchema = z.object({
  plan: z.enum(["pro"]),
  cadence: z.enum(["monthly", "yearly"]).default("monthly"),
  onboarding: z.boolean().optional(),
  returnTo: z.string().startsWith("/").optional(),
});

export async function POST(req: Request) {
  // Cheap, zero-I/O check first — avoids an auth session decrypt + 2 Mongo
  // round trips on every request for as long as paid billing is switched off.
  if (!isPaidBillingAvailable()) {
    return NextResponse.json({ error: "billing_unavailable" }, { status: 403 });
  }

  // A gated owner must be able to POST here too - re-subscribing is how they
  // un-gate themselves.
  const ctx = await requireOrg({ allowDuringOnboarding: true, allowWhenGated: true });

  const limited = rateLimit(`checkout:${ctx.workspace._id.toString()}`, RATE_LIMIT);
  if (!limited.ok) {
    return NextResponse.json(
      { error: "rate_limited" },
      {
        status: 429,
        headers: {
          "Retry-After": String(Math.max(0, Math.ceil((limited.resetAt - Date.now()) / 1000))),
        },
      },
    );
  }

  const json = await req.json().catch(() => ({}));
  const parsed = bodySchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid_request" }, { status: 400 });
  }
  const { plan, cadence, onboarding, returnTo } = parsed.data;

  if (onboarding && hasActivatedOnboardingPlan(ctx.workspace)) {
    return NextResponse.json({ error: "onboarding_plan_locked" }, { status: 409 });
  }

  if (!isPaidPlan(plan)) {
    return NextResponse.json(
      { error: "free_plan_no_checkout" },
      { status: 400 },
    );
  }

  // Tier decides what the customer is charged, so it is resolved server-side
  // from this request's own CF-IPCountry header — never accepted from the
  // client/request body.
  const tier = tierForCountry(req.headers.get("cf-ipcountry"));
  const variants = getProVariantsForTier(tier);
  const variantId = cadence === "yearly" ? variants.yearlyVariantId : variants.monthlyVariantId;
  if (!variantId) {
    return NextResponse.json(
      { error: "lemonsqueezy_variant_not_configured" },
      { status: 500 },
    );
  }

  await connectDB();

  // Resolve email and name from WorkOS session — Lemon Squeezy resolves/
  // creates the customer from the checkout email, no pre-create step needed.
  const authUser = await getAuthUser();
  if (!authUser) {
    return NextResponse.json({ error: "not_authenticated" }, { status: 401 });
  }

  const email = authUser.email;
  if (!email) {
    return NextResponse.json({ error: "no_verified_email" }, { status: 400 });
  }

  const name = authUser.name || ctx.workspace.name;
  const workspaceId = ctx.workspace._id.toString();
  // Lemon Squeezy defaults to redirecting to its own hosted order page after
  // a successful payment unless told otherwise — send the customer back into
  // the app instead. The embedded overlay's Checkout.Success event (see
  // useLemonSqueezyCheckout) already navigates on success in normal browser
  // flows; this is the fallback for when the overlay's own post-payment
  // screen redirects the top-level page rather than staying embedded.
  // `returnTo` (e.g. the caller's original destination behind a /subscribe
  // gate) takes precedence over the onboarding/default targets when present.
  const redirectOrigin = process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "") || req.url;
  const redirectUrl = onboarding
    ? new URL("/onboarding/done", redirectOrigin)
    : new URL("/billing/return", redirectOrigin);

  // A returning, gated owner cannot reach Settings until the subscription is
  // reflected in Mongo. Route every non-onboarding completion through the
  // authenticated return page first: it reconciles the just-created
  // subscription directly with Lemon Squeezy, then forwards to this safe
  // in-app destination. This is a recovery/safety net; the webhook remains
  // the authoritative, durable path.
  if (!onboarding) {
    redirectUrl.searchParams.set(
      "returnTo",
      sanitizeLocalReturnTo(returnTo) ?? "/settings/billing",
    );
  }

  let checkoutUrl: string;
  try {
    checkoutUrl = await createSubscriptionCheckout({
      variantId,
      email,
      name,
      workspaceId,
      redirectUrl: redirectUrl.toString(),
    });
  } catch (err) {
    console.error("[billing.checkout] lemonsqueezy checkout init failed", err);
    return NextResponse.json({ error: "checkout_init_failed" }, { status: 502 });
  }

  return NextResponse.json({
    checkoutUrl,
    workspaceId,
  });
}
