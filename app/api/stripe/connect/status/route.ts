import { NextResponse } from "next/server";
import { requireOrg } from "@/lib/auth/requireOrg";
import { connectDB } from "@/lib/db/mongoose";
import { Workspace } from "@/lib/db/models";
import { stripe } from "@/lib/stripe/client";

export const runtime = "nodejs";

export async function GET() {
  const ctx = await requireOrg({ allowDuringOnboarding: true });
  const accountId = ctx.workspace.stripeConnectAccountId;
  if (!accountId) {
    return NextResponse.json({ connected: false });
  }

  const account = await stripe.accounts.retrieve(accountId);
  const chargesEnabled = Boolean(account.charges_enabled);
  const payoutsEnabled = Boolean(account.payouts_enabled);
  const detailsSubmitted = Boolean(account.details_submitted);

  await connectDB();
  await Workspace.updateOne(
    { _id: ctx.workspace._id },
    {
      $set: {
        stripeConnectChargesEnabled: chargesEnabled,
        stripeConnectPayoutsEnabled: payoutsEnabled,
        stripeConnectDetailsSubmitted: detailsSubmitted,
      },
    }
  );

  return NextResponse.json({
    connected: true,
    chargesEnabled,
    payoutsEnabled,
    detailsSubmitted,
  });
}
