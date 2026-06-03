"use client";

/**
 * Reveals entrance-animated blocks (`[data-anim]`) on the public portfolio page
 * as they scroll into view by adding the `pf-in-view` class (the CSS in
 * globals.css handles the actual transition). One-shot per element. Falls back
 * to revealing everything when IntersectionObserver is unavailable, and respects
 * prefers-reduced-motion (the CSS already neutralizes the transforms).
 *
 * Mounted once on the public layout. Not used in the editor (the editor canvas
 * always shows blocks at their final state — see `.gallurio-editor` override).
 */

import { useEffect } from "react";

export function MotionObserver() {
  useEffect(() => {
    const reveal = (el: Element) => el.classList.add("pf-in-view");

    if (typeof IntersectionObserver === "undefined") {
      document.querySelectorAll("[data-anim]").forEach(reveal);
      return;
    }

    const io = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            reveal(entry.target);
            io.unobserve(entry.target);
          }
        }
      },
      { threshold: 0.12, rootMargin: "0px 0px -8% 0px" }
    );

    const scan = () => {
      document.querySelectorAll("[data-anim]:not(.pf-in-view)").forEach((el) => io.observe(el));
    };
    scan();

    // Re-scan when new blocks mount (e.g. client-rendered sections).
    const mo = new MutationObserver(scan);
    mo.observe(document.body, { childList: true, subtree: true });

    return () => {
      io.disconnect();
      mo.disconnect();
    };
  }, []);

  return null;
}
