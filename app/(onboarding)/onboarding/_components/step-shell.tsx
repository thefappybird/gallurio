"use client";

import { motion } from "motion/react";
import type { ReactNode } from "react";
import { Check } from "lucide-react";
import { cn } from "@/lib/utils";

export const STEP_META = [
  { key: "business", label: "Business", href: "/onboarding/business" },
  { key: "branding", label: "Branding", href: "/onboarding/branding" },
  { key: "template", label: "Template", href: "/onboarding/template" },
  { key: "payments", label: "Payments", href: "/onboarding/payments" },
  { key: "plan", label: "Plan", href: "/onboarding/plan" },
  { key: "done", label: "Finish", href: "/onboarding/done" },
] as const;

type StepKey = (typeof STEP_META)[number]["key"];

export function StepShell({
  step,
  title,
  description,
  illustration,
  children,
}: {
  step: StepKey;
  title: string;
  description: string;
  illustration: ReactNode;
  children: ReactNode;
}) {
  const activeIndex = STEP_META.findIndex((s) => s.key === step);

  return (
    <div className="flex flex-1 flex-col gap-8">
      <ProgressBar activeIndex={activeIndex} />

      <div className="grid flex-1 grid-cols-1 gap-8 lg:grid-cols-[1fr_minmax(360px,440px)]">
        <motion.div
          key={step}
          initial={{ opacity: 0, x: 16 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -16 }}
          transition={{ duration: 0.25, ease: "easeOut" }}
          className="flex flex-col gap-6 border border-border bg-background p-6 md:p-8"
        >
          <div className="flex flex-col gap-1">
            <p className="text-xs uppercase tracking-wider text-muted-foreground">
              Step {activeIndex + 1} of {STEP_META.length}
            </p>
            <h1 className="font-heading text-2xl font-semibold tracking-tight md:text-3xl">
              {title}
            </h1>
            <p className="text-sm text-muted-foreground">{description}</p>
          </div>
          <div>{children}</div>
        </motion.div>

        <motion.div
          key={`${step}-art`}
          initial={{ opacity: 0, scale: 0.96 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.35, ease: "easeOut", delay: 0.05 }}
          className="hidden border border-border bg-background lg:flex lg:items-center lg:justify-center lg:p-8"
        >
          {illustration}
        </motion.div>
      </div>
    </div>
  );
}

function ProgressBar({ activeIndex }: { activeIndex: number }) {
  return (
    <ol className="grid w-full grid-cols-6 gap-2">
      {STEP_META.map((s, i) => {
        const done = i < activeIndex;
        const active = i === activeIndex;
        return (
          <li key={s.key} className="flex flex-col gap-1.5">
            <div className="relative h-1 w-full bg-muted">
              <motion.div
                initial={{ scaleX: 0 }}
                animate={{ scaleX: done ? 1 : active ? 0.5 : 0 }}
                transition={{ duration: 0.4, ease: "easeOut" }}
                style={{ originX: 0 }}
                className={cn("absolute inset-0 bg-primary", done && "bg-primary")}
              />
            </div>
            <div className="flex items-center gap-1.5">
              <span
                className={cn(
                  "flex h-4 w-4 items-center justify-center border text-[10px]",
                  done && "border-primary bg-primary text-primary-foreground",
                  active && "border-primary",
                  !done && !active && "border-border text-muted-foreground"
                )}
              >
                {done ? <Check className="h-3 w-3" /> : i + 1}
              </span>
              <span
                className={cn(
                  "text-xs",
                  active ? "text-foreground" : "text-muted-foreground"
                )}
              >
                {s.label}
              </span>
            </div>
          </li>
        );
      })}
    </ol>
  );
}
