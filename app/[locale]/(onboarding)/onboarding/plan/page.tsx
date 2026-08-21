import { loadOnboardingContext, requireStep } from "@/lib/auth/onboardingStep";
import { getDisplayPricing } from "@/lib/pricing/localPricing";
import { PromoCode } from "@/lib/db/models";
import { PlanStepForm } from "./plan-form";

export default async function PlanStepPage() {
  const ctx = await loadOnboardingContext();
  requireStep(ctx, "plan");
  const proPricing = await getDisplayPricing();
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
      // Workspace.plan is "pro" for every fresh signup during the free-Pro
      // trial grant (businessStepAction), not just for a real subscription —
      // use `activation` (which already excludes the trial grant) so a
      // first-time user sees the Free card/CTA, not a paid "Subscribe" one.
      currentPlan={activation === "pro" ? "pro" : "free"}
      planChoiceLocked={activation !== "free"}
      activation={activation}
      acceptedPromoCode={acceptedPromoCodes[0]?.code ?? null}
      proPricing={proPricing}
      betaTesterEnabled={process.env.BETA_TESTER_ENABLED === "true"}
    />
  );
}
