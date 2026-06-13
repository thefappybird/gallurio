import { NextResponse } from "next/server";
import { z } from "zod";
import { requireOrg } from "@/lib/auth/requireOrg";
import { getAuthUser } from "@/lib/auth/session";
import { connectDB } from "@/lib/db/mongoose";
import { Workspace } from "@/lib/db/models";
import { ensurePaddleCustomer } from "@/lib/paddle/client";
import { getPlanCatalog, isPaidPlan } from "@/lib/paddle/plans";
import { subscriptionCheckoutWorkflow } from "@/lib/workflows/subscriptionCheckout";
import { start, getHookByToken, getRun } from "workflow/api";

export const runtime = "nodejs";

// A checkout the user abandons (overlay closed before paying) leaves a workflow
// run blocked on its hook token indefinitely. Starting a new run with the same
// token then throws HookConflictError. Cancel any in-flight run first — looking
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
    // No hook in flight (the common path), or it already settled — nothing to do.
  }
}

const bodySchema = z.object({
  plan: z.enum(["starter", "pro"]),
  onboarding: z.boolean().optional(),
});

export async function POST(req: Request) {
  const ctx = await requireOrg({ allowDuringOnboarding: true });

  const json = await req.json().catch(() => ({}));
  const parsed = bodySchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.errors[0]?.message ?? "Invalid request" },
      { status: 400 },
    );
  }
  const { plan } = parsed.data;

  if (!isPaidPlan(plan)) {
    return NextResponse.json(
      { error: "Free plan does not require checkout" },
      { status: 400 },
    );
  }

  const catalog = getPlanCatalog(plan);
  if (!catalog.priceId) {
    return NextResponse.json(
      { error: "Paddle price not configured for this plan" },
      { status: 500 },
    );
  }

  await connectDB();

  // Resolve email and name from WorkOS session for the Paddle customer record.
  const authUser = await getAuthUser();
  if (!authUser) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const email = authUser.email;
  if (!email) {
    return NextResponse.json(
      {
        error:
          "No verified email on file — add one in your account before continuing.",
      },
      { status: 400 },
    );
  }

  const name = authUser.name || ctx.workspace.name;

  let customerId: string;
  let run: { runId: string };
  try {
    customerId = await ensurePaddleCustomer({
      email,
      name,
      existingCustomerId: ctx.workspace.paddleCustomerId ?? undefined,
    });
    await cancelInFlightCheckout(
      `paddle-checkout-${ctx.workspace._id.toString()}`,
    );
    run = await start(subscriptionCheckoutWorkflow, [
      ctx.workspace._id.toString(),
      plan,
    ]);
  } catch (err) {
    console.error("[billing.checkout] paddle/workflow init failed", err);
    const msg = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json(
      { error: `Failed to initialise checkout: ${msg}` },
      { status: 502 },
    );
  }

  await Workspace.updateOne(
    { _id: ctx.workspace._id },
    {
      $set: {
        paddleCustomerId: customerId,
        paddleCheckoutWorkflowRunId: run.runId,
      },
    },
  );

  return NextResponse.json({
    priceId: catalog.priceId,
    customerEmail: email,
    workspaceId: ctx.workspace._id.toString(),
  });
}
