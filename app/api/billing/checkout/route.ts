import { NextResponse } from "next/server";
import { z } from "zod";
import { requireOrg } from "@/lib/auth/requireOrg";
import { getAuthUser } from "@/lib/auth/session";
import { connectDB } from "@/lib/db/mongoose";
import { Workspace } from "@/lib/db/models";
import { createSubscriptionCheckout } from "@/lib/lemonsqueezy/client";
import { getPlanCatalog, isPaidPlan } from "@/lib/lemonsqueezy/plans";
import { subscriptionCheckoutWorkflow } from "@/lib/workflows/subscriptionCheckout";
import { start, getHookByToken, getRun } from "workflow/api";

export const runtime = "nodejs";

// A checkout the user abandons (overlay closed before paying) leaves a workflow
// run blocked on its hook token indefinitely. Starting a new run with the same
// token then throws HookConflictError. Cancel any in-flight run first - looking
// it up by the deterministic token (not the stored run id) also reclaims runs
// that an earlier start overwrote in the DB. Best-effort: a cancel failure must
// not block a fresh checkout.
async function cancelInFlightCheckout(token: string): Promise<void> {
  try {
    const hook = await getHookByToken(token);
    if (hook?.runId) {
      await getRun(hook.runId).cancel();
    }
  } catch {
    // No hook in flight (the common path), or it already settled - nothing to do.
  }
}

const bodySchema = z.object({
  plan: z.enum(["pro"]),
  cadence: z.enum(["monthly", "yearly"]).default("monthly"),
  onboarding: z.boolean().optional(),
});

export async function POST(req: Request) {
  const ctx = await requireOrg({ allowDuringOnboarding: true });

  const json = await req.json().catch(() => ({}));
  const parsed = bodySchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid_request" }, { status: 400 });
  }
  const { plan, cadence } = parsed.data;

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

  let checkoutUrl: string;
  let run: { runId: string };
  try {
    await cancelInFlightCheckout(`ls-checkout-${workspaceId}`);
    run = await start(subscriptionCheckoutWorkflow, [workspaceId, plan]);
    checkoutUrl = await createSubscriptionCheckout({
      variantId,
      email,
      name,
      workspaceId,
    });
  } catch (err) {
    console.error("[billing.checkout] lemonsqueezy/workflow init failed", err);
    return NextResponse.json({ error: "checkout_init_failed" }, { status: 502 });
  }

  await Workspace.updateOne(
    { _id: ctx.workspace._id },
    {
      $set: {
        lsCheckoutWorkflowRunId: run.runId,
      },
    },
  );

  return NextResponse.json({
    checkoutUrl,
    workspaceId,
  });
}
