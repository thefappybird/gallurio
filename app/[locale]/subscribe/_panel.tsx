"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { AnimatePresence, motion } from "motion/react";
import { useLocale, useTranslations } from "next-intl";
import { useRouter } from "@/lib/i18n/navigation";
import { Check, Loader2, TicketPercent, X } from "lucide-react";
import { toast } from "sonner";
import type { ProPricing } from "@/lib/lemonsqueezy/pricing";
import { activateBetaRecoveryAction } from "@/lib/actions/subscriptionRecovery";
import { redeemPromoCodeAction } from "@/lib/actions/promoCode";
import { useActionError } from "@/lib/i18n/actionError";
import { useLemonSqueezyCheckout } from "@/hooks/use-lemon-squeezy-checkout";
import { formatMoney } from "@/lib/utils/format-currency";
import { BilledAsNote } from "@/components/app/billed-as-note";
import { headlinePrice } from "@/lib/pricing/displayPrice";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { SegmentedToggle } from "@/components/ui/segmented-toggle";
import { cn } from "@/lib/utils";

export type SubscribePanelProps = {
  proPricing: ProPricing;
  returnTo?: string;
  billingAvailable?: boolean;
  betaAvailable?: boolean;
};

/** Recovery controls for a workspace that is currently behind the access gate. */
export function SubscribePanel({
  proPricing,
  returnTo,
  billingAvailable = true,
  betaAvailable = false,
}: SubscribePanelProps) {
  const t = useTranslations("subscribe.owner");
  const tPlan = useTranslations("onboarding.plan");
  const tPlans = useTranslations("plans");
  const errMsg = useActionError();
  const locale = useLocale();
  const router = useRouter();
  const [cadence, setCadence] = useState<"monthly" | "yearly">("monthly");
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
  }, billingAvailable);

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

  return (
    <div className="flex flex-col gap-5">
      {billingAvailable && (
        <div className="flex items-center gap-2">
          <SegmentedToggle
            value={cadence}
            onChange={setCadence}
            disabled={busy}
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
      )}

      {betaAvailable && (
        <div className="flex flex-col items-start justify-between gap-3 border border-brand bg-brand/5 p-4 sm:flex-row sm:items-center">
          <div>
            <span className="text-[10px] font-semibold uppercase tracking-wider text-brand">
              {tPlan("betaTester.label")}
            </span>
            <h2 className="font-heading text-lg font-semibold">{tPlan("betaTester.headline")}</h2>
          </div>
          <Button type="button" variant="brand" size="lg" onClick={activateBeta} disabled={busy} className="w-full sm:w-auto">
            {pending ? <><Loader2 className="me-1.5 size-3.5 animate-spin" />{tPlan("settingUp")}</> : tPlan("betaTester.activate")}
          </Button>
        </div>
      )}

      <div className="relative flex flex-col gap-3 border border-brand bg-background p-4">
        {!billingAvailable && <span className="absolute -top-2 end-3 bg-brand px-2 py-0.5 text-[10px] uppercase tracking-wider text-brand-foreground">{tPlan("comingSoon")}</span>}
        <div className="flex items-baseline justify-between">
          <h2 className="font-heading text-lg font-semibold">{tPlans("pro.name")}</h2>
          {billingAvailable && <span className="flex size-5 items-center justify-center bg-brand text-brand-foreground"><Check className="size-3.5" /></span>}
        </div>
        <div className="flex items-baseline gap-1">
          {cadence === "yearly" && <span className="text-sm text-muted-foreground line-through">{formatMoney(monthlyHeadline.amount * 12, monthlyHeadline.currency, locale)}</span>}
          <span className="font-heading text-2xl font-semibold">{selectedPrice}</span>
          <span className="text-xs text-muted-foreground">{cadence === "yearly" ? tPlan("cadence.yearly") : tPlan("cadence.monthly")}</span>
        </div>
        {headline.billed && (
          <BilledAsNote amount={headline.billed.amount} currency={headline.billed.currency} />
        )}
        <p className="text-xs text-muted-foreground">{tPlans("pro.tagline")}</p>
      </div>

      <PromoCodePanel disabled={busy} onSuccess={resumeWorkspace} />
      {error && <p role="alert" className="text-xs text-destructive">{error}</p>}

      {billingAvailable && (
        <Button disabled={busy} onClick={openCheckout} aria-label={t("subscribeAriaLabel")}>
          {loading ? <><Loader2 className="me-1.5 size-3.5 animate-spin" />{t("opening")}</> : tPlan("ctaPaid", { price: selectedPrice })}
        </Button>
      )}
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
              <Input ref={inputRef} value={code} onChange={(event) => setCode(event.target.value)} placeholder={t("placeholder")} className="min-w-0 flex-1" />
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
      {error && open && <p role="alert" className="border-t border-border px-3 py-2 text-xs text-destructive">{error}</p>}
    </div>
  );
}
