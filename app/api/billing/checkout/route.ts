import { NextResponse } from "next/server";
import { z } from "zod";
import { auth, clerkClient } from "@clerk/nextjs/server";
import { requireOrg } from "@/lib/auth/requireOrg";
import { connectDB } from "@/lib/db/mongoose";
import { Workspace } from "@/lib/db/models";
import { ensurePaddleCustomer } from "@/lib/paddle/client";
import { getPlanCatalog, isPaidPlan } from "@/lib/paddle/plans";
import { subscriptionCheckoutWorkflow } from "@/lib/workflows/subscriptionCheckout";
import { start } from "workflow/api";

export const runtime = "nodejs";

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
      { status: 400 }
    );
  }
  const { plan } = parsed.data;

  if (!isPaidPlan(plan)) {
    return NextResponse.json({ error: "Free plan does not require checkout" }, { status: 400 });
  }

  const catalog = getPlanCatalog(plan);
  if (!catalog.priceId) {
    return NextResponse.json(
      { error: "Paddle price not configured for this plan" },
      { status: 500 }
    );
  }

  await connectDB();

  // Resolve email and name from Clerk for the Paddle customer record.
  const session = await auth();
  const clerk = await clerkClient();
  const user = await clerk.users.getUser(session.userId!);
  const email = user.emailAddresses[0]?.emailAddress;
  if (!email) {
    return NextResponse.json(
      { error: "No verified email on file — add one in your account before continuing." },
      { status: 400 }
    );
  }
  const name =
    [user.firstName, user.lastName].filter(Boolean).join(" ").trim() ||
    ctx.workspace.name;

  let customerId: string;
  let run: { runId: string };
  try {
    customerId = await ensurePaddleCustomer({
      email,
      name,
      existingCustomerId: ctx.workspace.paddleCustomerId ?? undefined,
    });
    run = await start(subscriptionCheckoutWorkflow, [ctx.workspace._id.toString(), plan]);
  } catch (err) {
    console.error("[billing.checkout] paddle/workflow init failed", err);
    const msg = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: `Failed to initialise checkout: ${msg}` }, { status: 502 });
  }

  await Workspace.updateOne(
    { _id: ctx.workspace._id },
    {
      $set: {
        paddleCustomerId: customerId,
        paddleCheckoutWorkflowRunId: run.runId,
      },
    }
  );

  return NextResponse.json({
    priceId: catalog.priceId,
    customerEmail: email,
    workspaceId: ctx.workspace._id.toString(),
  });
}
