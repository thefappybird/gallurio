"use client";

import { motion } from "motion/react";

const COLORS = ["var(--brand)", "var(--brand-2)", "var(--chart-3)", "var(--chart-7)"];

// Deterministic (not Math.random) spread — avoids an SSR/CSR hydration
// mismatch on this "use client" component while still reading as varied.
const PIECES = Array.from({ length: 36 }, (_, i) => ({
  id: i,
  left: (i * 37) % 100,
  delay: (i % 12) * 0.05,
  duration: 1.8 + (i % 5) * 0.2,
  rotate: (i % 2 === 0 ? 1 : -1) * (180 + (i % 4) * 60),
  color: COLORS[i % COLORS.length],
  size: 6 + (i % 3) * 2,
}));

/**
 * One-shot full-viewport confetti burst — plays once when mounted (the
 * onboarding "done" step). Built with motion/react (already a dependency);
 * no canvas-confetti or similar package needed.
 */
export function ConfettiScatter() {
  return (
    <div
      data-testid="confetti-scatter"
      aria-hidden="true"
      className="pointer-events-none fixed inset-0 z-50 overflow-hidden"
    >
      {PIECES.map((p) => (
        <motion.span
          key={p.id}
          className="absolute top-0 block"
          style={{
            left: `${p.left}%`,
            width: p.size,
            height: p.size * 0.4,
            backgroundColor: p.color,
          }}
          initial={{ y: -20, opacity: 1, rotate: 0 }}
          animate={{ y: "110vh", opacity: [1, 1, 0], rotate: p.rotate }}
          transition={{ duration: p.duration, delay: p.delay, ease: "easeIn" }}
        />
      ))}
    </div>
  );
}
