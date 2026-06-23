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

// Number of consecutive frames an anchor may be absent before the tooltip
// falls back to viewport centre (~0.5 s at 60 fps). Keeps the cutout stable
// while a panel is still mounting after a step change.
const MAX_ABSENT_FRAMES = 30;

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
 * **Absent-anchor grace window:** when the anchor element is absent or detached,
 * the hook retains the prior rect and keeps polling for up to MAX_ABSENT_FRAMES
 * frames before falling back to null (tooltip centres). This bridges the gap
 * while a panel is still mounting after a step change (steps 9/12/15/17), and
 * still centres when the anchor is genuinely gone for good.
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
    // `el` is re-assignable: when an inline Puck override remounts, the original
    // anchor node is removed and a NEW node with the same data-tour-id is
    // inserted in the same commit. The loop below re-acquires it instead of
    // permanently clearing the rect (which would jump the tooltip to centre).
    let el = scope.querySelector<Element>(`[data-tour-id="${id}"]`);

    // Scroll the anchor into view so it has a real bounding rect before measuring.
    if (el) {
      el.scrollIntoView({ behavior: "instant", block: "nearest", inline: "nearest" });
    }

    // Track the last measured values to skip redundant state updates.
    let lastTop = NaN;
    let lastLeft = NaN;
    let lastWidth = NaN;
    let lastHeight = NaN;
    let rafId: number;
    // Counts consecutive frames where the anchor is absent. Reset to 0 when
    // the anchor is found or re-acquired. Triggers centre fallback at MAX_ABSENT_FRAMES.
    let absentFrames = 0;

    function loop() {
      // If the anchor is absent or detached, try to re-acquire it first.
      // An inline Puck override remount replaces the node (old removed, new
      // inserted) in the same commit — re-acquiring tracks the new node rather
      // than centering.
      if (!el || !el.isConnected) {
        const next = scope.querySelector<Element>(`[data-tour-id="${id}"]`);
        if (next) {
          // Re-acquired: reset the grace counter and start tracking the new node.
          el = next;
          absentFrames = 0;
          el.scrollIntoView({ behavior: "instant", block: "nearest", inline: "nearest" });
          // Fall through to measure this frame.
        } else {
          // Still absent: count the frame. Centre only after the grace window.
          absentFrames++;
          if (absentFrames > MAX_ABSENT_FRAMES) {
            setRect(null);
            return; // give up — anchor is genuinely gone
          }
          // Retain the current rect and keep polling.
          rafId = requestAnimationFrame(loop);
          return;
        }
      }

      const r = el.getBoundingClientRect();
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
