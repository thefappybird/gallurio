"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "@/lib/i18n/navigation";
import { AnimatePresence, motion } from "motion/react";
import { useTranslations, useLocale } from "next-intl";
import { Check, Loader2, TicketPercent, X } from "lucide-react";
import { toast } from "sonner";
import type { OnboardingStep, PlanTier } from "@/lib/db/models";
import { selectFreePlanAction, activateBetaTesterAction } from "@/lib/actions/onboarding";
import { redeemPromoCodeAction } from "@/lib/actions/promoCode";
import { PLAN_CATALOG, type PlanCatalogEntry } from "@/lib/lemonsqueezy/plans";
import type { ProPricing } from "@/lib/lemonsqueezy/pricing";
import { formatMoney } from "@/lib/utils/format-currency";
import { BilledAsNote } from "@/components/app/billed-as-note";
import { BetaPlanCard } from "@/components/app/beta-plan-card";
import { PlanCard } from "@/components/app/plan-card";
import { SavePill } from "@/components/app/save-pill";
import { headlinePrice } from "@/lib/pricing/displayPrice";
import { useActionError } from "@/lib/i18n/actionError";
import { useLemonSqueezyCheckout } from "@/hooks/use-lemon-squeezy-checkout";
import { StepShell, StepBackButton, isStepCompleted } from "../_components/step-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { SegmentedToggle } from "@/components/ui/segmented-toggle";
import { cn } from "@/lib/utils";

