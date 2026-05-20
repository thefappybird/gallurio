"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { motion } from "motion/react";
import { Loader2, CheckCircle2, ExternalLink } from "lucide-react";
import { skipPaymentsStepAction, advanceFromPaymentsAction } from "@/lib/actions/onboarding";
import { StepShell } from "../_components/step-shell";
import { PaymentsIllustration } from "../_components/illustrations";
import { Button } from "@/components/ui/button";

type Status = {
  connected: boolean;
  chargesEnabled?: boolean;
  payoutsEnabled?: boolean;
  detailsSubmitted?: boolean;
};

export function PaymentsStepForm({
  hasAccount,
  chargesEnabled,
  detailsSubmitted,
}: {
  hasAccount: boolean;
  chargesEnabled: boolean;
  detailsSubmitted: boolean;
}) {
  const router = useRouter();
  const params = useSearchParams();
  const [status, setStatus] = useState<Status>({
    connected: hasAccount,
    chargesEnabled,
    detailsSubmitted,
  });
  const [connecting, setConnecting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const justReturned = params.get("connect") === "return";

  useEffect(() => {
    if (!justReturned) return;
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/stripe/connect/status");
        if (!res.ok) throw new Error("Failed to load status");
        const data = (await res.json()) as Status;
        if (!cancelled) setStatus(data);
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : "Status check failed");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [justReturned]);

  async function connect() {
    setError(null);
    setConnecting(true);
    try {
      const res = await fetch("/api/stripe/connect/start", { method: "POST" });
      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(data.error ?? `Failed (${res.status})`);
      }
      const data = (await res.json()) as { url: string };
      window.location.href = data.url;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Connect failed");
      setConnecting(false);
    }
  }

  function skip() {
    startTransition(async () => {
      const result = await skipPaymentsStepAction();
      if (result?.error) {
        setError(result.error);
        return;
      }
      router.push("/onboarding/plan");
    });
  }

  function continueAfterConnect() {
    startTransition(async () => {
      const result = await advanceFromPaymentsAction();
      if (result?.error) {
        setError(result.error);
        return;
      }
      router.push("/onboarding/plan");
    });
  }

  const ready = status.chargesEnabled && status.detailsSubmitted;

  return (
    <StepShell
      step="payments"
      title="Accept payments from your clients"
      description="Connect Stripe to take deposits and balance payments. Funds go straight to your bank — Gallurio never holds your money."
      illustration={<PaymentsIllustration />}
    >
      <div className="flex flex-col gap-5">
        <div className="border border-border p-4">
          <div className="flex items-start justify-between gap-4">
            <div className="flex flex-col gap-1">
              <div className="flex items-center gap-2">
                <span className="text-sm font-semibold">Stripe Connect</span>
                {ready && (
                  <motion.span
                    initial={{ scale: 0.6, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    className="inline-flex items-center gap-1 bg-primary px-2 py-0.5 text-xs text-primary-foreground"
                  >
                    <CheckCircle2 className="h-3 w-3" /> Active
                  </motion.span>
                )}
              </div>
              <p className="text-sm text-muted-foreground">
                ~3 minute Stripe-hosted onboarding. You&apos;ll need basic business
                info and a bank account.
              </p>
              <ul className="mt-2 flex flex-col gap-1 text-xs text-muted-foreground">
                <li>• 1-click deposit links per booking</li>
                <li>• Automatic balance reminders</li>
                <li>• Payouts to your bank, not ours</li>
              </ul>
            </div>
          </div>

          <div className="mt-4 flex gap-2">
            {!ready ? (
              <Button onClick={connect} disabled={connecting}>
                {connecting ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Opening Stripe…
                  </>
                ) : (
                  <>
                    {status.connected ? "Continue Stripe setup" : "Connect Stripe"}
                    <ExternalLink className="ml-2 h-4 w-4" />
                  </>
                )}
              </Button>
            ) : (
              <Button onClick={continueAfterConnect} disabled={pending}>
                {pending ? "…" : "Looks good — continue"}
              </Button>
            )}
          </div>
        </div>

        {error && (
          <p className="border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
            {error}
          </p>
        )}

        <div className="flex items-center justify-between">
          <Button type="button" variant="ghost" onClick={skip} disabled={pending}>
            Skip — I&apos;ll do this later
          </Button>
          {ready && (
            <Button onClick={continueAfterConnect} disabled={pending} className="min-w-32">
              Continue
            </Button>
          )}
        </div>
      </div>
    </StepShell>
  );
}
