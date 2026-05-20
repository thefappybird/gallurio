import { NextResponse } from "next/server";
import { requireOrg } from "@/lib/auth/requireOrg";
import { connectDB } from "@/lib/db/mongoose";
import { Workspace } from "@/lib/db/models";
import { stripe } from "@/lib/stripe/client";

export const runtime = "nodejs";

function appUrl(): string {
  return process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
}

export async function POST() {
  const ctx = await requireOrg({ allowDuringOnboarding: true });
  await connectDB();

  let accountId = ctx.workspace.stripeConnectAccountId;
  if (!accountId) {
    const account = await stripe.accounts.create({
      type: "express",
      country: ctx.workspace.country ?? undefined,
      capabilities: {
        card_payments: { requested: true },
        transfers: { requested: true },
      },
      business_type: "individual",
      metadata: {
        workspaceId: ctx.workspace._id.toString(),
        clerkOrgId: ctx.clerkOrgId,
      },
    });
    accountId = account.id;
    await Workspace.updateOne(
      { _id: ctx.workspace._id },
      { $set: { stripeConnectAccountId: accountId } }
    );
  }

  const link = await stripe.accountLinks.create({
    account: accountId,
    refresh_url: `${appUrl()}/onboarding/payments?connect=refresh`,
    return_url: `${appUrl()}/onboarding/payments?connect=return`,
    type: "account_onboarding",
  });

  return NextResponse.json({ url: link.url });
}
