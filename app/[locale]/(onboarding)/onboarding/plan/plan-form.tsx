"use client";

import { useState, useTransition } from "react";
import { useRouter } from "@/lib/i18n/navigation";
import { motion } from "motion/react";
import { useTranslations, useLocale } from "next-intl";
import { Check, Loader2 } from "lucide-react";
import { toast } from "sonner";
import type { OnboardingStep, PlanTier } from "@/lib/db/models";
import { selectFreePlanAction, activateBetaTesterAction } from "@/lib/actions/onboarding";
import { redeemPromoCodeAction } from "@/lib/actions/promoCode";
import { PLAN_CATALOG, type PlanCatalogEntry } from "@/lib/lemonsqueezy/plans";
import type { ProPricing } from "@/lib/lemonsqueezy/pricing";
import { formatMoney } from "@/lib/utils/format-currency";
import { useActionError } from "@/lib/i18n/actionError";
import { useLemonSqueezyCheckout } from "@/hooks/use-lemon-squeezy-checkout";
import { StepShell, StepBackButton, isStepCompleted } from "../_components/step-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { SegmentedToggle } from "@/components/ui/segmented-toggle";
import { CollapsibleDrawer } from "@/components/ui/collapsible-drawer";
import { cn } from "@/lib/utils";

export function PlanStepForm({
  currentPlan,
  furthestStep,
  proPricing,
  betaTesterEnabled = false,
}: {
  currentPlan: string;
  furthestStep: OnboardingStep;
  proPricing: ProPricing;
  betaTesterEnabled?: boolean;
}) {
  const t = useTranslations("onboarding.plan");
  const tPlans = useTranslations("plans");
  const tPromo = useTranslations("common.promoCode");
  const errMsg = useActionError();
  const locale = useLocale();
  const router = useRouter();
  const [selected, setSelected] = useState<PlanTier>(currentPlan === "pro" ? "pro" : "free");
  const [cadence, setCadence] = useState<"monthly" | "yearly">("monthly");
  const [loading, setLoading] = useState(false);
  const [checkoutError, setCheckoutError] = useState<string | null>(null);
  const [promoCode, setPromoCode] = useState("");
  const [promoLoading, setPromoLoading] = useState(false);
  const [promoError, setPromoError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const lemonSqueezy = useLemonSqueezyCheckout(() => router.push("/onboarding/done"));

  async function submitPromoCode() {
    setPromoError(null);
    setPromoLoading(true);
    const result = await redeemPromoCodeAction(promoCode);
    setPromoLoading(false);
    if ("error" in result) {
      const msg = errMsg(result.error);
      setPromoError(msg);
      toast.error(msg);
      return;
    }
    toast.success(tPromo(result.startsImmediately ? "success" : "successQueued"));
    router.push("/onboarding/done");
  }

  async function submit() {
    setCheckoutError(null);
    const savedPlan = currentPlan === "pro" ? "pro" : "free";
    const unchangedSavedSelection = selected === savedPlan && cadence === "monthly";

    if (isStepCompleted("plan", furthestStep) && unchangedSavedSelection) {
      startTransition(() => router.push("/onboarding/done"));
      return;
    }

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
        checkoutUrl?: string;
        workspaceId?: string;
        error?: string;
      };
      if (!res.ok) {
        throw new Error(data.error ?? `Checkout request failed (${res.status})`);
      }
      if (!data.checkoutUrl) {
        throw new Error("Missing checkoutUrl in checkout response");
      }

      if (!lemonSqueezy.open(data.checkoutUrl)) {
        // lemon.js hasn't finished loading yet — surface clearly.
        throw new Error(t("checkoutNotReady"));
      }
    } catch (err) {
      const rawMsg = err instanceof Error ? err.message : "checkout_init_failed";
      const displayMsg = errMsg(rawMsg);
      setCheckoutError(displayMsg);
      toast.error(displayMsg);
    } finally {
      setLoading(false);
    }
  }

  function activateBeta() {
    setCheckoutError(null);
    startTransition(async () => {
      const result = await activateBetaTesterAction();
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

  const busy = loading || pending;
  const selectedEntry = PLAN_CATALOG.find((p) => p.id === selected);
  const selectedPrice = selectedEntry
    ? formatMoney(amountFor(selectedEntry, cadence), proPricing.currency, locale)
    : "";

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
      footer={
        <div className="flex items-center justify-between gap-2">
          <StepBackButton from="plan" />
          <Button onClick={submit} variant="brand" disabled={busy} className="min-w-48">
            {busy ? (
              <>
                <Loader2 className="me-2 h-4 w-4 animate-spin" />
                {selected === "free" ? t("settingUp") : t("opening")}
              </>
            ) : (
              cta
            )}
          </Button>
        </div>
      }
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

        {betaTesterEnabled && (
          <div className="flex flex-col items-start justify-between gap-3 border border-brand bg-brand/5 p-4 sm:flex-row sm:items-center">
            <div>
              <span className="text-[10px] font-semibold uppercase tracking-wider text-brand">
                {t("betaTester.label")}
              </span>
              <h3 className="font-heading text-lg font-semibold">{t("betaTester.headline")}</h3>
            </div>
            <Button
              type="button"
              variant="brand"
              size="lg"
              onClick={activateBeta}
              disabled={busy}
              className="w-full sm:w-auto"
            >
              {t("betaTester.activate")}
            </Button>
          </div>
        )}

        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          {PLAN_CATALOG.map((p) => {
            const active = selected === p.id;
            const priceAmount = amountFor(p, cadence);
            const price = formatMoney(priceAmount, proPricing.currency, locale);
            const yearlyComparePrice =
              p.id === "pro" && cadence === "yearly"
                ? formatMoney(proPricing.monthly * 12, proPricing.currency, locale)
                : null;
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
                disabled={p.id === "pro"}
                whileHover={p.id === "pro" ? undefined : { y: -2 }}
                whileTap={p.id === "pro" ? undefined : { scale: 0.985 }}
                onClick={() => {
                  if (p.id === "pro") return;
                  setSelected(p.id);
                  setCheckoutError(null);
                }}
                className={cn(
                  "relative flex flex-col gap-3 border bg-background p-4 text-left transition-colors",
                  active ? "border-brand" : "border-border hover:border-brand/40 focus-visible:border-brand/40",
                  p.id === "pro" && "cursor-not-allowed opacity-50 hover:border-border"
                )}
              >
                {/* Coming soon: Lemon Squeezy checkout paused pending MoR verification, see docs/RELEASE-CHECKLIST.md */}
                {p.id === "pro" && (
                  <span className="absolute -top-2 right-3 bg-brand px-2 py-0.5 text-[10px] uppercase tracking-wider text-brand-foreground">
                    {t("comingSoon")}
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
                  {yearlyComparePrice && (
                    <span className="text-sm text-muted-foreground line-through">
                      {yearlyComparePrice}
                    </span>
                  )}
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

        <CollapsibleDrawer title={tPromo("disclosureLabel")} defaultOpen={false}>
          <div className="flex flex-col gap-2">
            <div className="flex items-center gap-2">
              <Input
                value={promoCode}
                onChange={(e) => setPromoCode(e.target.value)}
                placeholder={tPromo("placeholder")}
                className="max-w-56"
              />
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={submitPromoCode}
                disabled={promoLoading || !promoCode}
              >
                {promoLoading ? (
                  <>
                    <Loader2 className="me-1.5 h-3.5 w-3.5 animate-spin" />
                    {tPromo("applying")}
                  </>
                ) : (
                  tPromo("submit")
                )}
              </Button>
            </div>
            {promoError && (
              <p role="alert" className="text-xs text-destructive">
                {promoError}
              </p>
            )}
          </div>
        </CollapsibleDrawer>

        {checkoutError && (
          <p role="alert" className="text-xs text-destructive">
            {checkoutError}
          </p>
        )}

      </div>
    </StepShell>
  );
}
