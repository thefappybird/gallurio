"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { motion } from "motion/react";
import { useTranslations } from "next-intl";
import { Check, Loader2 } from "lucide-react";
import type { OnboardingStep, PlanTier } from "@/lib/db/models";
import { selectFreePlanAction } from "@/lib/actions/onboarding";
import { devActivatePlanAction } from "@/lib/actions/dev";
import { PLAN_CATALOG } from "@/lib/hitpay/plans";
import { StepShell, StepBackButton } from "../_components/step-shell";
import { PlanIllustration } from "../_components/illustrations";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

function formatPHP(amount: number): string {
  if (amount === 0) return "₱0";
  return `₱${amount.toLocaleString("en-PH")}`;
}

export function PlanStepForm({
  currentPlan,
  furthestStep,
}: {
  currentPlan: string;
  furthestStep: OnboardingStep;
}) {
  const t = useTranslations("onboarding.plan");
  const tPlans = useTranslations("plans");
  const router = useRouter();
  const [selected, setSelected] = useState<PlanTier>(
    currentPlan === "pro" ? "pro" : currentPlan === "starter" ? "starter" : "free"
  );
  const [loading, setLoading] = useState(false);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    setError(null);

    if (selected === "free") {
      startTransition(async () => {
        const result = await selectFreePlanAction();
        if (result?.error) {
          setError(result.error);
          return;
        }
        router.push("/onboarding/done");
      });
      return;
    }

    setLoading(true);
    try {
      const res = await fetch("/api/billing/checkout", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ plan: selected, onboarding: true }),
      });
      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(data.error ?? `Failed (${res.status})`);
      }
      const data = (await res.json()) as { url: string };
      window.location.href = data.url;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Checkout failed");
      setLoading(false);
    }
  }

  function devActivate() {
    setError(null);
    startTransition(async () => {
      const result = await devActivatePlanAction(selected);
      if (result?.error) {
        setError(result.error);
        return;
      }
      router.push("/onboarding/done");
    });
  }

  const isDev = process.env.NODE_ENV !== "production";
  const busy = loading || pending;
  const selectedEntry = PLAN_CATALOG.find((p) => p.id === selected);
  const selectedPrice = selectedEntry ? formatPHP(selectedEntry.amount) : "";
  const selectedName = selectedEntry ? tPlans(`${selected}.name`) : "";

  const cta =
    selected === "free"
      ? t("ctaFree")
      : t("ctaPaid", { price: selectedPrice });

  return (
    <StepShell
      step="plan"
      furthestStep={furthestStep}
      title={t("title")}
      description={t("description")}
      illustration={<PlanIllustration />}
    >
      <div className="flex flex-col gap-5">
        <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
          {PLAN_CATALOG.map((p) => {
            const active = selected === p.id;
            const price = formatPHP(p.amount);
            const cadence = p.amount === 0 ? t("cadence.forever") : t("cadence.monthly");
            return (
              <motion.button
                key={p.id}
                type="button"
                whileHover={{ y: -2 }}
                whileTap={{ scale: 0.985 }}
                onClick={() => setSelected(p.id)}
                className={cn(
                  "relative flex flex-col gap-3 border bg-background p-4 text-left transition-colors",
                  active ? "border-primary" : "border-border hover:border-foreground/40"
                )}
              >
                {p.highlight && (
                  <span className="absolute -top-2 right-3 bg-primary px-2 py-0.5 text-[10px] uppercase tracking-wider text-primary-foreground">
                    {t("popular")}
                  </span>
                )}
                <div className="flex items-baseline justify-between">
                  <h3 className="font-heading text-lg font-semibold">{tPlans(`${p.id}.name`)}</h3>
                  {active && (
                    <span className="flex h-5 w-5 items-center justify-center bg-primary text-primary-foreground">
                      <Check className="h-3.5 w-3.5" />
                    </span>
                  )}
                </div>
                <div className="flex items-baseline gap-1">
                  <span className="font-heading text-2xl font-semibold">{price}</span>
                  <span className="text-xs text-muted-foreground">{cadence}</span>
                </div>
                <p className="text-xs text-muted-foreground">{tPlans(`${p.id}.tagline`)}</p>
                <ul className="mt-1 flex flex-col gap-1.5 text-xs">
                  {p.featureKeys.map((key) => (
                    <li key={key} className="flex items-start gap-1.5">
                      <Check className="mt-0.5 h-3 w-3 shrink-0 text-primary" />
                      <span>{tPlans(key.replace(/^plans\./, ""))}</span>
                    </li>
                  ))}
                </ul>
              </motion.button>
            );
          })}
        </div>

        {selected !== "free" && (
          <p className="text-xs text-muted-foreground">{t("checkoutNote")}</p>
        )}

        {error && (
          <p className="border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
            {error}
          </p>
        )}

        <div className="mt-1 flex items-center justify-between gap-2">
          <StepBackButton from="plan" />
          <Button onClick={submit} disabled={busy} className="min-w-48">
            {busy ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                {selected === "free" ? t("settingUp") : t("opening")}
              </>
            ) : (
              cta
            )}
          </Button>
        </div>

        {isDev && (
          <div className="mt-2 flex items-center justify-between gap-2 border border-dashed border-amber-500/40 bg-amber-500/5 p-3">
            <div className="text-xs">
              <p className="font-semibold uppercase tracking-wider text-amber-700 dark:text-amber-500">
                {t("dev.label")}
              </p>
              <p className="text-muted-foreground">
                {t("dev.description", { planName: selectedName })}
              </p>
            </div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={devActivate}
              disabled={busy}
            >
              {t("dev.activate", { planName: selectedName })}
            </Button>
          </div>
        )}
      </div>
    </StepShell>
  );
}
