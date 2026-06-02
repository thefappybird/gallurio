import { redirect } from "next/navigation";
import {
  loadOnboardingContext,
  stepIndex,
} from "@/lib/auth/onboardingStep";
import { connectDB } from "@/lib/db/mongoose";
import { ONBOARDING_STEPS, User, Workspace, type PlanTier } from "@/lib/db/models";
import { getRecurringBilling } from "@/lib/hitpay/client";
import { planForAmount } from "@/lib/hitpay/plans";
import { DoneStepForm } from "./done-form";

// When the user comes back from HitPay's hosted authorization, we eagerly
// reconcile the recurring billing onto the workspace. The webhook handler
// does the same thing, but the user has typically beaten the webhook to
// this page.
async function reconcileHitpayRecurring(reference: string, workspaceId: string) {
  try {
    await connectDB();
    const workspace = await Workspace.findOne({
      _id: workspaceId,
      hitpayRecurringReference: reference,
    });
    if (!workspace?.hitpayRecurringBillingId) return;

    const billing = await getRecurringBilling(workspace.hitpayRecurringBillingId);
    // HitPay returns amount as a numeric string in some payloads. Coerce.
    const amount =
      typeof billing.amount === "number" ? billing.amount : Number(billing.amount);
    if (!Number.isFinite(amount)) return;
    const tier = planForAmount(amount);
    if (tier === "free") return;

    const isLive = billing.status === "active";
    await Workspace.updateOne(
      { _id: workspaceId },
      {
        $set: {
          plan: tier,
          hitpayRecurringStatus: isLive ? "active" : "pending",
        },
      }
    );
  } catch (err) {
    console.error("[onboarding/done] hitpay reconcile failed", err);
  }
}

export default async function DoneStepPage({
  searchParams,
}: {
  searchParams: Promise<{ ref?: string }>;
}) {
  const ctx = await loadOnboardingContext();

  if (ctx.user?.onboardingCompletedAt) redirect("/dashboard");

  if (stepIndex(ctx.currentStep) < stepIndex("plan")) {
    redirect(`/onboarding/${ctx.currentStep}`);
  }

  const { ref } = await searchParams;
  let workspaceName = ctx.workspace?.name ?? "your workspace";
  let plan: PlanTier = ctx.workspace?.plan ?? "free";

  if (ref && ctx.workspace) {
    await reconcileHitpayRecurring(ref, ctx.workspace._id.toString());
    const refreshed = await Workspace.findOne({ _id: ctx.workspace._id })
      .select({ name: 1, plan: 1 })
      .lean<{ name: string; plan: PlanTier }>();
    if (refreshed) {
      workspaceName = refreshed.name;
      plan = refreshed.plan;
    }
  }

  const earlierThanDone = ONBOARDING_STEPS.slice(0, ONBOARDING_STEPS.indexOf("done"));
  await User.updateOne(
    { clerkUserId: ctx.userId, onboardingStep: { $in: earlierThanDone } },
    { $set: { onboardingStep: "done" } }
  );

  return (
    <DoneStepForm
      furthestStep="done"
      workspaceName={workspaceName}
      plan={plan}
    />
  );
}
