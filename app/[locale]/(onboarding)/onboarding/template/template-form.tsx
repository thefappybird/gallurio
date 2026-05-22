"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { motion } from "motion/react";
import { useTranslations } from "next-intl";
import { Check, Loader2 } from "lucide-react";
import type { OnboardingStep } from "@/lib/db/models";
import { templateStepAction } from "@/lib/actions/onboarding";
import { StepShell, StepBackButton } from "../_components/step-shell";
import { TemplateIllustration } from "../_components/illustrations";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type TemplateId = "default" | "editorial" | "studio";

export function TemplateStepForm({
  initial,
  furthestStep,
}: {
  initial: TemplateId;
  furthestStep: OnboardingStep;
}) {
  const t = useTranslations("onboarding.template");
  const tShell = useTranslations("onboarding.shell");
  const router = useRouter();
  const [selected, setSelected] = useState<TemplateId>(initial);
  const [serverError, setServerError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const templates: Array<{
    id: TemplateId;
    name: string;
    description: string;
    preview: React.ReactNode;
  }> = [
    {
      id: "default",
      name: t("templates.default.name"),
      description: t("templates.default.description"),
      preview: <TemplatePreview variant="default" />,
    },
    {
      id: "editorial",
      name: t("templates.editorial.name"),
      description: t("templates.editorial.description"),
      preview: <TemplatePreview variant="editorial" />,
    },
    {
      id: "studio",
      name: t("templates.studio.name"),
      description: t("templates.studio.description"),
      preview: <TemplatePreview variant="studio" />,
    },
  ];

  function submit() {
    setServerError(null);
    startTransition(async () => {
      const result = await templateStepAction({ templateId: selected });
      if (result?.error) {
        setServerError(result.error);
        return;
      }
      // Template step now flows directly into the plan step — payments was
      // removed when marketplace was dropped from MVP.
      router.push("/onboarding/plan");
    });
  }

  return (
    <StepShell
      step="template"
      furthestStep={furthestStep}
      title={t("title")}
      description={t("description")}
      illustration={<TemplateIllustration />}
    >
      <div className="flex flex-col gap-5">
        <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
          {templates.map((tpl) => {
            const active = selected === tpl.id;
            return (
              <motion.button
                key={tpl.id}
                type="button"
                whileHover={{ y: -2 }}
                whileTap={{ scale: 0.98 }}
                onClick={() => setSelected(tpl.id)}
                className={cn(
                  "relative flex flex-col gap-2 border bg-background p-3 text-left transition-colors",
                  active ? "border-primary" : "border-border hover:border-foreground/40"
                )}
              >
                <div className="aspect-[4/3] w-full overflow-hidden bg-muted">
                  {tpl.preview}
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">{tpl.name}</span>
                  {active && (
                    <span className="flex h-5 w-5 items-center justify-center bg-primary text-primary-foreground">
                      <Check className="h-3.5 w-3.5" />
                    </span>
                  )}
                </div>
                <p className="text-xs text-muted-foreground">{tpl.description}</p>
              </motion.button>
            );
          })}
        </div>

        {serverError && (
          <p className="border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
            {serverError}
          </p>
        )}

        <div className="mt-2 flex items-center justify-between">
          <StepBackButton from="template" />
          <Button onClick={submit} disabled={pending} className="min-w-32">
            {pending ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                {tShell("saving")}
              </>
            ) : (
              tShell("continue")
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
