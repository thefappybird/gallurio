"use client";

import {
  useCallback,
  useLayoutEffect,
  useRef,
  useState,
  type RefObject,
} from "react";

type RemainingHeightInput = {
  viewportHeight: number;
  elementTop: number;
  bottomGap: number;
  trailingHeight?: number;
};

export function calculateViewportRemainingHeight({
  viewportHeight,
  elementTop,
  bottomGap,
  trailingHeight = 0,
}: RemainingHeightInput): number {
  return Math.max(
    0,
    Math.floor(viewportHeight - Math.max(0, elementTop) - bottomGap - trailingHeight)
  );
}

function visibleTrailingHeight(node: HTMLElement): number {
  const parent = node.parentElement;
  if (!parent) return 0;

  const siblings = Array.from(parent.children);
  const nodeIndex = siblings.indexOf(node);
  if (nodeIndex < 0) return 0;

  const visibleAfter = siblings.slice(nodeIndex + 1).filter((sibling) => {
    if (!(sibling instanceof HTMLElement)) return false;
    const style = window.getComputedStyle(sibling);
    return style.display !== "none" && sibling.getBoundingClientRect().height > 0;
  }) as HTMLElement[];

  if (visibleAfter.length === 0) return 0;

  const rowGap = Number.parseFloat(window.getComputedStyle(parent).rowGap) || 0;
  return (
    visibleAfter.reduce(
      (total, sibling) => total + sibling.getBoundingClientRect().height,
      0
    ) +
    rowGap * visibleAfter.length
  );
}

/**
 * Measures the usable vertical space from an element's live viewport position
 * to the page's bottom padding. Immediate visible siblings after the element
 * are reserved automatically (for example, a table pagination footer).
 */
export function useViewportRemainingHeight<T extends HTMLElement>(
  bottomGap = 24
): {
  ref: RefObject<T | null>;
  remainingHeight: number | null;
} {
  const ref = useRef<T>(null);
  const [remainingHeight, setRemainingHeight] = useState<number | null>(null);

  const measure = useCallback(() => {
    const node = ref.current;
    if (!node) return;

    const rect = node.getBoundingClientRect();
    // Layout-less test environments report an all-zero rect. Keep the stable
    // server/fallback row count there instead of inventing a viewport layout.
    if (rect.width <= 0) return;

    const viewportHeight = window.visualViewport?.height ?? window.innerHeight;
    const nextHeight = calculateViewportRemainingHeight({
      viewportHeight,
      elementTop: rect.top,
      bottomGap,
      trailingHeight: visibleTrailingHeight(node),
    });
    setRemainingHeight((current) => (current === nextHeight ? current : nextHeight));
  }, [bottomGap]);

  useLayoutEffect(() => {
    const node = ref.current;
    if (!node) return;

    let frame = 0;
    const scheduleMeasure = () => {
      window.cancelAnimationFrame(frame);
      frame = window.requestAnimationFrame(measure);
    };

    scheduleMeasure();
    window.addEventListener("resize", scheduleMeasure);
    window.visualViewport?.addEventListener("resize", scheduleMeasure);

    const resizeObserver =
      typeof ResizeObserver === "undefined"
        ? null
        : new ResizeObserver(scheduleMeasure);
    resizeObserver?.observe(node);
    if (node.parentElement) resizeObserver?.observe(node.parentElement);

    return () => {
      window.cancelAnimationFrame(frame);
      window.removeEventListener("resize", scheduleMeasure);
      window.visualViewport?.removeEventListener("resize", scheduleMeasure);
      resizeObserver?.disconnect();
    };
  }, [measure]);

  return { ref, remainingHeight };
}