export function PlanStepForm({
  currentPlan,
  planChoiceLocked = false,
  activation = null,
  acceptedPromoCode = null,
  furthestStep,
  proPricing,
  betaTesterEnabled = false,
}: {
  currentPlan: string;
  planChoiceLocked?: boolean;
  activation?: "free" | "pro" | "beta" | "promo" | null;
  acceptedPromoCode?: string | null;
  furthestStep: OnboardingStep;
  proPricing: ProPricing;
  betaTesterEnabled?: boolean;
}) {
  const t = useTranslations("onboarding.plan");
  const tPlans = useTranslations("plans");
  const errMsg = useActionError();
  const locale = useLocale();
  const router = useRouter();
  const [selected, setSelected] = useState<PlanTier>(currentPlan === "pro" ? "pro" : "free");
  const [tab, setTab] = useState<"beta" | "monthly" | "yearly">(
    betaTesterEnabled ? "beta" : "monthly"
  );
  const cadence: "monthly" | "yearly" = tab === "yearly" ? "yearly" : "monthly";
  const [loading, setLoading] = useState(false);
  const [checkoutError, setCheckoutError] = useState<string | null>(null);
  const [promoError, setPromoError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const lemonSqueezy = useLemonSqueezyCheckout(() => {
    router.refresh();
    router.push("/onboarding/done");
  });

  async function submit() {
    if (planChoiceLocked) {
      router.push("/onboarding/done");
      return;
    }
    if (tab === "beta") {
      activateBeta();
      return;
    }
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
        router.refresh();
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
    if (planChoiceLocked) return;
    setCheckoutError(null);
    startTransition(async () => {
      const result = await activateBetaTesterAction();
      if (result?.error) {
        toast.error(errMsg(result.error));
        return;
      }
      router.refresh();
      router.push("/onboarding/done");
    });
  }

  // Pro headlines the visitor's own currency (BilledAsNote names the charged
  // amount underneath). A zero-priced plan carries no currency of its own, so
  // it follows the headline currency rather than showing a stray store-currency
  // zero next to it.
  const proHeadline = headlinePrice(proPricing, cadence);
  const proMonthlyHeadline = headlinePrice(proPricing, "monthly");

  function displayFor(
    p: PlanCatalogEntry,
    cadence: "monthly" | "yearly"
  ): { amount: number; currency: string } {
    if (p.id === "pro") return { amount: proHeadline.amount, currency: proHeadline.currency };
    const amount = cadence === "yearly" && p.yearlyAmount ? p.yearlyAmount : p.amount;
    return { amount, currency: amount === 0 ? proHeadline.currency : proPricing.currency };
  }

  const busy = loading || pending;
  const selectedEntry = PLAN_CATALOG.find((p) => p.id === selected);
  const selectedDisplay = selectedEntry ? displayFor(selectedEntry, cadence) : null;
  const selectedPrice = selectedDisplay
    ? formatMoney(selectedDisplay.amount, selectedDisplay.currency, locale, {
        maximumFractionDigits: selectedDisplay.amount < 100 ? 2 : 0,
      })
    : "";
  // While beta is on, Monthly/Annual only ever offer Pro — Free is hidden.
  const visiblePlans = betaTesterEnabled ? PLAN_CATALOG.filter((p) => p.id === "pro") : PLAN_CATALOG;

  const cta =
    planChoiceLocked
      ? t("finishOnboarding")
      : tab === "beta"
      ? tPlans("beta.activate")
      : selected === "free"
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
                {tab === "beta" || selected === "free" ? t("settingUp") : t("opening")}
              </>
            ) : (
              cta
            )}
          </Button>
        </div>
      }
    >
      <div className="flex flex-col gap-2">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
          <div className="flex items-center gap-2">
            <SegmentedToggle
              value={tab}
              onChange={setTab}
              disabled={planChoiceLocked}
              ariaLabel={
                betaTesterEnabled
                  ? `${tPlans("beta.tabLabel")} / ${t("cadenceToggle.monthly")} / ${t("cadenceToggle.yearly")}`
                  : `${t("cadenceToggle.monthly")} / ${t("cadenceToggle.yearly")}`
              }
              options={[
                ...(betaTesterEnabled
                  ? [{ key: "beta" as const, label: tPlans("beta.tabLabel") }]
                  : []),
                { key: "monthly" as const, label: t("cadenceToggle.monthly") },
                { key: "yearly" as const, label: t("cadenceToggle.yearly") },
              ]}
            />
          </div>
          <div className="hidden w-72 sm:block">
            <PromoCodePanel
              planChoiceLocked={planChoiceLocked}
              acceptedPromoCode={acceptedPromoCode}
              promoError={promoError}
              onPromoError={setPromoError}
              errorId="onboarding-promo-error-desktop"
            />
          </div>
        </div>

        {promoError && (
          <p
            id="onboarding-promo-error-desktop"
            data-testid="promo-error"
            role="alert"
            className="hidden text-xs text-destructive sm:block ml-auto"
          >
            {promoError}
          </p>
        )}

        {tab === "beta" ? (
          // The step footer owns the activate CTA here, the same way it
          // commits a Monthly/Annual card selection. The card only reports
          // state, so the step keeps one primary action.
          <BetaPlanCard
            className="mt-2"
            action={
              planChoiceLocked && activation === "beta" ? (
                <span className="w-fit bg-brand px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-brand-foreground">
                  {t("activePill")}
                </span>
              ) : undefined
            }
          />
        ) : (
          <>
            <div
              className={cn(
                "grid grid-cols-1 mt-2 gap-3",
                visiblePlans.length > 1 && "md:grid-cols-2"
              )}
            >
              {visiblePlans.map((p) => {
                const active = selected === p.id;
                const display = displayFor(p, cadence);
                const price = formatMoney(display.amount, display.currency, locale, {
                  maximumFractionDigits: display.amount < 100 ? 2 : 0,
                });
                const yearlyComparePrice =
                  p.id === "pro" && cadence === "yearly"
                    ? formatMoney(
                        proMonthlyHeadline.amount * 12,
                        proMonthlyHeadline.currency,
                        locale
                      )
                    : null;
                const cadenceLabel =
                  p.amount === 0
                    ? t("cadence.forever")
                    : cadence === "yearly"
                      ? t("cadence.yearly")
                      : t("cadence.monthly");
                const isCurrentPlan = activation === p.id;
                const disabled = planChoiceLocked && !isCurrentPlan;
                return (
                  <PlanCard
                    key={p.id}
                    name={tPlans(`${p.id}.name`)}
                    badge={
                      <>
                        {p.id === "pro" && cadence === "yearly" && !isCurrentPlan ? (
                          <SavePill label={t("cadenceToggle.savePill")} />
                        ) : null}
                        {isCurrentPlan ? (
                          <span className="bg-brand px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-brand-foreground">
                            {t("activePill")}
                          </span>
                        ) : active && !planChoiceLocked ? (
                          <span className="flex h-5 w-5 items-center justify-center bg-brand text-brand-foreground">
                            <Check className="h-3.5 w-3.5" />
                          </span>
                        ) : null}
                      </>
                    }
                    comparePrice={yearlyComparePrice}
                    price={price}
                    priceSuffix={cadenceLabel}
                    billed={
                      p.id === "pro" && proHeadline.billed ? (
                        <BilledAsNote
                          amount={proHeadline.billed.amount}
                          currency={proHeadline.billed.currency}
                        />
                      ) : null
                    }
                    tagline={tPlans(`${p.id}.tagline`)}
                    features={p.featureKeys.map((key) => tPlans(key.replace(/^plans\./, "")))}
                    selected={active}
                    disabled={disabled}
                    onSelect={() => {
                      if (disabled) return;
                      setSelected(p.id);
                      setCheckoutError(null);
                    }}
                  />
                );
              })}
            </div>

            {selected !== "free" && (
              <p className="text-xs text-muted-foreground">{t("checkoutNote")}</p>
            )}
          </>
        )}

        <div className="sm:hidden">
          <PromoCodePanel
            planChoiceLocked={planChoiceLocked}
            acceptedPromoCode={acceptedPromoCode}
            promoError={promoError}
            onPromoError={setPromoError}
            errorId="onboarding-promo-error-mobile"
          />
        </div>

        {promoError && (
          <p
            id="onboarding-promo-error-mobile"
            data-testid="promo-error"
            role="alert"
            className="text-xs text-destructive sm:hidden"
          >
            {promoError}
          </p>
        )}

        {planChoiceLocked && (
          <p role="status" className="border border-brand bg-brand/5 px-3 py-2 text-sm text-foreground">
            {t("activatedNotice")}
          </p>
        )}

        {checkoutError && (
          <p role="alert" className="text-xs text-destructive">
            {checkoutError}
          </p>
        )}

      </div>
    </StepShell>
  );
}

