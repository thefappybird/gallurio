import { NextResponse } from "next/server";
import { z } from "zod";
import { requireOrg } from "@/lib/auth/requireOrg";
import { getAuthUser } from "@/lib/auth/session";
import { connectDB } from "@/lib/db/mongoose";
import { createSubscriptionCheckout } from "@/lib/lemonsqueezy/client";
import { getPlanCatalog, isPaidPlan } from "@/lib/lemonsqueezy/plans";
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

  const catalog = getPlanCatalog(plan);
  const variantId = cadence === "yearly" ? catalog.yearlyVariantId : catalog.variantId;
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
  const redirectUrl = new URL(
    sanitizeLocalReturnTo(returnTo) ?? (onboarding ? "/onboarding/done" : "/settings/billing"),
    req.url,
  ).toString();

  let checkoutUrl: string;
  try {
    checkoutUrl = await createSubscriptionCheckout({
      variantId,
      email,
      name,
      workspaceId,
      redirectUrl,
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
