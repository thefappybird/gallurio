export type AnchoredPanelSide = "start" | "end";

/** Structural subset of `DOMRect` — enough to position against, easy to fake in tests. */
export type AnchoredRect = {
  top: number;
  left: number;
  right: number;
  bottom: number;
};

export type AnchoredPanelPositionInput = {
  anchorRect: AnchoredRect;
  panelWidth: number;
  panelMaxHeight: number;
  gap: number;
  /** Logical side to prefer, resolved to a physical left/right via `dir`. */
  preferredSide: AnchoredPanelSide;
  dir?: "ltr" | "rtl";
  viewportWidth?: number;
  viewportHeight?: number;
};

function resolvePhysicalSide(side: AnchoredPanelSide, dir: "ltr" | "rtl"): "left" | "right" {
  if (dir === "rtl") return side === "start" ? "right" : "left";
  return side === "start" ? "left" : "right";
}

/**
 * Where to place a `position: fixed` panel beside an anchor element, with no
 * post-mount measurement: everything is derived from the anchor's rect plus
 * a known worst-case panel size. Prefers `preferredSide` (resolved to a
 * physical left/right per `dir`), falls back to the opposite side when the
 * preferred one cannot fit, then clamps vertically inside the viewport.
 *
 * Shared by `PresetPreviewCard` (prefers "end" — the drawer sits on the
 * left, so the card opens toward the canvas on the right) and the portfolio
 * layout picker's preview card (prefers "start" — it sits beside a
 * right-hand sidebar, so the card opens left, toward the canvas).
 */
export function computeAnchoredPanelPosition({
  anchorRect,
  panelWidth,
  panelMaxHeight,
  gap,
  preferredSide,
  dir = "ltr",
  viewportWidth = typeof window !== "undefined" ? window.innerWidth : 1280,
  viewportHeight = typeof window !== "undefined" ? window.innerHeight : 800,
}: AnchoredPanelPositionInput): { left: number; top: number } {
  const physical = resolvePhysicalSide(preferredSide, dir);

  let left: number;
  if (physical === "right") {
    const fitsRight = viewportWidth - anchorRect.right - gap >= panelWidth;
    left = fitsRight ? anchorRect.right + gap : Math.max(gap, anchorRect.left - panelWidth - gap);
  } else {
    const fitsLeft = anchorRect.left - gap >= panelWidth;
    left = fitsLeft
      ? anchorRect.left - panelWidth - gap
      : Math.min(viewportWidth - panelWidth - gap, anchorRect.right + gap);
  }

  const top = Math.min(Math.max(gap, anchorRect.top), viewportHeight - panelMaxHeight - gap);

  return { left, top };
}
