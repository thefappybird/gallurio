"use client";

import { useState, useEffect, useRef } from "react";
import { useTranslations } from "next-intl";
import { useActionError } from "@/lib/i18n/actionError";
import { CreditCard, CheckCircle2, AlertCircle, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { initializePaddle, type Paddle } from "@paddle/paddle-js";
import { PLAN_CATALOG } from "@/lib/paddle/plans";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { PlanTier, PaddleSubscriptionStatus } from "@/lib/db/models";

export type BillingPanelProps = {
  currentPlan: PlanTier;
  paddleSubscriptionStatus: PaddleSubscriptionStatus | null;
  paddleCurrentPeriodEnd: Date | null;
  workspaceId: string;
  customerEmail: string;
  proPricing: { monthly: number };
};

function formatPHP(amount: number): string {
  if (amount === 0) return "₱0";
  return `₱${amount.toLocaleString("en-PH")}`;
}

function formatDate(d: Date | null): string {
  if (!d) return "—";
  return new Intl.DateTimeFormat("en-PH", { year: "numeric", month: "long", day: "numeric" }).format(
    new Date(d)
  );
}

export function BillingPanel({
  currentPlan,
  paddleSubscriptionStatus,
  paddleCurrentPeriodEnd,
  workspaceId,
  customerEmail,
  proPricing,
}: BillingPanelProps) {
  const t = useTranslations("app.settings.billing");
  const tPlans = useTranslations("plans");
  const errMsg = useActionError();

  const [loadingPlan, setLoadingPlan] = useState<PlanTier | null>(null);
  const [checkoutError, setCheckoutError] = useState<string | null>(null);
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
          setLoadingPlan(null);
          toast.success(t("upgradeSuccess"));
          // Reload page to reflect new plan from server.
          window.location.reload();
        } else if (e.name === "checkout.closed" || e.name === "checkout.error") {
          // Overlay dismissed or failed to render — release the button so the
          // user can retry instead of staring at a permanent spinner.
          setLoadingPlan(null);
        }
      },
    })
      .then((p) => {
        paddleRef.current = p ?? null;
      })
      .catch((err) => {
        console.warn("[billing-panel] Paddle init failed:", err);
      });
  }, [paddleTokenMissing, t]);

  async function openUpgradeCheckout(plan: PlanTier) {
    if (plan === "free" || plan === currentPlan) return;
    setCheckoutError(null);
    setLoadingPlan(plan);

    try {
      const res = await fetch("/api/billing/checkout", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ plan }),
      });
      const data = (await res.json().catch(() => ({}))) as {
        priceId?: string;
        customerEmail?: string;
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
      if (!data.priceId) {
        throw new Error("Missing priceId in checkout response");
      }
      if (!paddleRef.current) {
        throw new Error(t("paddleNotReady"));
      }

      paddleRef.current.Checkout.open({
        items: [{ priceId: data.priceId, quantity: 1 }],
        customer: { email: data.customerEmail ?? customerEmail },
        customData: { workspaceId: data.workspaceId ?? workspaceId },
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : t("checkoutFailed");
      setCheckoutError(msg);
      toast.error(msg);
      setLoadingPlan(null);
    }
  }

  const isActiveSubscriber =
    currentPlan !== "free" && paddleSubscriptionStatus === "active";

  const statusLabel = paddleSubscriptionStatus
    ? t(`subscriptionStatus.${paddleSubscriptionStatus}`)
    : null;

  return (
    <div className="flex flex-col gap-6">
      {/* Current plan summary */}
      <div className="flex items-start gap-3 border border-border bg-card p-4">
        <CreditCard className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
        <div className="flex flex-col gap-1">
          <p className="text-sm font-medium">{t("currentPlanLabel")}</p>
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-sm font-semibold capitalize text-foreground">
              {tPlans(`${currentPlan}.name`)}
            </span>
            {statusLabel && (
              <span
                className={cn(
                  "inline-flex items-center gap-1 border px-1.5 py-0.5 text-[10px] uppercase tracking-wider",
                  paddleSubscriptionStatus === "active"
                    ? "border-brand/30 bg-brand/10 text-brand"
                    : paddleSubscriptionStatus === "past_due" ||
                        paddleSubscriptionStatus === "paused"
                      ? "border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-400"
                      : "border-border bg-muted text-muted-foreground"
                )}
              >
                {paddleSubscriptionStatus === "active" ? (
                  <CheckCircle2 className="size-2.5" aria-hidden="true" />
                ) : (
                  <AlertCircle className="size-2.5" aria-hidden="true" />
                )}
                {statusLabel}
              </span>
            )}
          </div>
          {paddleCurrentPeriodEnd && (
            <p className="text-xs text-muted-foreground">
              {t("renewsOn", { date: formatDate(paddleCurrentPeriodEnd) })}
            </p>
          )}
        </div>
      </div>

      {/* Warning for non-active paid subscriptions */}
      {currentPlan !== "free" &&
        paddleSubscriptionStatus &&
        paddleSubscriptionStatus !== "active" && (
          <div className="flex items-start gap-2 border border-amber-500/40 bg-amber-500/5 p-3 text-sm text-amber-700 dark:text-amber-400">
            <AlertCircle className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
            <p>{t("subscriptionIssue")}</p>
          </div>
        )}

      {/* Dev token missing notice */}
      {paddleTokenMissing && process.env.NODE_ENV !== "production" && (
        <p className="text-xs text-amber-700 dark:text-amber-400">
          {t("paddleTokenMissingDev")}
        </p>
      )}

      {/* Inline error */}
      {checkoutError && (
        <p role="alert" className="text-xs text-destructive">
          {checkoutError}
        </p>
      )}

      {/* Upgrade section — shown for free/starter users */}
      {!isActiveSubscriber || currentPlan === "starter" ? (
        <div className="flex flex-col gap-3">
          <p className="text-xs uppercase tracking-wide text-muted-foreground">
            {t("availablePlans")}
          </p>
          <div className="flex flex-col gap-2">
            {PLAN_CATALOG.filter((p) => p.id !== "free" && p.id !== currentPlan).map(
              (entry) => {
                const busy = loadingPlan === entry.id;
                return (
                  <div
                    key={entry.id}
                    className="flex items-center justify-between gap-4 border border-border bg-background px-4 py-3"
                  >
                    <div className="flex flex-col gap-0.5">
                      <span className="text-sm font-medium">{tPlans(`${entry.id}.name`)}</span>
                      <span className="text-xs text-muted-foreground">
                        {formatPHP(entry.id === "pro" ? proPricing.monthly : entry.amount)}{" "}
                        <span className="text-muted-foreground">{t("perMonth")}</span>
                      </span>
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
        </div>
      ) : (
        /* Active subscriber — show manage notice */
        <div className="flex flex-col gap-2">
          <p className="text-xs uppercase tracking-wide text-muted-foreground">
            {t("manageSection")}
          </p>
          <p className="text-sm text-muted-foreground">{t("manageDescription")}</p>
          <p className="text-xs text-muted-foreground">{t("cancelNote")}</p>
        </div>
      )}
    </div>
  );
}
