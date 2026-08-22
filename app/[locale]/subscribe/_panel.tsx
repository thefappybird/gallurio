"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { AnimatePresence, motion } from "motion/react";
import { useLocale, useTranslations } from "next-intl";
import { useRouter } from "@/lib/i18n/navigation";
import { Loader2, TicketPercent, X } from "lucide-react";
import { toast } from "sonner";
import type { ProPricing } from "@/lib/lemonsqueezy/pricing";
import { activateBetaRecoveryAction } from "@/lib/actions/subscriptionRecovery";
import { redeemPromoCodeAction } from "@/lib/actions/promoCode";
import { useActionError } from "@/lib/i18n/actionError";
import { useLemonSqueezyCheckout } from "@/hooks/use-lemon-squeezy-checkout";
import { formatMoney } from "@/lib/utils/format-currency";
import { BilledAsNote } from "@/components/app/billed-as-note";
import { BetaPlanCard } from "@/components/app/beta-plan-card";
import { PlanCard } from "@/components/app/plan-card";
import { SavePill } from "@/components/app/save-pill";
import { getPlanCatalog } from "@/lib/lemonsqueezy/plans";
import { headlinePrice } from "@/lib/pricing/displayPrice";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { SegmentedToggle } from "@/components/ui/segmented-toggle";
import { cn } from "@/lib/utils";

export type SubscribePanelProps = {
  proPricing: ProPricing;
  returnTo?: string;
  betaAvailable?: boolean;
};

/** Recovery controls for a workspace that is currently behind the access gate. */
export function SubscribePanel({
  proPricing,
  returnTo,
  betaAvailable = false,
}: SubscribePanelProps) {
  const t = useTranslations("subscribe.owner");
  const tPlan = useTranslations("onboarding.plan");
  const tPlans = useTranslations("plans");
  const errMsg = useActionError();
  const locale = useLocale();
  const router = useRouter();
  const [tab, setTab] = useState<"beta" | "monthly" | "yearly">(
    betaAvailable ? "beta" : "monthly"
  );
  const cadence: "monthly" | "yearly" = tab === "yearly" ? "yearly" : "monthly";
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function resumeWorkspace() {
    router.refresh();
    window.location.assign(returnTo || "/");
  }

  const lemonSqueezy = useLemonSqueezyCheckout(() => {
    setLoading(false);
    toast.success(t("upgradeSuccess"));
    resumeWorkspace();
  });

  async function openCheckout() {
    setError(null);
    setLoading(true);
    try {
      const res = await fetch("/api/billing/checkout", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ plan: "pro", cadence, ...(returnTo ? { returnTo } : {}) }),
      });
      const data = (await res.json().catch(() => ({}))) as { checkoutUrl?: string; error?: string };
      if (!res.ok) throw new Error(data.error ?? "checkout_init_failed");
      if (!data.checkoutUrl || !lemonSqueezy.open(data.checkoutUrl)) {
        throw new Error(t("checkoutNotReady"));
      }
    } catch (err) {
      const message = err instanceof Error ? errMsg(err.message) : t("checkoutFailed");
      setError(message);
      toast.error(message);
    } finally {
      setLoading(false);
    }
  }

  function activateBeta() {
    setError(null);
    startTransition(async () => {
      const result = await activateBetaRecoveryAction();
      if (result.error) {
        const message = errMsg(result.error);
        setError(message);
        toast.error(message);
        return;
      }
      resumeWorkspace();
    });
  }

  const busy = loading || pending;
  // Headline in the visitor's own currency; the charged amount is named by
  // BilledAsNote underneath.
  const headline = headlinePrice(proPricing, cadence);
  const monthlyHeadline = headlinePrice(proPricing, "monthly");
  const selectedPrice = formatMoney(headline.amount, headline.currency, locale, {
    maximumFractionDigits: headline.amount < 100 ? 2 : 0,
  });
  const proFeatures = getPlanCatalog("pro").featureKeys.map((key) =>
    tPlans(key.replace(/^plans\./, ""))
  );

  return (
    <div className="flex flex-col gap-5">
      <div className="flex items-center gap-2">
        <SegmentedToggle
          value={tab}
          onChange={setTab}
          disabled={busy}
          ariaLabel={
            betaAvailable
              ? `${tPlans("beta.tabLabel")} / ${t("cadenceToggle.monthly")} / ${t("cadenceToggle.yearly")}`
              : `${t("cadenceToggle.monthly")} / ${t("cadenceToggle.yearly")}`
          }
          options={[
            ...(betaAvailable
              ? [{ key: "beta" as const, label: tPlans("beta.tabLabel") }]
              : []),
            { key: "monthly" as const, label: t("cadenceToggle.monthly") },
            { key: "yearly" as const, label: t("cadenceToggle.yearly") },
          ]}
        />
      </div>

      {tab === "beta" ? (
        <BetaPlanCard
          action={
            <Button
              type="button"
              variant="brand"
              onClick={activateBeta}
              disabled={busy}
              className="w-full"
            >
              {pending ? (
                <>
                  <Loader2 className="me-1.5 size-3.5 animate-spin" />
                  {tPlan("settingUp")}
                </>
              ) : (
                tPlans("beta.activate")
              )}
            </Button>
          }
        />
      ) : (
        <PlanCard
          name={tPlans("pro.name")}
          badge={cadence === "yearly" ? <SavePill label={t("cadenceToggle.savePill")} /> : null}
          comparePrice={
            cadence === "yearly"
              ? formatMoney(monthlyHeadline.amount * 12, monthlyHeadline.currency, locale)
              : null
          }
          price={selectedPrice}
          priceSuffix={cadence === "yearly" ? tPlan("cadence.yearly") : tPlan("cadence.monthly")}
          billed={
            headline.billed ? (
              <BilledAsNote amount={headline.billed.amount} currency={headline.billed.currency} />
            ) : null
          }
          tagline={tPlans("pro.tagline")}
          features={proFeatures}
          featured
          action={
            <Button
              className="w-full"
              variant="brand"
              disabled={busy}
              onClick={openCheckout}
              aria-label={t("subscribeAriaLabel")}
            >
              {loading ? (
                <>
                  <Loader2 className="me-1.5 size-3.5 animate-spin" />
                  {t("opening")}
                </>
              ) : (
                tPlan("ctaPaid", { price: selectedPrice })
              )}
            </Button>
          }
        />
      )}

      <PromoCodePanel disabled={busy} onSuccess={resumeWorkspace} />
      {error && <p role="alert" className="text-xs text-destructive">{error}</p>}
    </div>
  );
}

