"use client";

import { usePathname } from "next/navigation";
import { motion } from "motion/react";
import type { JSX } from "react";

type StepKey = "business" | "workspace" | "plan" | "done";

function stepFromPathname(pathname: string | null): StepKey {
  if (pathname?.includes("/onboarding/workspace")) return "workspace";
  if (pathname?.includes("/onboarding/plan")) return "plan";
  if (pathname?.includes("/onboarding/done")) return "done";
  return "business";
}

const line = { stroke: "currentColor", strokeWidth: 1.5, fill: "none" } as const;

// Camera + heart doodle — echoes the "capture the moment" business-identity step.
function CameraHeartMotif() {
  return (
    <svg viewBox="0 0 140 140" width="120" height="120">
      <rect x="16" y="46" width="72" height="52" rx="4" {...line} />
      <rect x="34" y="34" width="24" height="12" rx="2" {...line} />
      <circle cx="52" cy="72" r="16" {...line} />
      <circle cx="52" cy="72" r="7" {...line} />
      <path
        d="M96 34c0-6 5-10 10-10s9 4 9 9c0 8-9 13-19 22-10-9-19-14-19-22 0-5 4-9 9-9s10 4 10 10z"
        {...line}
      />
      <path d="M20 20l4 6M30 14l2 7" {...line} />
    </svg>
  );
}

// Globe + pin doodle — echoes the location/timezone workspace-setup step.
function GlobePinMotif() {
  return (
    <svg viewBox="0 0 140 140" width="120" height="120">
      <circle cx="60" cy="64" r="40" {...line} />
      <ellipse cx="60" cy="64" rx="16" ry="40" {...line} opacity="0.6" />
      <path d="M20 64h80M27 40h66M27 88h66" {...line} opacity="0.6" />
      <path d="M108 96c0-9 8-16 17-16s17 7 17 16c0 13-17 24-17 32s-17-19-17-32z" {...line} />
      <circle cx="125" cy="96" r="5" {...line} />
    </svg>
  );
}

// Price tag + sparkle doodle — echoes the plan/pricing step.
function TagSparkleMotif() {
  return (
    <svg viewBox="0 0 140 140" width="120" height="120">
      <path d="M24 20h44l40 40-44 44-40-40V20z" {...line} />
      <circle cx="42" cy="38" r="7" {...line} />
      <path d="M108 24l3 9 9 3-9 3-3 9-3-9-9-3 9-3z" {...line} />
    </svg>
  );
}

// Heart doodle — echoes the "you're all set" done step.
function HeartMotif() {
  return (
    <svg viewBox="0 0 140 140" width="90" height="90">
      <path
        d="M70 108c-30-20-46-36-46-56 0-15 12-26 26-26 9 0 16 4 20 11 4-7 11-11 20-11 14 0 26 11 26 26 0 20-16 36-46 56z"
        {...line}
      />
    </svg>
  );
}

const STEP_MOTIFS: Record<StepKey, () => JSX.Element> = {
  business: CameraHeartMotif,
  workspace: GlobePinMotif,
  plan: TagSparkleMotif,
  done: HeartMotif,
};

// Shared vine + sparkle cluster — identical on every step, bottom-right.
function VineSparkleAccent() {
  return (
    <svg viewBox="0 0 220 220" width="180" height="180">
      <path
        d="M210 210V150c0-30-20-46-42-46-18 0-30 12-30 26 0 12 9 20 20 20 8 0 14-5 14-13"
        {...line}
      />
      <path d="M168 104c4-8 2-16-4-20M148 130c-8 2-14 8-14 16" {...line} opacity="0.7" />
      <path d="M60 40l3 9 9 3-9 3-3 9-3-9-9-3 9-3z" {...line} />
      <path d="M110 20l2 6 6 2-6 2-2 6-2-6-6-2 6-2z" {...line} />
    </svg>
  );
}

/**
 * Purely decorative accents — a fixed vine+sparkle cluster (bottom-right,
 * every step) plus a per-step corner motif (left side) that changes with the
 * current onboarding step. Rendered once by the onboarding layout, so new
 * steps only need an entry in STEP_MOTIFS.
 * `hidden sm:block` keeps 375px mobile uncluttered.
 */
export function OnboardingCornerAccents() {
  const pathname = usePathname();
  const step = stepFromPathname(pathname);
  const Motif = STEP_MOTIFS[step];

  return (
    <div className="pointer-events-none absolute inset-0 select-none" aria-hidden="true">
      <motion.div
        key={step}
        data-motif={step}
        className="absolute top-1/3 left-0 hidden text-brand/25 sm:block"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.6, delay: 0.15 }}
      >
        <Motif />
      </motion.div>
      <motion.div
        className="absolute right-0 bottom-0 hidden text-brand/25 sm:block"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.6, delay: 0.25 }}
      >
        <VineSparkleAccent />
      </motion.div>
    </div>
  );
}
