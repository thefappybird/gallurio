"use client";

import { useState, useTransition, useEffect, useRef } from "react";
import { useRouter } from "@/lib/i18n/navigation";
import { motion } from "motion/react";
import { useTranslations, useLocale } from "next-intl";
import { Check, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { initializePaddle, type Paddle } from "@paddle/paddle-js";
import type { OnboardingStep, PlanTier } from "@/lib/db/models";
import { selectFreePlanAction } from "@/lib/actions/onboarding";
import { devActivatePlanAction } from "@/lib/actions/dev";
import { PLAN_CATALOG, type PlanCatalogEntry } from "@/lib/paddle/plans";
import type { ProPricing } from "@/lib/paddle/pricing";
import { formatMoney } from "@/lib/utils/format-currency";
import { useActionError } from "@/lib/i18n/actionError";
import { StepShell, StepBackButton } from "../_components/step-shell";
import { Button } from "@/components/ui/button";
import { SegmentedToggle } from "@/components/ui/segmented-toggle";
import { cn } from "@/lib/utils";

export function PlanStepForm({
  currentPlan,
  furthestStep,
  proPricing,
}: {
  currentPlan: string;
  furthestStep: OnboardingStep;
  proPricing: ProPricing;
}) {
  const t = useTranslations("onboarding.plan");
  const tPlans = useTranslations("plans");
  const errMsg = useActionError();
  const locale = useLocale();
  const router = useRouter();
  const [selected, setSelected] = useState<PlanTier>(currentPlan === "pro" ? "pro" : "free");
  const [cadence, setCadence] = useState<"monthly" | "yearly">("monthly");
  const [loading, setLoading] = useState(false);
  const [checkoutError, setCheckoutError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const paddleRef = useRef<Paddle | null>(null);
  const paddleInitAttempted = useRef(false);
  const paddleTokenMissing =
    !process.env.NEXT_PUBLIC_PADDLE_CLIENT_TOKEN ||
    process.env.NEXT_PUBLIC_PADDLE_CLIENT_TOKEN === "";

  useEffect(() => {
    if (paddleInitAttempted.current || paddleTokenMissing) return;
    paddleInitAttempted.current = true;

    initializePaddle({
      token: process.env.NEXT_PUBLIC_PADDLE_CLIENT_TOKEN!,
      environment: (process.env.NEXT_PUBLIC_PADDLE_ENV ?? "sandbox") as
        | "sandbox"
        | "production",
      eventCallback(e) {
        if (e.name === "checkout.completed") {
          router.push("/onboarding/done");
        }
      },
    })
      .then((p) => {
        paddleRef.current = p ?? null;
      })
      .catch((err) => {
        console.warn("[plan-form] Paddle init failed:", err);
      });
  }, [paddleTokenMissing, router]);

  async function submit() {
    setCheckoutError(null);

    if (selected === "free") {
      startTransition(async () => {
        const result = await selectFreePlanAction();
        if (result?.error) {
          toast.error(errMsg(result.error));
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
        body: JSON.stringify({ plan: selected, cadence, onboarding: true }),
      });
      const data = (await res.json().catch(() => ({}))) as {
        priceId?: string;
        customerEmail?: string;
        workspaceId?: string;
        error?: string;
      };
      if (!res.ok) {
        throw new Error(data.error ?? `Checkout request failed (${res.status})`);
      }
      if (!data.priceId) {
        throw new Error("Missing priceId in checkout response");
      }

      if (!paddleRef.current) {
        // Paddle failed to init (no token or load error) — surface clearly.
        throw new Error(t("paddleNotReady"));
      }

      paddleRef.current.Checkout.open({
        items: [{ priceId: data.priceId, quantity: 1 }],
        customer: data.customerEmail ? { email: data.customerEmail } : undefined,
        customData: { workspaceId: data.workspaceId },
      });
    } catch (err) {
      const rawMsg = err instanceof Error ? err.message : "checkout_init_failed";
      const displayMsg = errMsg(rawMsg);
      setCheckoutError(displayMsg);
      toast.error(displayMsg);
    } finally {
      setLoading(false);
    }
  }

  function devActivate() {
    setCheckoutError(null);
    startTransition(async () => {
      const result = await devActivatePlanAction(selected);
      if (result?.error) {
        toast.error(errMsg(result.error));
        return;
      }
      router.push("/onboarding/done");
    });
  }

  function amountFor(p: PlanCatalogEntry, cadence: "monthly" | "yearly"): number {
    if (p.id === "pro") return cadence === "yearly" ? proPricing.yearly : proPricing.monthly;
    return cadence === "yearly" && p.yearlyAmount ? p.yearlyAmount : p.amount;
  }

  const isDev = process.env.NODE_ENV !== "production";
  const busy = loading || pending;
  const selectedEntry = PLAN_CATALOG.find((p) => p.id === selected);
  const selectedPrice = selectedEntry
    ? formatMoney(amountFor(selectedEntry, cadence), proPricing.currency, locale)
    : "";
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
    >
      <div className="flex flex-col gap-5">
        <div className="flex items-center gap-2">
          <SegmentedToggle
            value={cadence}
            onChange={setCadence}
            ariaLabel={`${t("cadenceToggle.monthly")} / ${t("cadenceToggle.yearly")}`}
            options={[
              { key: "monthly", label: t("cadenceToggle.monthly") },
              { key: "yearly", label: t("cadenceToggle.yearly") },
            ]}
          />
          {cadence === "yearly" && (
            <span className="bg-brand/10 px-2 py-0.5 text-[10px] uppercase tracking-wider text-brand">
              {t("cadenceToggle.savePill")}
            </span>
          )}
        </div>

        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          {PLAN_CATALOG.map((p) => {
            const active = selected === p.id;
            const priceAmount = amountFor(p, cadence);
            const price = formatMoney(priceAmount, proPricing.currency, locale);
            const cadenceLabel =
              p.amount === 0
                ? t("cadence.forever")
                : cadence === "yearly"
                  ? t("cadence.yearly")
                  : t("cadence.monthly");
            return (
              <motion.button
                key={p.id}
                type="button"
                whileHover={{ y: -2 }}
                whileTap={{ scale: 0.985 }}
                onClick={() => {
                  setSelected(p.id);
                  setCheckoutError(null);
                }}
                className={cn(
                  "relative flex flex-col gap-3 border bg-background p-4 text-left transition-colors",
                  active ? "border-brand" : "border-border hover:border-brand/40 focus-visible:border-brand/40"
                )}
              >
                {p.highlight && (
                  <span className="absolute -top-2 right-3 bg-brand px-2 py-0.5 text-[10px] uppercase tracking-wider text-brand-foreground">
                    {t("popular")}
                  </span>
                )}
                <div className="flex items-baseline justify-between">
                  <h3 className="font-heading text-lg font-semibold">{tPlans(`${p.id}.name`)}</h3>
                  {active && (
                    <span className="flex h-5 w-5 items-center justify-center bg-brand text-brand-foreground">
                      <Check className="h-3.5 w-3.5" />
                    </span>
                  )}
                </div>
                <div className="flex items-baseline gap-1">
                  <span className="font-heading text-2xl font-semibold">{price}</span>
                  <span className="text-xs text-muted-foreground">{cadenceLabel}</span>
                </div>
                <p className="text-xs text-muted-foreground">{tPlans(`${p.id}.tagline`)}</p>
                <ul className="mt-1 flex flex-col gap-1.5 text-xs">
                  {p.featureKeys.map((key) => (
                    <li key={key} className="flex items-start gap-1.5">
                      <Check className="mt-0.5 h-3 w-3 shrink-0 text-brand" />
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

        {selected !== "free" && paddleTokenMissing && isDev && (
          <p className="text-xs text-amber-700 dark:text-amber-400">
            {t("paddleTokenMissingDev")}
          </p>
        )}

        {checkoutError && (
          <p role="alert" className="text-xs text-destructive">
            {checkoutError}
          </p>
        )}

        <div className="mt-1 flex items-center justify-between gap-2">
          <StepBackButton from="plan" />
          <Button onClick={submit} variant="brand" disabled={busy} className="min-w-48">
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
