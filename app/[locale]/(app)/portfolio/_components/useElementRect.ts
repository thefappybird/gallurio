"use client";

import { useEffect, useState } from "react";

export type ElementRect = {
  top: number;
  left: number;
  width: number;
  height: number;
  bottom: number;
  right: number;
};

const ZERO_RECT: ElementRect = {
  top: 0,
  left: 0,
  width: 0,
  height: 0,
  bottom: 0,
  right: 0,
};

function domRectToPlain(r: DOMRect): ElementRect {
  return { top: r.top, left: r.left, width: r.width, height: r.height, bottom: r.bottom, right: r.right };
}

/**
 * Returns the bounding rect (in viewport coordinates) of the nearest element
 * matching `[data-tour-id="${id}"]`, or null when `id` is undefined/falsy.
 *
 * While an anchor id is set, a requestAnimationFrame loop continuously
 * re-measures the element each frame so the cutout tracks the live position
 * even when a sibling in the same toolbar shifts (e.g. after async load),
 * which a ResizeObserver on the element itself would miss. The loop is
 * cancelled on cleanup or when the id becomes falsy.
 *
 * `useState` setter is guaranteed stable across renders, so it is safe to
 * close over it inside effect callbacks without stale-closure risk.
 */
export function useElementRect(id: string | undefined): ElementRect | null {
  // Initialise lazily so the very first render already has a measurement when
  // the element is already in the DOM (e.g. SSR-hydration / test environment).
  const [rect, setRect] = useState<ElementRect | null>(() => {
    if (typeof document === "undefined" || !id) return null;
    const el = document.querySelector<Element>(`[data-tour-id="${id}"]`);
    return el ? domRectToPlain(el.getBoundingClientRect()) : null;
  });

  useEffect(() => {
    if (!id) {
      // No anchor requested — clear any stale rect via rAF so the call is not
      // synchronous inside the effect body.
      const raf = requestAnimationFrame(() => setRect(null));
      return () => cancelAnimationFrame(raf);
    }

    const el = document.querySelector<Element>(`[data-tour-id="${id}"]`);

    // Scroll the anchor into view so it has a real bounding rect before measuring.
    if (el) {
      el.scrollIntoView({ behavior: "instant", block: "nearest", inline: "nearest" });
    }

    if (!el) {
      // Element not found — schedule a deferred clear so no synchronous setState
      // occurs inside the effect body (satisfies react-hooks/set-state-in-effect).
      const rafId = requestAnimationFrame(() => setRect(null));
      return () => cancelAnimationFrame(rafId);
    }

    // Track the last measured values to skip redundant state updates.
    let lastTop = NaN;
    let lastLeft = NaN;
    let lastWidth = NaN;
    let lastHeight = NaN;
    let rafId: number;

    function loop() {
      const r = el!.getBoundingClientRect();
      // Only call setRect when something actually changed to avoid render churn.
      if (r.top !== lastTop || r.left !== lastLeft || r.width !== lastWidth || r.height !== lastHeight) {
        lastTop = r.top;
        lastLeft = r.left;
        lastWidth = r.width;
        lastHeight = r.height;
        setRect(domRectToPlain(r));
      }
      rafId = requestAnimationFrame(loop);
    }

    rafId = requestAnimationFrame(loop);

    return () => cancelAnimationFrame(rafId);
  }, [id]);

  return rect;
}

export { ZERO_RECT };
