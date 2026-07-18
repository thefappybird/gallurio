import { loadOnboardingContext, requireStep } from "@/lib/auth/onboardingStep";
import { getProPricing } from "@/lib/lemonsqueezy/pricing";
import { PromoCode } from "@/lib/db/models";
import { PlanStepForm } from "./plan-form";

export default async function PlanStepPage() {
  const ctx = await loadOnboardingContext();
  requireStep(ctx, "plan");
  const proPricing = await getProPricing();
  const acceptedPromoCodes = ctx.workspace?.codesRedeemed.length
    ? await PromoCode.find({ _id: { $in: ctx.workspace.codesRedeemed } })
        .sort({ createdAt: -1 })
        .select({ code: 1 })
        .lean()
    : [];
  const selectedOnboardingPlan = ctx.workspace?.onboardingPlanSelection ?? null;
  const betaActivated =
    selectedOnboardingPlan === "beta" ||
    ctx.workspace?.plan === "beta" ||
    (!!ctx.user?.betaParticipation?.recordedAt &&
    !ctx.workspace?.lsSubscriptionId &&
    acceptedPromoCodes.length === 0);
  const activation =
    selectedOnboardingPlan === "promo" || acceptedPromoCodes.length > 0
      ? "promo"
      : betaActivated
        ? "beta"
        : selectedOnboardingPlan === "pro" || ctx.workspace?.everSubscribed
          ? "pro"
          : "free";

  return (
    <PlanStepForm
      furthestStep={ctx.currentStep}
      currentPlan={ctx.workspace?.plan ?? "free"}
      planChoiceLocked={activation !== "free"}
      activation={activation}
      acceptedPromoCode={acceptedPromoCodes[0]?.code ?? null}
      proPricing={proPricing}
      betaTesterEnabled={process.env.BETA_TESTER_ENABLED === "true"}
    />
  );
}