function PromoCodePanel({ disabled, onSuccess }: { disabled: boolean; onSuccess: () => void }) {
  const t = useTranslations("common.promoCode");
  const errMsg = useActionError();
  const [code, setCode] = useState("");
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => { if (open) inputRef.current?.focus({ preventScroll: true }); }, [open]);

  async function submit() {
    setError(null);
    setLoading(true);
    const result = await redeemPromoCodeAction(code);
    setLoading(false);
    if ("error" in result) {
      const message = errMsg(result.error);
      setError(message);
      toast.error(message);
      return;
    }
    toast.success(t(result.startsImmediately ? "success" : "successQueued"));
    onSuccess();
  }

  return (
    <div className={cn("text-card-foreground", open && "border border-border bg-card")}>
      <div className={cn("relative", open && "h-12")}>
        <AnimatePresence initial={false}>
          {open ? (
            <motion.div key="form" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.12 }} className="absolute inset-0 flex items-center gap-2 p-2">
              <Input ref={inputRef} value={code} onChange={(event) => setCode(event.target.value)} placeholder={t("placeholder")} aria-invalid={error ? true : undefined} aria-describedby={error ? "subscribe-promo-error" : undefined} className="min-w-0 flex-1" />
              <Button type="button" variant="outline" size="sm" onClick={submit} disabled={disabled || loading || !code}>
                {loading ? <><Loader2 className="me-1.5 size-3.5 animate-spin" />{t("applying")}</> : t("submit")}
              </Button>
              <Button type="button" variant="ghost" size="icon" aria-label={t("close")} disabled={loading} onClick={() => { setOpen(false); setError(null); }}><X /></Button>
            </motion.div>
          ) : (
            <motion.button key="toggle" type="button" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.12 }} onClick={() => setOpen(true)} disabled={disabled} className="flex h-9 w-full items-center gap-2 border border-border bg-background px-3 text-sm font-medium text-muted-foreground transition-colors hover:border-foreground/20 hover:bg-accent/40 hover:text-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-60">
              <TicketPercent className="size-4 shrink-0" /><span>{t("disclosureLabel")}</span>
            </motion.button>
          )}
        </AnimatePresence>
      </div>
      {error && open && <p id="subscribe-promo-error" role="alert" className="border-t border-border px-3 py-2 text-xs text-destructive">{error}</p>}
    </div>
  );
}
