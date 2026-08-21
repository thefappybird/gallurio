"use client";

import { useState } from "react";
import { useTranslations, useLocale } from "next-intl";
import { useActionError } from "@/lib/i18n/actionError";
import { CreditCard, CheckCircle2, AlertCircle, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { PLAN_CATALOG } from "@/lib/lemonsqueezy/plans";
import type { ProPricing } from "@/lib/lemonsqueezy/pricing";
import { formatMoney } from "@/lib/utils/format-currency";
import { BilledAsNote } from "@/components/app/billed-as-note";
import { headlinePrice } from "@/lib/pricing/displayPrice";
import { useLemonSqueezyCheckout } from "@/hooks/use-lemon-squeezy-checkout";
import { getSubscriptionManageUrlAction } from "@/lib/actions/billing";
import { activateBetaTesterAction } from "@/lib/actions/onboarding";
import { redeemPromoCodeAction } from "@/lib/actions/promoCode";
import { BetaPlanCard } from "@/components/app/beta-plan-card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { SegmentedToggle } from "@/components/ui/segmented-toggle";
import { CollapsibleDrawer } from "@/components/ui/collapsible-drawer";
import { cn } from "@/lib/utils";
import type { PlanTier, LemonSqueezySubscriptionStatus } from "@/lib/db/models";

export type BillingPanelProps = {
  currentPlan: PlanTier;
  lsSubscriptionStatus: LemonSqueezySubscriptionStatus | null;
  lsCurrentPeriodEnd: Date | null;
  workspaceId: string;
  customerEmail: string;
  proPricing: ProPricing;
  betaEnabled: boolean;
};

function formatDate(d: Date | null): string {
  if (!d) return "—";
  return new Intl.DateTimeFormat("en-PH", { year: "numeric", month: "long", day: "numeric" }).format(
    new Date(d)
  );
}

export function BillingPanel({
  currentPlan,
  lsSubscriptionStatus,
  lsCurrentPeriodEnd,
  proPricing,
  betaEnabled,
}: BillingPanelProps) {
  const t = useTranslations("app.settings.billing");
  const tPlans = useTranslations("plans");
  const tPromo = useTranslations("common.promoCode");
  const errMsg = useActionError();
  const locale = useLocale();

  // Beta-tester workspaces have full Pro-equivalent access with no Lemon
  // Squeezy subscription behind them (see grantPlan) -- they must never see
  // the LS-catalog-driven upgrade cards or a "manage via Lemon Squeezy" link.
  const isBeta = currentPlan === "beta";
  const isActiveSubscriber =
    currentPlan !== "free" && lsSubscriptionStatus === "active";
  const showBetaTab = betaEnabled && !isActiveSubscriber && !isBeta;

  const [loadingPlan, setLoadingPlan] = useState<PlanTier | null>(null);
  const [checkoutError, setCheckoutError] = useState<string | null>(null);
  const [managingSubscription, setManagingSubscription] = useState(false);
  const [tab, setTab] = useState<"beta" | "monthly" | "yearly">(
    showBetaTab ? "beta" : "monthly"
  );
  const cadence: "monthly" | "yearly" = tab === "yearly" ? "yearly" : "monthly";
  const [activatingBeta, setActivatingBeta] = useState(false);
  const [promoCode, setPromoCode] = useState("");
  const [promoLoading, setPromoLoading] = useState(false);
  const [promoError, setPromoError] = useState<string | null>(null);
  const lemonSqueezy = useLemonSqueezyCheckout(() => {
    setLoadingPlan(null);
    toast.success(t("upgradeSuccess"));
    // Reload page to reflect new plan from server.
    window.location.reload();
  });

  async function activateBeta() {
    setCheckoutError(null);
    setActivatingBeta(true);
    const result = await activateBetaTesterAction();
    setActivatingBeta(false);
    if (result?.error) {
      const msg = errMsg(result.error);
      setCheckoutError(msg);
      toast.error(msg);
      return;
    }
    window.location.reload();
  }

  async function openUpgradeCheckout(plan: PlanTier) {
    if (plan === "free" || plan === currentPlan) return;
    setCheckoutError(null);
    setLoadingPlan(plan);

    try {
      const res = await fetch("/api/billing/checkout", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ plan, cadence }),
      });
      const data = (await res.json().catch(() => ({}))) as {
        checkoutUrl?: string;
        workspaceId?: string;
        error?: string;
      };
      if (!res.ok) {
        const msg = errMsg(data.error);
        setCheckoutError(msg);
        toast.error(msg);
        setLoadingPlan(null);
        return;
      }
      if (!data.checkoutUrl) {
        throw new Error("Missing checkoutUrl in checkout response");
      }
      if (!lemonSqueezy.open(data.checkoutUrl)) {
        throw new Error(t("checkoutNotReady"));
      }
      // The overlay opens synchronously; release the button right away so a
      // dismissed/failed checkout doesn't leave a permanent spinner.
      setLoadingPlan(null);
    } catch (err) {
      const msg = err instanceof Error ? err.message : t("checkoutFailed");
      setCheckoutError(msg);
      toast.error(msg);
      setLoadingPlan(null);
    }
  }

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
    window.location.reload();
  }

  async function openManagePortal() {
    setManagingSubscription(true);
    try {
      const result = await getSubscriptionManageUrlAction();
      if (result.error || !result.url) {
        toast.error(errMsg(result.error));
        return;
      }
      window.open(result.url, "_blank", "noopener,noreferrer");
    } finally {
      setManagingSubscription(false);
    }
  }

  const statusLabel = lsSubscriptionStatus
    ? t(`subscriptionStatus.${lsSubscriptionStatus}`)
    : null;

  return (
    <div className="flex max-w-2xl flex-col gap-6">
      {/* Current plan summary */}
      <div className="flex items-start gap-3 border border-border bg-card p-4">
        <CreditCard className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
        <div className="flex flex-col gap-1">
          <p className="text-sm font-medium">{t("currentPlanLabel")}</p>
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-sm font-semibold capitalize text-foreground">
              {isBeta ? t("betaPlanLabel") : tPlans(`${currentPlan}.name`)}
            </span>
            {statusLabel && (
              <span
                className={cn(
                  "inline-flex items-center gap-1 border px-1.5 py-0.5 text-[10px] uppercase tracking-wider",
                  lsSubscriptionStatus === "active"
                    ? "border-brand/30 bg-brand/10 text-brand"
                    : lsSubscriptionStatus === "past_due" ||
                        lsSubscriptionStatus === "paused"
                      ? "border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-400"
                      : "border-border bg-muted text-muted-foreground"
                )}
              >
                {lsSubscriptionStatus === "active" ? (
                  <CheckCircle2 className="size-2.5" aria-hidden="true" />
                ) : (
                  <AlertCircle className="size-2.5" aria-hidden="true" />
                )}
                {statusLabel}
              </span>
            )}
          </div>
          {lsCurrentPeriodEnd && (
            <p className="text-xs text-muted-foreground">
              {t("renewsOn", { date: formatDate(lsCurrentPeriodEnd) })}
            </p>
          )}
        </div>
      </div>

      {/* Warning for non-active paid subscriptions */}
      {currentPlan !== "free" &&
        lsSubscriptionStatus &&
        lsSubscriptionStatus !== "active" && (
          <div className="flex items-start gap-2 border border-amber-500/40 bg-amber-500/5 p-3 text-sm text-amber-700 dark:text-amber-400">
            <AlertCircle className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
            <p>{t("subscriptionIssue")}</p>
          </div>
        )}

      {/* Inline error */}
      {checkoutError && (
        <p role="alert" className="text-xs text-destructive">
          {checkoutError}
        </p>
      )}

      {/* Beta tester — full access, nothing to upgrade or manage */}
      {isBeta ? (
        <p className="text-sm text-muted-foreground">{t("betaAccessNote")}</p>
      ) : !isActiveSubscriber ? (
        <div className="flex flex-col gap-3">
          <p className="text-xs uppercase tracking-wide text-muted-foreground">
            {t("availablePlans")}
          </p>
          <SegmentedToggle
            value={tab}
            onChange={setTab}
            ariaLabel={
              showBetaTab
                ? `${tPlans("beta.tabLabel")} / ${t("cadenceToggle.monthly")} / ${t("cadenceToggle.yearly")}`
                : `${t("cadenceToggle.monthly")} / ${t("cadenceToggle.yearly")}`
            }
            options={[
              ...(showBetaTab
                ? [{ key: "beta" as const, label: tPlans("beta.tabLabel") }]
                : []),
              { key: "monthly" as const, label: t("cadenceToggle.monthly") },
              { key: "yearly" as const, label: t("cadenceToggle.yearly") },
            ]}
            className="w-fit"
          />
          {tab === "beta" ? (
            <BetaPlanCard
              action={
                <Button
                  type="button"
                  variant="brand"
                  onClick={activateBeta}
                  disabled={activatingBeta}
                  className="w-full"
                >
                  {activatingBeta ? (
                    <>
                      <Loader2 className="me-1.5 size-3.5 animate-spin" aria-hidden="true" />
                      {t("opening")}
                    </>
                  ) : (
                    tPlans("beta.activate")
                  )}
                </Button>
              }
            />
          ) : (
          <div className="flex flex-col gap-2">
            {PLAN_CATALOG.filter((p) => p.id !== "free" && p.id !== currentPlan).map(
              (entry) => {
                const busy = loadingPlan === entry.id;
                // Pro headlines the owner's own currency; BilledAsNote names what
                // Lemon Squeezy charges. A zero-priced plan follows the headline
                // currency rather than showing a stray store-currency zero.
                const proMonthly = headlinePrice(proPricing, "monthly");
                const proYearly = headlinePrice(proPricing, "yearly");
                const monthlyPrice = entry.id === "pro" ? proMonthly.amount : entry.amount;
                const yearlyPrice =
                  entry.id === "pro" ? proYearly.amount : entry.yearlyAmount ?? entry.amount * 12;
                const yearlyComparePrice = monthlyPrice * 12;
                const billed = cadence === "yearly" ? proYearly.billed : proMonthly.billed;
                const currency =
                  entry.id === "pro"
                    ? proMonthly.currency
                    : entry.amount === 0
                      ? proMonthly.currency
                      : entry.currency;
                return (
                  <div
                    key={entry.id}
                    className="flex items-center justify-between gap-4 border border-border bg-background px-4 py-3"
                  >
                    <div className="flex flex-col gap-0.5">
                      <span className="text-sm font-medium">{tPlans(`${entry.id}.name`)}</span>
                      <div className="flex items-baseline gap-1 text-xs text-muted-foreground">
                        {cadence === "yearly" ? (
                          <>
                            <span className="line-through">
                              {formatMoney(yearlyComparePrice, currency, locale)}
                            </span>
                            <span className="font-medium text-foreground">
                              {formatMoney(yearlyPrice, currency, locale)}
                            </span>
                            <span>{t("perYear")}</span>
                          </>
                        ) : (
                          <span>
                            {formatMoney(monthlyPrice, currency, locale)} {t("perMonth")}
                          </span>
                        )}
                      </div>
                      {entry.id === "pro" && billed && (
                        <BilledAsNote amount={billed.amount} currency={billed.currency} />
                      )}
                    </div>
                    <Button
                      size="sm"
                      disabled={!!loadingPlan}
                      onClick={() => openUpgradeCheckout(entry.id)}
                      aria-label={t("upgradeToAriaLabel", { plan: tPlans(`${entry.id}.name`) })}
                    >
                      {busy ? (
                        <>
                          <Loader2 className="me-1.5 size-3.5 animate-spin" aria-hidden="true" />
                          {t("opening")}
                        </>
                      ) : (
                        t("upgradeTo", { plan: tPlans(`${entry.id}.name`) })
                      )}
                    </Button>
                  </div>
                );
              }
            )}
          </div>
          )}
        </div>
      ) : (
        /* Active subscriber — link to Lemon Squeezy's self-service portal */
        <div className="flex flex-col gap-2">
          <p className="text-xs uppercase tracking-wide text-muted-foreground">
            {t("manageSection")}
          </p>
          <p className="text-sm text-muted-foreground">{t("manageDescription")}</p>
          <Button
            size="sm"
            variant="outline"
            disabled={managingSubscription}
            onClick={openManagePortal}
            className="w-fit"
          >
            {managingSubscription ? (
              <>
                <Loader2 className="me-1.5 size-3.5 animate-spin" aria-hidden="true" />
                {t("opening")}
              </>
            ) : (
              t("manageButton")
            )}
          </Button>
        </div>
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
                  <Loader2 className="me-1.5 size-3.5 animate-spin" aria-hidden="true" />
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
    </div>
  );
}
