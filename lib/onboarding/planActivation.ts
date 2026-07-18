/**
 * A plan activated during onboarding is immutable until the user reaches
 * billing settings. The complimentary first-month grant is deliberately not
 * included: users who chose the free path may still choose another option.
 */
export type OnboardingPlanWorkspace = {
  plan: string;
  everSubscribed: boolean;
  codesRedeemed?: unknown[];
};

export function hasActivatedOnboardingPlan(workspace: OnboardingPlanWorkspace): boolean {
  return (
    workspace.plan === "beta" ||
    workspace.everSubscribed ||
    (workspace.codesRedeemed?.length ?? 0) > 0
  );
}
