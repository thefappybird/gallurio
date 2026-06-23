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
 * **Scoped query:** the optional `root` parameter scopes the querySelector to a
 * specific subtree. This is used by SpotlightGuide when it runs inside a
 * SandboxEditorGuide overlay that coexists with the real editor shell — both
 * shells render the same `data-tour-id` attributes, so `document.querySelector`
 * would find the outer shell's element first. Passing the sandbox container as
 * `root` constrains the lookup to the correct subtree.
 *
 * **Transient-zero retention:** if `getBoundingClientRect()` reports a zero
 * width/height (which happens for a frame or two while the properties panel
 * re-lays-out after a style-tab switch), the last valid non-zero rect is kept
 * rather than falling back to a zero rect that would cause the tooltip to jump
 * to viewport centre.
 *
 * **Detached-node handling:** within the rAF loop, if `el.isConnected` becomes
 * false (the element was removed from the document between frames — e.g. a Puck
 * re-render unmounted the sidebar), the rect is cleared to null and the loop
 * stops immediately. This is distinct from the transient-zero case above, where
 * the element is still connected but momentarily has no size. The rect is only
 * cleared to null via the initial DOM-lookup path (element not found on effect
 * re-run) or via the isConnected guard inside the loop.
 *
 * `useState` setter is guaranteed stable across renders, so it is safe to
 * close over it inside effect callbacks without stale-closure risk.
 */
export function useElementRect(
  id: string | undefined,
  root?: Element | null
): ElementRect | null {
  // Initialise lazily so the very first render already has a measurement when
  // the element is already in the DOM (e.g. SSR-hydration / test environment).
  const [rect, setRect] = useState<ElementRect | null>(() => {
    if (typeof document === "undefined" || !id) return null;
    const scope = root ?? document;
    const el = scope.querySelector<Element>(`[data-tour-id="${id}"]`);
    if (!el) return null;
    const r = el.getBoundingClientRect();
    return (r.width > 0 || r.height > 0) ? domRectToPlain(r) : null;
  });

  useEffect(() => {
    if (!id) {
      // No anchor requested — clear any stale rect via rAF so the call is not
      // synchronous inside the effect body.
      const raf = requestAnimationFrame(() => setRect(null));
      return () => cancelAnimationFrame(raf);
    }

    const scope = root ?? document;
    const el = scope.querySelector<Element>(`[data-tour-id="${id}"]`);

    // Scroll the anchor into view so it has a real bounding rect before measuring.
    if (el) {
      el.scrollIntoView({ behavior: "instant", block: "nearest", inline: "nearest" });
    }

    if (!el) {
      // Element truly absent from the DOM — clear the rect so the tooltip
      // centres (correct fallback when there is genuinely no anchor).
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
      // If the element was removed from the document between frames (e.g. a
      // Puck re-render unmounted the sidebar), clear the rect and stop looping.
      // This is distinct from a transient zero-size frame (element still in DOM
      // but mid-layout), which we retain the last valid rect for instead.
      if (!el!.isConnected) {
        setRect(null);
        return; // do NOT reschedule — element is gone
      }
      const r = el!.getBoundingClientRect();
      // Skip zero-size readings: the element may be momentarily off-screen or
      // mid-layout (e.g. the properties panel re-flowing after a tab switch).
      // Retaining the previous valid rect prevents the tooltip from jumping to
      // viewport centre for that one frame. Only update when the element has a
      // real, non-zero size again.
      if (r.width === 0 && r.height === 0) {
        rafId = requestAnimationFrame(loop);
        return;
      }
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
  }, [id, root]);

  return rect;
}

export { ZERO_RECT };
