import { loadOnboardingContext, requireStep } from "@/lib/auth/onboardingStep";
import { connectDB } from "@/lib/db/mongoose";
import { Workspace } from "@/lib/db/models";
import { stripe, planForPriceId } from "@/lib/stripe/client";
import { DoneStepForm } from "./done-form";

async function reconcileCheckout(sessionId: string, clerkOrgId: string) {
  try {
    const session = await stripe.checkout.sessions.retrieve(sessionId, {
      expand: ["subscription"],
    });
    const sub =
      typeof session.subscription === "string"
        ? await stripe.subscriptions.retrieve(session.subscription)
        : session.subscription;
    if (!sub) return;

    const item = sub.items.data[0];
    const priceId = item?.price.id;
    if (!priceId) return;

    await connectDB();
    await Workspace.updateOne(
      { clerkOrgId },
      {
        $set: {
          plan: planForPriceId(priceId),
          stripeSubscriptionId: sub.id,
          stripePriceId: priceId,
          stripeStatus: sub.status,
          stripeCurrentPeriodEnd: item?.current_period_end
            ? new Date(item.current_period_end * 1000)
            : null,
          trialEndsAt: sub.trial_end ? new Date(sub.trial_end * 1000) : null,
        },
      }
    );
  } catch (err) {
    console.error("[onboarding/done] reconcile failed", err);
  }
}

export default async function DoneStepPage({
  searchParams,
}: {
  searchParams: Promise<{ session_id?: string }>;
}) {
  const ctx = await loadOnboardingContext();
  requireStep(ctx, "done");

  const { session_id } = await searchParams;
  if (session_id && ctx.workspace) {
    await reconcileCheckout(session_id, ctx.workspace.clerkOrgId);
  }

  return (
    <DoneStepForm
      workspaceName={ctx.workspace?.name ?? "your workspace"}
      planLabel={ctx.workspace?.plan === "pro" ? "Pro" : ctx.workspace?.plan === "starter" ? "Starter" : "Free"}
    />
  );
}
