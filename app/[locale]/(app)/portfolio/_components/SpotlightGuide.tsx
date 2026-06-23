"use client";

import {
  useCallback,
  useEffect,
  useRef,
  type KeyboardEvent,
} from "react";
import { createPortal } from "react-dom";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useElementRect, type ElementRect } from "./useElementRect";

// ─── Types ──────────────────────────────────────────────────────────────────

export type SpotlightStep = {
  id: string;
  anchorId?: string;
  title: string;
  body: string;
  placement?: "top" | "bottom" | "left" | "right";
  /** When true the highlighted element is interactive; parent tracks satisfaction. */
  gated?: boolean;
  /**
   * When true, the dim/cutout is rendered for visual context but ALL overlay
   * layers are pointer-events:none so the user can freely drag from one region
   * to another (e.g. drag from the blocks panel to the canvas). Only use on
   * drag-interaction steps where the drop target would otherwise be blocked.
   */
  passthrough?: boolean;
};

export type SpotlightGuideProps = {
  open: boolean;
  steps: SpotlightStep[];
  stepIndex: number;
  onStepChange: (next: number) => void;
  /** True when the current gated step's condition has been satisfied. */
  gateSatisfied: boolean;
  onSkip: (dontShowAgain: boolean) => void;
  onFinish: (dontShowAgain: boolean) => void;
  /**
   * Optional scope element for anchor queries. When the guide runs inside a
   * SandboxEditorGuide overlay that coexists with the real editor shell, both
   * shells render the same `data-tour-id` attributes. Passing the sandbox
   * container element here scopes `useElementRect`'s querySelector to that
   * subtree, ensuring the cutout targets the correct (guide's own) element.
   */
  queryRoot?: Element | null;
};

// ─── Labels ─────────────────────────────────────────────────────────────────

const L = {
  back: "Back",
  next: "Next",
  finish: "Finish",
  skip: "Skip",
  dontShow: "Don't show again",
  tryIt: "Try it to continue to the next step",
  progress: (n: number, total: number) => `${n} of ${total}`,
};

// ─── Constants ───────────────────────────────────────────────────────────────

/** Padding (px) added around the anchor element's bounding rect for the cutout. */
const CUTOUT_PADDING = 6;
/** Minimum gap (px) between the tooltip edge and the viewport. */
const VIEWPORT_MARGIN = 12;
/** Approximate tooltip dimensions used to keep it on-screen before paint. */
const TOOLTIP_W = 320;
const TOOLTIP_H = 200;

// ─── Geometry helpers ────────────────────────────────────────────────────────

type Position = { top: number; left: number };

/**
 * Calculate the tooltip's top/left so it sits next to the cutout rect
 * on the preferred side, clamped to stay within the viewport.
 */
function calcTooltipPosition(
  rect: ElementRect,
  placement: SpotlightStep["placement"] = "bottom",
  vpW: number,
  vpH: number
): Position {
  const pad = CUTOUT_PADDING;
  const margin = VIEWPORT_MARGIN;
  const w = TOOLTIP_W;
  const h = TOOLTIP_H;

  let top = 0;
  let left = 0;

  // Preferred positions relative to the cutout rect (padded)
  const above = rect.top - pad - h - margin;
  const below = rect.bottom + pad + margin;
  const toLeft = rect.left - pad - w - margin;
  const toRight = rect.right + pad + margin;

  // Horizontal center with the anchor
  const hCenter = rect.left + rect.width / 2 - w / 2;
  // Vertical center with the anchor
  const vCenter = rect.top + rect.height / 2 - h / 2;

  switch (placement) {
    case "top":
      top = above >= margin ? above : below;
      left = hCenter;
      break;
    case "bottom":
      top = below + h <= vpH - margin ? below : above;
      left = hCenter;
      break;
    case "left":
      top = vCenter;
      left = toLeft >= margin ? toLeft : toRight;
      break;
    case "right":
      top = vCenter;
      left = toRight + w <= vpW - margin ? toRight : toLeft;
      break;
    default:
      top = below + h <= vpH - margin ? below : above;
      left = hCenter;
  }

  // Clamp to viewport
  top = Math.max(margin, Math.min(top, vpH - h - margin));
  left = Math.max(margin, Math.min(left, vpW - w - margin));

  return { top, left };
}

