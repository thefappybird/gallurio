"use client";

import { useState } from "react";
import { motion } from "motion/react";
import { Check, Loader2 } from "lucide-react";
import { StepShell } from "../_components/step-shell";
import { PlanIllustration } from "../_components/illustrations";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type PlanId = "starter" | "pro";

const PLANS: Array<{
  id: PlanId;
  name: string;
  price: string;
  tagline: string;
  features: string[];
  highlight?: boolean;
}> = [
  {
    id: "starter",
    name: "Starter",
    price: "$19",
    tagline: "For solo owners getting started.",
    features: [
      "Unlimited bookings",
      "5 GB image storage",
      "Branded inquiry form",
      "Public landing page",
    ],
  },
  {
    id: "pro",
    name: "Pro",
    price: "$49",
    tagline: "Custom domain + invoices.",
    features: [
      "Everything in Starter",
      "Custom domain",
      "50 GB storage",
      "Invoice PDFs",
      "Remove Gallurio branding",
    ],
    highlight: true,
  },
];

export function PlanStepForm({ currentPlan }: { currentPlan: string }) {
  const [selected, setSelected] = useState<PlanId>(
    currentPlan === "pro" ? "pro" : "starter"
  );
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function startTrial() {
    setError(null);
    setLoading(true);
    try {
      const res = await fetch("/api/billing/checkout", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ plan: selected, onboarding: true, trialDays: 14 }),
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

  return (
    <StepShell
      step="plan"
      title="Start your 14-day free trial"
      description="Pick a plan — we'll only charge after 14 days, and you can cancel anytime."
      illustration={<PlanIllustration />}
    >
      <div className="flex flex-col gap-5">
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          {PLANS.map((p) => {
            const active = selected === p.id;
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
                    Popular
                  </span>
                )}
                <div className="flex items-baseline justify-between">
                  <h3 className="font-heading text-lg font-semibold">{p.name}</h3>
                  {active && (
                    <span className="flex h-5 w-5 items-center justify-center bg-primary text-primary-foreground">
                      <Check className="h-3.5 w-3.5" />
                    </span>
                  )}
                </div>
                <div className="flex items-baseline gap-1">
                  <span className="font-heading text-3xl font-semibold">{p.price}</span>
                  <span className="text-sm text-muted-foreground">/ month</span>
                </div>
                <p className="text-xs text-muted-foreground">{p.tagline}</p>
                <ul className="mt-1 flex flex-col gap-1.5 text-xs">
                  {p.features.map((f) => (
                    <li key={f} className="flex items-start gap-1.5">
                      <Check className="mt-0.5 h-3 w-3 shrink-0 text-primary" />
                      <span>{f}</span>
                    </li>
                  ))}
                </ul>
              </motion.button>
            );
          })}
        </div>

        <p className="text-xs text-muted-foreground">
          You&apos;ll be redirected to Stripe to enter your card. No charge for 14 days —
          cancel anytime before then.
        </p>

        {error && (
          <p className="border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
            {error}
          </p>
        )}

        <div className="mt-1 flex justify-end">
          <Button onClick={startTrial} disabled={loading} className="min-w-44">
            {loading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Opening Stripe…
              </>
            ) : (
              `Start trial — ${PLANS.find((p) => p.id === selected)?.price}/mo after`
            )}
          </Button>
        </div>
      </div>
    </StepShell>
  );
}
