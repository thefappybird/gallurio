import { NextResponse } from "next/server";
import { z } from "zod";
import { requireOrg } from "@/lib/auth/requireOrg";
import { connectDB } from "@/lib/db/mongoose";
import { Workspace } from "@/lib/db/models";
import { stripe, priceIdForPlan } from "@/lib/stripe/client";

export const runtime = "nodejs";

const bodySchema = z.object({
  plan: z.enum(["starter", "pro"]),
  onboarding: z.boolean().optional(),
  trialDays: z.number().int().min(0).max(30).optional(),
});

function appUrl(): string {
  return process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
}

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
  const { plan, onboarding, trialDays } = parsed.data;

  await connectDB();

  let customerId = ctx.workspace.stripeCustomerId;
  if (!customerId) {
    const customer = await stripe.customers.create({
      name: ctx.workspace.name,
      metadata: {
        workspaceId: ctx.workspace._id.toString(),
        clerkOrgId: ctx.clerkOrgId,
      },
    });
    customerId = customer.id;
    await Workspace.updateOne(
      { _id: ctx.workspace._id },
      { $set: { stripeCustomerId: customerId } }
    );
  }

  const successPath = onboarding
    ? "/onboarding/done?session_id={CHECKOUT_SESSION_ID}"
    : "/settings/billing?checkout=success&session_id={CHECKOUT_SESSION_ID}";
  const cancelPath = onboarding ? "/onboarding/plan?checkout=cancelled" : "/settings/billing?checkout=cancelled";

  const session = await stripe.checkout.sessions.create({
    mode: "subscription",
    customer: customerId,
    line_items: [{ price: priceIdForPlan(plan), quantity: 1 }],
    success_url: `${appUrl()}${successPath}`,
    cancel_url: `${appUrl()}${cancelPath}`,
    allow_promotion_codes: true,
    client_reference_id: ctx.workspace._id.toString(),
    subscription_data: {
      trial_period_days: trialDays ?? (onboarding ? 14 : undefined),
      metadata: {
        workspaceId: ctx.workspace._id.toString(),
        clerkOrgId: ctx.clerkOrgId,
      },
    },
  });

  return NextResponse.json({ url: session.url });
}
