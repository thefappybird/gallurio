"use client";

import { useState, useTransition } from "react";
import { motion } from "motion/react";
import { ArrowRight, Loader2, Sparkles } from "lucide-react";
import { completeOnboardingAction } from "@/lib/actions/onboarding";
import { StepShell } from "../_components/step-shell";
import { DoneIllustration } from "../_components/illustrations";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export function DoneStepForm({
  workspaceName,
  planLabel,
}: {
  workspaceName: string;
  planLabel: string;
}) {
  const [seedSampleData, setSeedSampleData] = useState(true);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function finish() {
    setError(null);
    startTransition(async () => {
      const result = await completeOnboardingAction({ seedSampleData });
      // completeOnboardingAction redirects on success; only an error returns.
      if (result?.error) setError(result.error);
    });
  }

  return (
    <StepShell
      step="done"
      title={`You're all set, ${workspaceName}.`}
      description={`Your ${planLabel} plan is active. One last thing before we drop you into the dashboard.`}
      illustration={<DoneIllustration />}
    >
      <div className="flex flex-col gap-6">
        <motion.button
          type="button"
          onClick={() => setSeedSampleData((v) => !v)}
          className={cn(
            "flex items-start gap-3 border bg-background p-4 text-left transition-colors",
            seedSampleData ? "border-primary" : "border-border"
          )}
          whileTap={{ scale: 0.99 }}
        >
          <div
            className={cn(
              "mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center border",
              seedSampleData ? "border-primary bg-primary" : "border-border"
            )}
          >
            {seedSampleData && (
              <motion.span
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                className="text-primary-foreground"
              >
                <svg viewBox="0 0 12 12" className="h-3 w-3" fill="none">
                  <path
                    d="M2 6.5L5 9L10 3.5"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="square"
                  />
                </svg>
              </motion.span>
            )}
          </div>
          <div className="flex flex-col gap-1">
            <div className="flex items-center gap-2">
              <Sparkles className="h-4 w-4" />
              <span className="text-sm font-medium">Start with sample data</span>
            </div>
            <p className="text-xs text-muted-foreground">
              We&apos;ll add 5 demo clients, 3 demo bookings, and 1 demo inquiry so you
              can explore the app. Everything is tagged <code>sample</code> so you
              can delete it in one click.
            </p>
          </div>
        </motion.button>

        {error && (
          <p className="border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
            {error}
          </p>
        )}

        <div className="flex justify-end">
          <Button onClick={finish} disabled={pending} className="min-w-48" size="lg">
            {pending ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Setting up your dashboard…
              </>
            ) : (
              <>
                Go to your dashboard
                <ArrowRight className="ml-2 h-4 w-4" />
              </>
            )}
          </Button>
        </div>
      </div>
    </StepShell>
  );
}
