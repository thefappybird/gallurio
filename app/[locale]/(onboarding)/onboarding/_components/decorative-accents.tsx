"use client";

import Image from "next/image";
import { motion } from "motion/react";

const LIGHT_BACKGROUND = "/onboarding/background-light.svg";
const DARK_BACKGROUND = "/onboarding/background-dark.svg";

function AnimatedBackgroundImage({
  src,
  className,
}: {
  src: string;
  className: string;
}) {
  return (
    <motion.div
      className={`absolute -inset-[6%] ${className}`}
      initial={{ opacity: 0, scale: 1.03, x: 0, y: 0 }}
      animate={{
        opacity: 1,
        scale: [1.03, 1.08, 1.03],
        x: ["0%", "-1.5%", "1%", "0%"],
        y: ["0%", "1.25%", "-1%", "0%"],
      }}
      transition={{
        opacity: { duration: 0.5 },
        scale: { duration: 28, ease: "easeInOut", repeat: Infinity },
        x: { duration: 34, ease: "easeInOut", repeat: Infinity },
        y: { duration: 31, ease: "easeInOut", repeat: Infinity },
      }}
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

export function OnboardingCornerAccents() {
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
