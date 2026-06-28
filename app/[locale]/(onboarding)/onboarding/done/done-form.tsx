"use client";

import { useState, useTransition } from "react";
import { motion } from "motion/react";
import { useTranslations } from "next-intl";
import { ArrowRight, Loader2, Sparkles } from "lucide-react";
import { toast } from "sonner";
import type { OnboardingStep, PlanTier } from "@/lib/db/models";
import { completeOnboardingAction } from "@/lib/actions/onboarding";
import { useActionError } from "@/lib/i18n/actionError";
import { StepShell, StepBackButton } from "../_components/step-shell";
import { DoneIllustration } from "../_components/illustrations";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

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
  const tPlans = useTranslations("plans");
  const errMsg = useActionError();
  const [seedSampleData, setSeedSampleData] = useState(true);
  const [pending, startTransition] = useTransition();

  const planLabel = tPlans(`${plan}.name`);

  function finish() {
    startTransition(async () => {
      const result = await completeOnboardingAction({ seedSampleData });
      if (result?.error) toast.error(errMsg(result.error));
    });
  }

  return (
    <StepShell
      step="done"
      furthestStep={furthestStep}
      title={t("title", { workspaceName })}
      description={t("description", { planLabel })}
      illustration={<DoneIllustration />}
    >
      <div className="flex flex-col gap-6">
        <motion.button
          type="button"
          onClick={() => setSeedSampleData((v) => !v)}
          className={cn(
            "flex items-start gap-3 border bg-background p-4 text-left transition-colors",
            seedSampleData ? "border-primary" : "border-border"
          )}
          whileTap={{ scale: 0.99 }}
        >
          <div
            className={cn(
              "mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center border",
              seedSampleData ? "border-primary bg-primary" : "border-border"
            )}
          >
            {seedSampleData && (
              <motion.span
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                className="text-primary-foreground"
              >
                <svg viewBox="0 0 12 12" className="h-3 w-3" fill="none">
                  <path
                    d="M2 6.5L5 9L10 3.5"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="square"
                  />
                </svg>
              </motion.span>
            )}
          </div>
          <div className="flex flex-col gap-1">
            <div className="flex items-center gap-2">
              <Sparkles className="h-4 w-4" />
              <span className="text-sm font-medium">{t("seedToggle.label")}</span>
            </div>
            <p className="text-xs text-muted-foreground">{t("seedToggle.description")}</p>
          </div>
        </motion.button>

        <div className="flex items-center justify-between gap-2">
          <StepBackButton from="done" />
          <Button onClick={finish} disabled={pending} className="min-w-48" size="lg">
            {pending ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                {t("settingUp")}
              </>
            ) : (
              <>
                {t("goToDashboard")}
                <ArrowRight className="ml-2 h-4 w-4" />
              </>
            )}
          </Button>
        </div>
      </div>
    </StepShell>
  );
}
