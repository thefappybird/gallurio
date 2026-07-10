"use client";

import Image from "next/image";
import { motion, useReducedMotion } from "motion/react";

const LIGHT_BACKGROUND = "/onboarding/background-light.svg";
const DARK_BACKGROUND = "/onboarding/background-dark.svg";

function AnimatedBackgroundImage({
  src,
  className,
}: {
  src: string;
  className: string;
}) {
  const shouldReduceMotion = useReducedMotion();

  return (
    <motion.div
      className={`absolute -inset-[6%] ${className}`}
      initial={{ opacity: 0, scale: 1.03, x: 0, y: 0 }}
      animate={
        shouldReduceMotion
          ? { opacity: 1, scale: 1.03, x: "0%", y: "0%" }
          : {
              opacity: 1,
              scale: [1.03, 1.08, 1.03],
              x: ["0%", "-1.5%", "1%", "0%"],
              y: ["0%", "1.25%", "-1%", "0%"],
            }
      }
      transition={
        shouldReduceMotion
          ? { opacity: { duration: 0.5 } }
          : {
              opacity: { duration: 0.5 },
              scale: { duration: 28, ease: "easeInOut", repeat: Infinity },
              x: { duration: 34, ease: "easeInOut", repeat: Infinity },
              y: { duration: 31, ease: "easeInOut", repeat: Infinity },
            }
      }
    >
      <Image
        src={src}
        alt=""
        fill
        priority
        sizes="100vw"
        className="object-cover"
      />
    </motion.div>
  );
}

/**
 * Full-bleed, theme-aware, slowly-drifting SVG background. Shared across
 * onboarding, auth, and the marketing landing page's dark hero/final-CTA
 * sections. Caller positions/sizes it via a `relative` ancestor — this
 * component fills that ancestor with `absolute inset-0` and self-clips its
 * oversized drift range. Respects `prefers-reduced-motion`.
 */
export function AmbientBackground() {
  return (
    <div
      className="pointer-events-none absolute inset-0 overflow-hidden select-none"
      aria-hidden="true"
    >
      <AnimatedBackgroundImage src={LIGHT_BACKGROUND} className="block dark:hidden" />
      <AnimatedBackgroundImage src={DARK_BACKGROUND} className="hidden dark:block" />
    </div>
  );
}
