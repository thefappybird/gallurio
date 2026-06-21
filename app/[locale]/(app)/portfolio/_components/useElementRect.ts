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
 * Re-measures on window resize and scroll (via ResizeObserver + event listeners).
 * Returns a zero-area rect when the element is found but has no visible size.
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
    // `setRect` from useState is stable — safe to close over in callbacks.
    const update = (el: Element | null) =>
      setRect(el ? domRectToPlain(el.getBoundingClientRect()) : null);

    if (!id) {
      // No anchor requested — clear any stale rect via rAF callback so the
      // call is not synchronous inside the effect body.
      const raf = requestAnimationFrame(() => update(null));
      return () => cancelAnimationFrame(raf);
    }

    const el = document.querySelector<Element>(`[data-tour-id="${id}"]`);

    // Initial measurement via rAF so we are past the browser layout phase.
    const raf = requestAnimationFrame(() => update(el));

    if (!el) return () => cancelAnimationFrame(raf);

    // Re-measure when the element resizes or the viewport changes.
    const ro = new ResizeObserver(() => update(el));
    ro.observe(el);

    const onExternalChange = () => update(el);
    window.addEventListener("scroll", onExternalChange, { passive: true, capture: true });
    window.addEventListener("resize", onExternalChange, { passive: true });

    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
      window.removeEventListener("scroll", onExternalChange, { capture: true });
      window.removeEventListener("resize", onExternalChange);
    };
  }, [id]);

  return rect;
}

export { ZERO_RECT };
