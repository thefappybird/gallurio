"use client";

import { useTransition } from "react";
import { motion } from "motion/react";
import { useTranslations } from "next-intl";
import { ArrowRight, Loader2, Sparkles, Home, Sprout, Headphones } from "lucide-react";
import { toast } from "sonner";
import type { OnboardingStep, PlanTier } from "@/lib/db/models";
import { completeOnboardingAction } from "@/lib/actions/onboarding";
import { useActionError } from "@/lib/i18n/actionError";
import { StepShell, StepBackButton } from "../_components/step-shell";
import { ConfettiScatter } from "../_components/confetti-scatter";
import { Button } from "@/components/ui/button";

export function DoneStepForm({
  workspaceName,
  plan,
  furthestStep,
}: {
  workspaceName: string;
  plan: PlanTier;
  furthestStep: OnboardingStep;
}) {
  const t = useTranslations("onboarding.done");
  const tFooter = useTranslations("onboarding.done.footer");
  const tPlans = useTranslations("plans");
  const errMsg = useActionError();
  const [pending, startTransition] = useTransition();

  const planLabel = tPlans(`${plan}.name`);

  function finish() {
    startTransition(async () => {
      const result = await completeOnboardingAction();
      if (result?.error) toast.error(errMsg(result.error));
    });
  }

  return (
    <StepShell
      step="done"
      furthestStep={furthestStep}
      title={t("title", { workspaceName })}
      description={t("description", { planLabel })}
      centerHeader
      centerContent
      headerAddon={
        <div className="relative mb-1 flex h-16 w-16 items-center justify-center rounded-full border-2 border-brand">
          <svg viewBox="0 0 32 32" className="h-8 w-8 text-brand" fill="none" aria-hidden="true">
            <motion.path
              d="M7 16.5 13 22l12-13"
              stroke="currentColor"
              strokeWidth="3"
              strokeLinecap="round"
              strokeLinejoin="round"
              initial={{ pathLength: 0 }}
              animate={{ pathLength: 1 }}
              transition={{ duration: 0.55, delay: 0.2, ease: "easeOut" }}
            />
          </svg>
        </div>
      }
      footer={
        <div className="flex items-center justify-between gap-1 pt-2 sm:gap-2 [&>a]:px-2 sm:[&>a]:px-4">
          <StepBackButton from="done" />
          <Button onClick={finish} variant="brand" disabled={pending} className="min-w-0 flex-1 sm:min-w-48 sm:flex-none" size="lg">
            {pending ? (
              <>
                <Loader2 className="me-1.5 h-4 w-4 shrink-0 animate-spin sm:me-2" />
                <span className="sm:hidden">{t("settingUpCompact")}</span>
                <span className="hidden sm:inline">{t("settingUp")}</span>
              </>
            ) : (
              <>
                {t("goToDashboard")}
                <ArrowRight className="ms-2 h-4 w-4 shrink-0" />
              </>
            )}
          </Button>
        </div>
      }
    >
    <ConfettiScatter />
    <div className="mx-auto flex w-full max-w-xl flex-col gap-6">
      <div className="grid grid-cols-3 gap-2 border-t border-border pt-4 text-center">
        {[
          { Icon: Home, label: tFooter("everything") },
          { Icon: Sprout, label: tFooter("grow") },
          { Icon: Headphones, label: tFooter("support") },
        ].map(({ Icon, label }) => (
          <div key={label} className="flex flex-col items-center gap-1.5">
            <Icon className="h-5 w-5 text-brand" aria-hidden="true" />
            <span className="text-xs text-muted-foreground">{label}</span>
          </div>
        ))}
      </div>
    </div>
    </StepShell>
  );
}