// ─── SVG Cutout Dim ──────────────────────────────────────────────────────────

/**
 * Renders the full-screen dim with a rectangular cutout hole using an SVG
 * clip-path approach (a filled rect minus a smaller rect).
 *
 * When `gated` is true, pointer-events are disabled on the cutout region so
 * clicks pass through to the element below; the scrim still blocks elsewhere.
 *
 * When `passthrough` is true, ALL overlay layers are pointer-events:none so
 * the user can freely drag from any region (e.g. blocks panel) to any other
 * region (e.g. canvas) without being blocked by the dim. The dim is still
 * rendered for visual context.
 */
function DimWithCutout({
  rect,
  gated,
  passthrough,
}: {
  rect: ElementRect | null;
  gated: boolean;
  passthrough: boolean;
}) {
  const hasCutout = rect !== null && (rect.width > 0 || rect.height > 0);
  const pad = CUTOUT_PADDING;

  const cutoutX = hasCutout ? rect!.left - pad : 0;
  const cutoutY = hasCutout ? rect!.top - pad : 0;
  const cutoutW = hasCutout ? rect!.width + pad * 2 : 0;
  const cutoutH = hasCutout ? rect!.height + pad * 2 : 0;

  return (
    <svg
      aria-hidden
      className="pointer-events-none fixed inset-0 h-full w-full"
      style={{ zIndex: 9990 }}
    >
      <defs>
        <mask id="spotlight-mask">
          {/* White = visible (the dim) */}
          <rect x="0" y="0" width="100%" height="100%" fill="white" />
          {/* Black = transparent (the hole) */}
          {hasCutout && (
            <rect
              x={cutoutX}
              y={cutoutY}
              width={cutoutW}
              height={cutoutH}
              fill="black"
              rx={4}
            />
          )}
        </mask>
      </defs>

      {/* The dim layer, with the hole cut out */}
      <rect
        x="0"
        y="0"
        width="100%"
        height="100%"
        fill="rgba(0,0,0,0.6)"
        mask="url(#spotlight-mask)"
      />

      {/* Transparent interaction-blocking layer over everything EXCEPT the cutout.
          Rendered ONLY for passive steps (advance via Next), to keep the user from
          clicking the dimmed UI while reading.
          Skipped for `passthrough` steps (drag needs free pointer access) AND for
          `gated` steps: a gated step asks the user to act on the real UI, so the
          dim is visual-only and ALL clicks pass through. Blocking everything except
          the cutout made gated completion depend on a pixel-perfect anchor rect —
          if the rect was off, the blocker covered the real control and ate the
          click. Visual-only dim makes the gate robust regardless of rect accuracy. */}
      {!passthrough && !gated && (hasCutout ? (
        <>
          {/* Block: above cutout */}
          <rect
            className="pointer-events-auto"
            x="0"
            y="0"
            width="100%"
            height={cutoutY}
            fill="transparent"
          />
          {/* Block: left of cutout */}
          <rect
            className="pointer-events-auto"
            x="0"
            y={cutoutY}
            width={cutoutX}
            height={cutoutH}
            fill="transparent"
          />
          {/* Block: right of cutout */}
          <rect
            className="pointer-events-auto"
            x={cutoutX + cutoutW}
            y={cutoutY}
            width="100%"
            height={cutoutH}
            fill="transparent"
          />
          {/* Block: below cutout */}
          <rect
            className="pointer-events-auto"
            x="0"
            y={cutoutY + cutoutH}
            width="100%"
            height="100%"
            fill="transparent"
          />
          {/* Cutout itself: only blocks interaction on passive steps */}
          {!gated && (
            <rect
              className="pointer-events-auto"
              x={cutoutX}
              y={cutoutY}
              width={cutoutW}
              height={cutoutH}
              fill="transparent"
            />
          )}
        </>
      ) : (
        /* No cutout: block entire viewport */
        <rect className="pointer-events-auto" x="0" y="0" width="100%" height="100%" fill="transparent" />
      ))}
    </svg>
  );
}

// ─── Tooltip Card ────────────────────────────────────────────────────────────