function PromoCodePanel({
  planChoiceLocked,
  acceptedPromoCode,
  promoError,
  onPromoError,
  errorId,
}: {
  planChoiceLocked: boolean;
  acceptedPromoCode: string | null;
  promoError: string | null;
  onPromoError: (error: string | null) => void;
  errorId: string;
}) {
  const t = useTranslations("onboarding.plan");
  const tPromo = useTranslations("common.promoCode");
  const errMsg = useActionError();
  const router = useRouter();
  const [promoCode, setPromoCode] = useState("");
  const [promoLoading, setPromoLoading] = useState(false);
  const [promoOpen, setPromoOpen] = useState(false);
  const promoInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (promoOpen) promoInputRef.current?.focus({ preventScroll: true });
  }, [promoOpen]);

  async function submitPromoCode() {
    onPromoError(null);
    setPromoLoading(true);
    const result = await redeemPromoCodeAction(promoCode, { onboarding: true });
    setPromoLoading(false);
    if ("error" in result) {
      const message = errMsg(result.error);
      onPromoError(message);
      toast.error(message);
      return;
    }
    toast.success(tPromo(result.startsImmediately ? "success" : "successQueued"));
    router.refresh();
    router.push("/onboarding/done");
  }

  if (acceptedPromoCode) {
    return (
      <div className="flex h-9 items-center gap-2 border border-border bg-card px-3 text-card-foreground">
        <Check className="h-4 w-4 shrink-0 text-brand" aria-hidden="true" />
        <span className="min-w-0 truncate text-sm font-medium">
          {t("acceptedPromoCode", { code: acceptedPromoCode })}
        </span>
      </div>
    );
  }

  return (
    <div className="text-card-foreground">
        <div
          data-testid="promo-code-container"
          className={cn(promoOpen && "border border-border bg-card")}
        >
          <div className={cn("relative", promoOpen && "h-12")}>
          <AnimatePresence initial={false}>
            {promoOpen ? (
              <motion.div
                key="promo-form"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.12, ease: "easeOut" }}
                className="absolute inset-0 flex items-center gap-2 p-2"
              >
                <Input ref={promoInputRef} value={promoCode} onChange={(event) => { setPromoCode(event.target.value); onPromoError(null); }} placeholder={tPromo("placeholder")} aria-describedby={promoError ? errorId : undefined} className="min-w-0 flex-1" />
                <Button type="button" variant="outline" size="sm" onClick={submitPromoCode} disabled={promoLoading || !promoCode || planChoiceLocked}>
                  {promoLoading ? <><Loader2 className="me-1.5 h-3.5 w-3.5 animate-spin" />{tPromo("applying")}</> : tPromo("submit")}
                </Button>
                <Button type="button" variant="ghost" size="icon" aria-label={tPromo("close")} disabled={promoLoading} onClick={() => { setPromoOpen(false); onPromoError(null); }}><X /></Button>
              </motion.div>
            ) : (
              <motion.button
                key="promo-toggle"
                type="button"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.12, ease: "easeOut" }}
                onClick={() => setPromoOpen(true)}
                disabled={planChoiceLocked}
                className="flex h-9 w-full items-center gap-2 border border-border bg-background px-3 text-sm font-medium text-muted-foreground transition-colors hover:border-foreground/20 hover:bg-accent/40 hover:text-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-60"
              >
                <TicketPercent className="h-4 w-4 shrink-0" />
                <span>{tPromo("disclosureLabel")}</span>
              </motion.button>
            )}
          </AnimatePresence>
          </div>
        </div>
      </div>
  );
}
