"use client";

/**
 * Scroll-reveal for the marketing home page. Server markup carries `data-r`
 * (+ optional `--i` stagger index); this adds `in` once each element enters the
 * viewport. Content is visible by default: the hidden "before" state only
 * exists under `html[data-mk-motion]`, which is set here (after hydration) and
 * only when the visitor has not asked for reduced motion. So no-JS and
 * reduced-motion visitors always see the final state. CSS lives in globals.css
 * (`MARKETING MOTION`). Not reused for the portfolio pages: those use
 * MotionObserver / `data-anim`.
 */

import { useEffect } from "react";

export function MarketingReveal() {
  useEffect(() => {
    const root = document.documentElement;
    const targets = Array.from(document.querySelectorAll("[data-r]"));
    const reduced =
      typeof window.matchMedia === "function" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    if (reduced || typeof IntersectionObserver === "undefined") {
      targets.forEach((el) => el.classList.add("in"));
      return;
    }

    root.setAttribute("data-mk-motion", "");
    const io = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          // Anything already scrolled past (late hydration, restored scroll) must
          // not stay hidden when the visitor scrolls back up.
          if (entry.isIntersecting || entry.boundingClientRect.bottom <= 0) {
            entry.target.classList.add("in");
            io.unobserve(entry.target);
          }
        }
      },
      { threshold: 0.18, rootMargin: "0px" },
    );
    targets.forEach((el) => io.observe(el));

    return () => {
      io.disconnect();
      root.removeAttribute("data-mk-motion");
    };
  }, []);

  return null;
}