type TooltipCardProps = {
  step: SpotlightStep;
  stepIndex: number;
  total: number;
  rect: ElementRect | null;
  gateSatisfied: boolean;
  onBack: () => void;
  onNext: () => void;
  onSkip: (dontShowAgain: boolean) => void;
  onFinish: (dontShowAgain: boolean) => void;
  onKeyDown: (e: KeyboardEvent<HTMLDivElement>) => void;
  cardRef: React.RefObject<HTMLDivElement | null>;
};

function TooltipCard({
  step,
  stepIndex,
  total,
  rect,
  gateSatisfied,
  onBack,
  onNext,
  onSkip,
  onFinish,
  onKeyDown,
  cardRef,
}: TooltipCardProps) {
  const isFirst = stepIndex === 0;
  const isLast = stepIndex === total - 1;
  const isGated = step.gated === true;
  // On an actionable (gated) step, Next is hidden until the user performs the
  // action. Once satisfied (incl. when stepping Back onto a completed step) the
  // Next button reappears so the user is never stuck.
  const hideNext = isGated && !gateSatisfied && !isLast;

  // Determine position
  const hasMeaningfulRect =
    rect !== null && (rect.width > 0 || rect.height > 0);

  let position: Position;
  if (hasMeaningfulRect) {
    const vpW = typeof window !== "undefined" ? window.innerWidth : 1280;
    const vpH = typeof window !== "undefined" ? window.innerHeight : 800;
    position = calcTooltipPosition(rect!, step.placement, vpW, vpH);
  } else {
    // No anchor: center the tooltip
    const vpW = typeof window !== "undefined" ? window.innerWidth : 1280;
    const vpH = typeof window !== "undefined" ? window.innerHeight : 800;
    position = {
      top: vpH / 2 - TOOLTIP_H / 2,
      left: vpW / 2 - TOOLTIP_W / 2,
    };
  }

  return (
    <div
      ref={cardRef}
      role="dialog"
      aria-modal="true"
      aria-label={step.title}
      tabIndex={-1}
      onKeyDown={onKeyDown}
      className={cn(
        "fixed flex flex-col gap-3 rounded-[var(--radius-surface)]",
        "border border-border bg-popover text-popover-foreground",
        "p-4 shadow-lg outline-none"
      )}
      style={{
        zIndex: 9991,
        top: position.top,
        left: position.left,
        width: TOOLTIP_W,
        maxWidth: `calc(100vw - ${VIEWPORT_MARGIN * 2}px)`,
      }}
    >
      {/* Header */}
      <div className="flex items-start justify-between gap-2">
        <div className="flex min-w-0 flex-col gap-0.5">
          <span className="text-xs text-muted-foreground">
            {L.progress(stepIndex + 1, total)}
          </span>
          <p className="text-sm font-semibold leading-snug text-foreground">
            {step.title}
          </p>
        </div>
      </div>

      {/* Body */}
      <p className="text-sm leading-relaxed text-muted-foreground">
        {step.body}
      </p>

      {/* Gated hint — visually prominent so users notice the call to action */}
      {isGated && (
        <div className="flex items-center gap-1.5 rounded-[var(--radius)] border border-dashed border-border px-2 py-1">
          {/* Pulsing dot: accent color + animation carry the "action needed" signal */}
          <span
            aria-hidden
            className="size-2 shrink-0 animate-pulse rounded-full bg-[color:var(--accent)]"
          />
          <p className="text-xs font-semibold text-foreground">{L.tryIt}</p>
        </div>
      )}

      {/* Progress bar */}
      <div className="flex items-center gap-0.5" aria-hidden>
        {Array.from({ length: total }).map((_, i) => (
          <span
            key={i}
            className={cn(
              "h-0.5 flex-1 rounded-full transition-colors",
              i <= stepIndex ? "bg-foreground" : "bg-muted"
            )}
          />
        ))}
      </div>

      {/* Footer */}
      <div className="flex flex-col gap-1.5">
        {/* Secondary actions — Don't show again (overall exit) */}
        <div className="flex items-center gap-1">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-7 px-2 text-xs text-muted-foreground"
            onClick={() => (isLast ? onFinish(true) : onSkip(true))}
          >
            {L.dontShow}
          </Button>
        </div>

        {/* Primary nav — Back/Skip + Next/Finish always fit on one row */}
        <div className="flex items-center justify-between gap-1.5">
          {!isFirst ? (
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-7 px-3 text-xs"
              onClick={onBack}
            >
              {L.back}
            </Button>
          ) : (
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-7 px-3 text-xs"
              onClick={() => onSkip(false)}
            >
              {L.skip}
            </Button>
          )}

          {isLast ? (
            <Button
              type="button"
              size="sm"
              className="h-7 px-3 text-xs"
              onClick={() => onFinish(false)}
            >
              {L.finish}
            </Button>
          ) : hideNext ? (
            // Actionable step, gate not yet satisfied: no Next — the "Try it…"
            // hint tells the user what to do; Back stays available.
            <span />
          ) : (
            <Button
              type="button"
              size="sm"
              className="h-7 px-3 text-xs"
              onClick={onNext}
            >
              {L.next}
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

/**
 * A controlled spotlight guide overlay that walks the user through steps,
 * highlighting real DOM elements via `[data-tour-id]` anchors.
 *
 * The component is Puck-agnostic: the parent is responsible for tracking gating
 * state and passing `gateSatisfied`. The engine auto-advances when a gated step
 * satisfies and handles Esc → skip.
 */
export function SpotlightGuide({
  open,
  steps,
  stepIndex,
  onStepChange,
  gateSatisfied,
  onSkip,
  onFinish,
  queryRoot,
}: SpotlightGuideProps) {
  const step = steps[stepIndex];
  const cardRef = useRef<HTMLDivElement | null>(null);

  // Measure the active anchor element, scoped to queryRoot when provided to
  // avoid resolving to a sibling editor shell's element with the same tour id.
  const rect = useElementRect(open ? step?.anchorId : undefined, queryRoot);

  // Auto-advance when a gated step becomes satisfied
  const prevGateSatisfied = useRef(gateSatisfied);
  useEffect(() => {
    const wasUnsatisfied = !prevGateSatisfied.current;
    prevGateSatisfied.current = gateSatisfied;

    if (!open || !step?.gated) return;
    if (gateSatisfied && wasUnsatisfied && stepIndex < steps.length - 1) {
      onStepChange(stepIndex + 1);
    }
  }, [gateSatisfied, open, step, stepIndex, steps.length, onStepChange]);

  // Reset gate tracking when step changes
  useEffect(() => {
    prevGateSatisfied.current = gateSatisfied;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stepIndex]);

  // Focus the tooltip card when the step changes
  useEffect(() => {
    if (!open) return;
    // Give the browser a tick to paint the portal before focusing
    const id = setTimeout(() => {
      cardRef.current?.focus({ preventScroll: true });
    }, 0);
    return () => clearTimeout(id);
  }, [open, stepIndex]);

  const handleBack = useCallback(() => {
    if (stepIndex > 0) onStepChange(stepIndex - 1);
  }, [stepIndex, onStepChange]);

  const handleNext = useCallback(() => {
    if (stepIndex < steps.length - 1) onStepChange(stepIndex + 1);
  }, [stepIndex, steps.length, onStepChange]);

  const handleKeyDown = useCallback(
    (e: KeyboardEvent<HTMLDivElement>) => {
      if (e.key === "Escape") {
        onSkip(false);
      }
    },
    [onSkip]
  );

  if (!open || !step) return null;

  const hasMeaningfulRect = rect !== null && (rect.width > 0 || rect.height > 0);

  return createPortal(
    <>
      <DimWithCutout
        rect={hasMeaningfulRect ? rect : null}
        gated={step.gated === true}
        passthrough={step.passthrough === true}
      />
      <TooltipCard
        step={step}
        stepIndex={stepIndex}
        total={steps.length}
        rect={rect}
        gateSatisfied={gateSatisfied}
        onBack={handleBack}
        onNext={handleNext}
        onSkip={onSkip}
        onFinish={onFinish}
        onKeyDown={handleKeyDown}
        cardRef={cardRef}
      />
    </>,
    document.body
  );
}
