"use client";

import { useState } from "react";
import { useTranslations, useLocale } from "next-intl";
import { useActionError } from "@/lib/i18n/actionError";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import type { ProPricing } from "@/lib/lemonsqueezy/pricing";
import { formatMoney } from "@/lib/utils/format-currency";
import { useLemonSqueezyCheckout } from "@/hooks/use-lemon-squeezy-checkout";
import { Button } from "@/components/ui/button";
import { SegmentedToggle } from "@/components/ui/segmented-toggle";

export type SubscribePanelProps = {
  proPricing: ProPricing;
  returnTo?: string;
};

export function SubscribePanel({ proPricing, returnTo }: SubscribePanelProps) {
  const t = useTranslations("subscribe.owner");
  const tPlans = useTranslations("plans");
  const errMsg = useActionError();
  const locale = useLocale();
  const [cadence, setCadence] = useState<"monthly" | "yearly">("monthly");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const lemonSqueezy = useLemonSqueezyCheckout(() => {
    setLoading(false);
    toast.success(t("upgradeSuccess"));
    // returnTo, if present, is where the gated resource lives (e.g. an
    // inquiry). Full reload (not client nav) so the freshly-webhook-updated
    // plan/everSubscribed is reflected — mirrors settings/billing's own
    // window.location.reload() after checkout success.
    window.location.href = returnTo || "/";
  });

  const monthlyPrice = proPricing.monthly;
  const yearlyPrice = proPricing.yearly;
  const yearlyComparePrice = monthlyPrice * 12;

  async function openCheckout() {
    setError(null);
    setLoading(true);
    try {
      const res = await fetch("/api/billing/checkout", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ plan: "pro", cadence, ...(returnTo ? { returnTo } : {}) }),
      });
      const data = (await res.json().catch(() => ({}))) as {
        checkoutUrl?: string;
        error?: string;
      };
      if (!res.ok) {
        const msg = errMsg(data.error);
        setError(msg);
        toast.error(msg);
        setLoading(false);
        return;
      }
      if (!data.checkoutUrl || !lemonSqueezy.open(data.checkoutUrl)) {
        throw new Error(t("checkoutNotReady"));
      }
      setLoading(false);
    } catch (err) {
      const msg = err instanceof Error ? err.message : t("checkoutFailed");
      setError(msg);
      toast.error(msg);
      setLoading(false);
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <SegmentedToggle
        value={cadence}
        onChange={setCadence}
        ariaLabel={`${t("cadenceToggle.monthly")} / ${t("cadenceToggle.yearly")}`}
        options={[
          { key: "monthly", label: t("cadenceToggle.monthly") },
          { key: "yearly", label: t("cadenceToggle.yearly") },
        ]}
      />
      <div className="flex flex-col gap-0.5 border border-border bg-background px-4 py-3">
        <span className="text-sm font-medium">{tPlans("pro.name")}</span>
        <div className="flex items-baseline gap-1 text-xs text-muted-foreground">
          {cadence === "yearly" ? (
            <>
              <span className="line-through">
                {formatMoney(yearlyComparePrice, proPricing.currency, locale)}
              </span>
              <span className="font-medium text-foreground">
                {formatMoney(yearlyPrice, proPricing.currency, locale)}
              </span>
              <span>{t("perYear")}</span>
            </>
          ) : (
            <span>
              {formatMoney(monthlyPrice, proPricing.currency, locale)} {t("perMonth")}
            </span>
          )}
        </div>
      </div>
      {error && (
        <p role="alert" className="text-xs text-destructive">
          {error}
        </p>
      )}
      <Button disabled={loading} onClick={openCheckout} aria-label={t("subscribeAriaLabel")}>
        {loading ? (
          <>
            <Loader2 className="me-1.5 size-3.5 animate-spin" aria-hidden="true" />
            {t("opening")}
          </>
        ) : (
          t("subscribeButton")
        )}
      </Button>
    </div>
  );
}
