import { NextResponse } from "next/server";
import { z } from "zod";
import { auth, clerkClient } from "@clerk/nextjs/server";
import { requireOrg } from "@/lib/auth/requireOrg";
import { connectDB } from "@/lib/db/mongoose";
import { Workspace } from "@/lib/db/models";
import { createRecurringBilling } from "@/lib/hitpay/client";
import { getPlanCatalog, isPaidPlan } from "@/lib/hitpay/plans";

export const runtime = "nodejs";

const bodySchema = z.object({
  plan: z.enum(["starter", "pro"]),
  onboarding: z.boolean().optional(),
});

function appUrl(): string {
  return process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
}

function todayISO(): string {
  // HitPay validates start_date against their server clock, which is Singapore
  // time (UTC+8). Using `toISOString()` would produce the UTC date — which is
  // the previous calendar day while SGT is already on the next day — and the
  // API rejects with "The start date must be a date after or equal to today."
  // en-CA's date format is YYYY-MM-DD, so we get the right shape directly.
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Singapore",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

// Plan names for HitPay's "name" field. These are merchant-facing identifiers
// in HitPay's dashboard, not user-visible — kept in English deliberately so
// support staff don't have to read translated subscription names.
const PLAN_NAME: Record<"starter" | "pro", string> = {
  starter: "Gallurio Starter — monthly",
  pro: "Gallurio Pro — monthly",
};

// Sandbox enables ShopeePay only (cards in sandbox need a Stripe test-account
// hookup we skip); live uses cards. HITPAY_API_BASE is the env switch.
function recurringPaymentMethods(): Array<"card" | "shopee_pay"> {
  const base = process.env.HITPAY_API_BASE ?? "";
  const isSandbox = base.includes("sandbox");
  return isSandbox ? ["shopee_pay"] : ["card"];
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
  const { plan, onboarding } = parsed.data;
  if (!isPaidPlan(plan)) {
    return NextResponse.json({ error: "Free plan does not require checkout" }, { status: 400 });
  }
  const catalog = getPlanCatalog(plan);

  await connectDB();

  const session = await auth();
  const clerk = await clerkClient();
  const user = await clerk.users.getUser(session.userId!);
  const customerEmail = user.emailAddresses[0]?.emailAddress;
  if (!customerEmail) {
    return NextResponse.json(
      { error: "No verified email on file — add one in your account before continuing." },
      { status: 400 }
    );
  }
  const customerName = [user.firstName, user.lastName].filter(Boolean).join(" ").trim() || ctx.workspace.name;

  const successPath = onboarding
    ? `/onboarding/done?ref={REFERENCE}`
    : `/settings/billing?checkout=success&ref={REFERENCE}`;

  const reference = `sub_${ctx.workspace._id.toString()}_${Date.now()}`;
  const redirectUrl = `${appUrl()}${successPath.replace("{REFERENCE}", reference)}`;

  const billing = await createRecurringBilling({
    name: PLAN_NAME[plan],
    cycle: "monthly",
    amount: catalog.amount,
    currency: "PHP",
    customer_email: customerEmail,
    customer_name: customerName,
    start_date: todayISO(),
    reference,
    redirect_url: redirectUrl,
    payment_methods: recurringPaymentMethods(),
  });

  await Workspace.updateOne(
    { _id: ctx.workspace._id },
    {
      $set: {
        hitpayRecurringBillingId: billing.id,
        hitpayRecurringReference: reference,
        hitpayRecurringStatus: "pending",
      },
    }
  );

  if (!billing.url) {
    return NextResponse.json(
      { error: "HitPay did not return a payment URL" },
      { status: 502 }
    );
  }

  return NextResponse.json({ url: billing.url, billingId: billing.id, reference });
}
