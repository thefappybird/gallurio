"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { motion } from "motion/react";
import { Check, Loader2 } from "lucide-react";
import { templateStepAction } from "@/lib/actions/onboarding";
import { StepShell } from "../_components/step-shell";
import { TemplateIllustration } from "../_components/illustrations";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type TemplateId = "default" | "editorial" | "studio";

const TEMPLATES: Array<{
  id: TemplateId;
  name: string;
  description: string;
  preview: React.ReactNode;
}> = [
  {
    id: "default",
    name: "Classic",
    description: "Centered hero, services grid, contact form.",
    preview: <TemplatePreview variant="default" />,
  },
  {
    id: "editorial",
    name: "Editorial",
    description: "Large typography, full-bleed gallery, magazine feel.",
    preview: <TemplatePreview variant="editorial" />,
  },
  {
    id: "studio",
    name: "Studio",
    description: "Sidebar nav, project grid, minimal frame.",
    preview: <TemplatePreview variant="studio" />,
  },
];

export function TemplateStepForm({ initial }: { initial: TemplateId }) {
  const router = useRouter();
  const [selected, setSelected] = useState<TemplateId>(initial);
  const [serverError, setServerError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function submit() {
    setServerError(null);
    startTransition(async () => {
      const result = await templateStepAction({ templateId: selected });
      if (result?.error) {
        setServerError(result.error);
        return;
      }
      router.push("/onboarding/payments");
    });
  }

  return (
    <StepShell
      step="template"
      title="Pick a starting template"
      description="Choose a look for your public page — you'll be able to customize every block later."
      illustration={<TemplateIllustration />}
    >
      <div className="flex flex-col gap-5">
        <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
          {TEMPLATES.map((t) => {
            const active = selected === t.id;
            return (
              <motion.button
                key={t.id}
                type="button"
                whileHover={{ y: -2 }}
                whileTap={{ scale: 0.98 }}
                onClick={() => setSelected(t.id)}
                className={cn(
                  "relative flex flex-col gap-2 border bg-background p-3 text-left transition-colors",
                  active ? "border-primary" : "border-border hover:border-foreground/40"
                )}
              >
                <div className="aspect-[4/3] w-full overflow-hidden bg-muted">
                  {t.preview}
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">{t.name}</span>
                  {active && (
                    <span className="flex h-5 w-5 items-center justify-center bg-primary text-primary-foreground">
                      <Check className="h-3.5 w-3.5" />
                    </span>
                  )}
                </div>
                <p className="text-xs text-muted-foreground">{t.description}</p>
              </motion.button>
            );
          })}
        </div>

        {serverError && (
          <p className="border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
            {serverError}
          </p>
        )}

        <div className="mt-2 flex justify-end">
          <Button onClick={submit} disabled={pending} className="min-w-32">
            {pending ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Saving…
              </>
            ) : (
              "Continue"
            )}
          </Button>
        </div>
      </div>
    </StepShell>
  );
}

function TemplatePreview({ variant }: { variant: TemplateId }) {
  if (variant === "default") {
    return (
      <svg viewBox="0 0 160 120" className="h-full w-full">
        <rect width="160" height="24" fill="#111" opacity="0.06" />
        <rect x="56" y="36" width="48" height="6" fill="#111" />
        <rect x="48" y="48" width="64" height="4" fill="#111" opacity="0.4" />
        <rect x="20" y="68" width="32" height="36" fill="#111" opacity="0.1" />
        <rect x="64" y="68" width="32" height="36" fill="#111" opacity="0.1" />
        <rect x="108" y="68" width="32" height="36" fill="#111" opacity="0.1" />
      </svg>
    );
  }
  if (variant === "editorial") {
    return (
      <svg viewBox="0 0 160 120" className="h-full w-full">
        <rect x="12" y="14" width="78" height="14" fill="#111" />
        <rect x="12" y="32" width="60" height="6" fill="#111" opacity="0.4" />
        <rect x="100" y="14" width="48" height="48" fill="#111" opacity="0.15" />
        <rect x="12" y="70" width="136" height="38" fill="#111" opacity="0.08" />
      </svg>
    );
  }
  return (
    <svg viewBox="0 0 160 120" className="h-full w-full">
      <rect x="0" y="0" width="36" height="120" fill="#111" opacity="0.08" />
      <rect x="8" y="14" width="20" height="4" fill="#111" />
      <rect x="8" y="26" width="16" height="4" fill="#111" opacity="0.5" />
      <rect x="8" y="36" width="16" height="4" fill="#111" opacity="0.5" />
      <rect x="44" y="14" width="50" height="6" fill="#111" />
      {[0, 1, 2, 3].map((i) => (
        <rect
          key={i}
          x={44 + (i % 2) * 56}
          y={32 + Math.floor(i / 2) * 42}
          width="50"
          height="36"
          fill="#111"
          opacity="0.12"
        />
      ))}
    </svg>
  );
}
