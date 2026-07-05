"use client";

import Link from "next/link";
import Image from "next/image";
import { motion } from "motion/react";
import { useTranslations } from "next-intl";
import type { ReactNode } from "react";
import { ArrowLeft, Check, Lock } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

// Onboarding step order. The payments step was removed when marketplace was
// dropped from MVP; the template step was moved to Page Builder / workspace
// settings. Keep this list in sync with ONBOARDING_STEPS in
// lib/db/models/User.ts.
export const STEP_META = [
  { key: "business", href: "/onboarding/business" },
  { key: "workspace", href: "/onboarding/workspace" },
  { key: "plan", href: "/onboarding/plan" },
  { key: "done", href: "/onboarding/done" },
] as const;

type StepKey = (typeof STEP_META)[number]["key"];

export function StepShell({
  step,
  furthestStep,
  title,
  description,
  headerAddon,
  centerHeader,
  children,
}: {
  step: StepKey;
  /** The furthest step the user has reached — caps which step buttons are clickable. */
  furthestStep: StepKey;
  title: string;
  description: string;
  /** Optional content rendered above the title (e.g. the done step's badge). */
  headerAddon?: ReactNode;
  /** Centers the title/description/addon block (the done step's celebratory layout). */
  centerHeader?: boolean;
  children: ReactNode;
}) {
  const t = useTranslations("onboarding.shell");
  const activeIndex = STEP_META.findIndex((s) => s.key === step);
  const furthestIndex = STEP_META.findIndex((s) => s.key === furthestStep);

  return (
    <div className="flex h-full min-h-0 flex-1 flex-col gap-4 md:gap-6">
      <Link href="/" className="flex shrink-0 items-center gap-2 self-start">
        <Image src="/brand/gallurio-sq.svg" alt="" width={28} height={28} className="h-7 w-7" priority />
        <span className="font-heading text-base font-semibold tracking-tight">Gallurio</span>
      </Link>

      <div className="shrink-0">
        <ProgressBar activeIndex={activeIndex} furthestIndex={furthestIndex} />
      </div>

      <div className="flex min-h-0 flex-1 flex-col items-center">
        <motion.div
          key={step}
          initial={{ opacity: 0, x: 16 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -16 }}
          transition={{ duration: 0.25, ease: "easeOut" }}
          className="flex w-full max-w-3xl min-h-0 flex-col gap-4 border border-border bg-background p-4 sm:p-6 md:gap-6 md:p-8"
        >
          <div className={cn("flex shrink-0 flex-col gap-1", centerHeader && "items-center text-center")}>
            {headerAddon}
            <p className="text-xs uppercase tracking-wider text-muted-foreground">
              {t("stepCounter", { current: activeIndex + 1, total: STEP_META.length })}
            </p>
            <h1 className="font-heading text-2xl font-semibold tracking-tight md:text-3xl">
              {title}
            </h1>
            <p className="onboarding-step-description text-sm text-muted-foreground">{description}</p>
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto scrollbar-subtle">{children}</div>
        </motion.div>
      </div>
    </div>
  );
}

function ProgressBar({
  activeIndex,
  furthestIndex,
}: {
  activeIndex: number;
  furthestIndex: number;
}) {
  const t = useTranslations("onboarding.steps");
  return (
    <ol className="grid w-full gap-2" style={{ gridTemplateColumns: `repeat(${STEP_META.length}, minmax(0, 1fr))` }}>
      {STEP_META.map((s, i) => {
        const active = i === activeIndex;
        const visited = i < furthestIndex || (i === furthestIndex && !active);
        const reachable = i <= furthestIndex;
        const locked = !reachable;

        const fillScaleX = locked ? 0 : i < furthestIndex ? 1 : active ? 0.5 : 1;

        const indicator = (
          <>
            <div className="relative h-1 w-full bg-muted">
              <motion.div
                initial={{ scaleX: 0 }}
                animate={{ scaleX: fillScaleX }}
                transition={{ duration: 0.4, ease: "easeOut" }}
                style={{ originX: 0 }}
                className="absolute inset-0 bg-brand"
              />
            </div>
            <div className="flex items-center gap-1.5">
              <span
                className={cn(
                  "flex h-5 w-5 items-center justify-center rounded-full border text-[10px]",
                  visited && "border-brand bg-brand text-brand-foreground",
                  active && !visited && "border-brand text-brand",
                  locked && "border-border text-muted-foreground"
                )}
              >
                {locked ? (
                  <Lock className="h-2.5 w-2.5" />
                ) : visited ? (
                  <Check className="h-3 w-3" />
                ) : (
                  i + 1
                )}
              </span>
              <span
                className={cn(
                  "onboarding-progress-label text-xs",
                  active && "text-foreground",
                  !active && reachable && "text-foreground/70",
                  locked && "text-muted-foreground"
                )}
              >
                {t(s.key)}
              </span>
            </div>
          </>
        );

        return (
          <li key={s.key} className="flex flex-col gap-1.5">
            {locked ? (
              <div
                aria-disabled
                className="flex cursor-not-allowed flex-col gap-1.5 opacity-60"
              >
                {indicator}
              </div>
            ) : (
              <Link
                href={s.href}
                aria-current={active ? "step" : undefined}
                className={cn(
                  "flex flex-col gap-1.5 transition-opacity hover:opacity-80",
                  active && "pointer-events-none"
                )}
              >
                {indicator}
              </Link>
            )}
          </li>
        );
      })}
    </ol>
  );
}

export function StepBackButton({ from }: { from: StepKey }) {
  const t = useTranslations("onboarding.shell");
  const idx = STEP_META.findIndex((s) => s.key === from);
  if (idx <= 0) return null;
  const prev = STEP_META[idx - 1];
  return (
    <Link href={prev.href} className={buttonVariants({ variant: "ghost" })}>
      <ArrowLeft className="mr-1 h-4 w-4" />
      {t("previous")}
    </Link>
  );
}
